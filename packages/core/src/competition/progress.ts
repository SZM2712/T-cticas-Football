// Avance de competiciones: arranque de fases, sorteos de rondas, ganadores de
// eliminatorias, clasificados y fin de competición. `tryAdvance` es idempotente: se
// puede llamar tras cualquier partido o cuando termina una competición de la que
// depende otra, y avanza todo lo que ya sea posible.

import type { Competition, Stage, Tie } from "../types/domain";
import type { TeamId } from "../types/ids";
import { worldRng } from "../world/rng";
import {
  bySeed, extrasOf, fillKnockoutRound, fillPairedRounds, fillRoundRobinStage, knockoutPlan, playersThisRound,
  teamStrength, type Ctx,
} from "./build";
import { drawGroups, leaguePhaseDraw, pairKnockout } from "./draw";
import { COMPLETION_HOOKS, ENTRANT_RESOLVERS } from "./resolvers";
import { compareRowsPerGame, groupTable, type TableRow } from "./standings";

function teamNation(ctx: Ctx, t: TeamId): string {
  return ctx.world.clubs[t]?.nation ?? ctx.world.nationalTeams[t]?.nation ?? "";
}

function confedOf(ctx: Ctx, t: TeamId): string {
  const nt = ctx.world.nationalTeams[t];
  return nt ? (ctx.world.nations[nt.nation]?.confed ?? "") : "";
}

/** Entrantes de una fase, o null si aún dependen de algo que no ha terminado. */
function stageEntrants(ctx: Ctx, comp: Competition, index: number): TeamId[] | null {
  const resolver = comp.meta.resolver ? ENTRANT_RESOLVERS[String(comp.meta.resolver)] : undefined;
  if (resolver) {
    const fromResolver = resolver(ctx, comp, index);
    if (fromResolver !== undefined) return fromResolver;
  }
  if (index === 0) return comp.participants;
  return comp.stages[index - 1]!.qualified ?? null;
}

function startStage(ctx: Ctx, comp: Competition, index: number): boolean {
  const stage = comp.stages[index]!;
  const entrants = stageEntrants(ctx, comp, index);
  if (!entrants) return false;
  if (index === 0 && comp.participants.length === 0) comp.participants = entrants.slice();
  const rng = worldRng(ctx.world).fork(`draw/${comp.id}/${index}`);
  switch (stage.kind) {
    case "roundRobin":
      fillRoundRobinStage(ctx, comp, index, [entrants], stage.double !== false);
      break;
    case "groups": {
      const seeded = bySeed(ctx.world, entrants);
      const limit = (g: readonly TeamId[], t: TeamId) => {
        if (stage.groupConstraint !== "confed") return true;
        const c = confedOf(ctx, t);
        const same = g.filter((x) => confedOf(ctx, x) === c).length;
        return same < (c === "EUR" ? 2 : 1);
      };
      fillRoundRobinStage(ctx, comp, index, drawGroups(rng, seeded, stage.groupCount ?? 1, limit), stage.double !== false);
      break;
    }
    case "leaguePhase": {
      const seeded = bySeed(ctx.world, entrants);
      fillPairedRounds(ctx, comp, index, seeded, leaguePhaseDraw(rng, seeded, (t) => teamNation(ctx, t), stage.rounds.length));
      break;
    }
    case "knockout":
    case "playoffTie": {
      const prev = index > 0 ? comp.stages[index - 1] : undefined;
      if (prev?.advance?.leaguePhase) {
        const { direct } = prev.advance.leaguePhase;
        stage.extraEntrants = entrants.slice(0, direct);
        stage.extraEntrantsRound = 1;
        stage.groups = [{ teams: entrants.slice(direct) }];
      } else {
        stage.groups = [{ teams: entrants.slice() }];
      }
      stage.status = "active";
      break;
    }
  }
  if (comp.status === "scheduled") comp.status = "active";
  return true;
}

function tieWinner(ctx: Ctx, tie: Tie): TeamId | null {
  let ga = 0;
  let gb = 0;
  let pens: [number, number] | undefined;
  let decisiveHomeIsA = true;
  for (const id of tie.matchIds) {
    const m = ctx.world.matches[id]!;
    if (!m.result) return null;
    const aHome = m.home === tie.a;
    ga += aHome ? m.result.home : m.result.away;
    gb += aHome ? m.result.away : m.result.home;
    if (m.decisive) {
      pens = m.result.pens;
      decisiveHomeIsA = aHome;
    }
  }
  if (ga !== gb) return ga > gb ? tie.a : tie.b;
  if (pens) {
    const homeWins = pens[0] > pens[1];
    return homeWins === decisiveHomeIsA ? tie.a : tie.b;
  }
  return teamStrength(ctx.world, tie.a) >= teamStrength(ctx.world, tie.b) ? tie.a : tie.b;
}

/** Avanza las rondas de una eliminatoria. Devuelve true si la fase terminó. */
function advanceKnockout(ctx: Ctx, comp: Competition, index: number): boolean {
  const stage = comp.stages[index]!;
  const entrants = stage.groups[0]?.teams ?? [];
  const extras = extrasOf(stage);
  const plan = knockoutPlan(entrants.length, extras);
  if (plan.rounds === 0 || stage.rounds.length === 0) {
    stage.qualified = entrants.slice(0, 1);
    return true;
  }
  // Siembra: los que entran tarde son cabezas de serie; luego, el orden de entrada.
  const seed = new Map<TeamId, number>();
  (stage.extraEntrants ?? []).forEach((t, i) => seed.set(t, i - 1000));
  entrants.forEach((t, i) => seed.set(t, i));
  let survivors: TeamId[] = entrants.slice();
  for (let r = 0; r < plan.rounds; r++) {
    const round = stage.rounds[r];
    if (!round) throw new Error(`${comp.nameKey}: faltan rondas reservadas (${plan.rounds})`);
    if (!round.drawn) {
      let pool = survivors.slice();
      if (r === (stage.extraEntrantsRound ?? 1) && stage.extraEntrants) pool.push(...stage.extraEntrants);
      pool = stage.pairing === "seeded"
        ? pool.sort((a, b) => seed.get(a)! - seed.get(b)!)
        : bySeed(ctx.world, pool);
      const play = playersThisRound(pool.length, r, plan, extras);
      const byes = pool.slice(0, pool.length - play);
      const players = pool.slice(pool.length - play);
      const rng = worldRng(ctx.world).fork(`draw/${comp.id}/${index}/${r}`);
      const pairs = pairKnockout(rng, players, stage.pairing, stage.lowerHosts ?? false, (t) => teamStrength(ctx.world, t));
      fillKnockoutRound(ctx, comp, index, r, pairs);
      round.byes = byes;
    }
    const next: TeamId[] = [...(round.byes ?? [])];
    for (const tie of round.ties ?? []) {
      if (!tie.winner) {
        const winner = tieWinner(ctx, tie);
        if (!winner) return false;
        tie.winner = winner;
      }
      next.push(tie.winner);
    }
    survivors = stage.pairing === "seeded" ? next.sort((a, b) => seed.get(a)! - seed.get(b)!) : next;
  }
  stage.qualified = survivors.slice(0, 1);
  const final = stage.rounds[plan.rounds - 1]?.ties?.[0];
  if (final) stage.qualified.push(final.winner === final.a ? final.b : final.a);
  return true;
}

/** Clasificados de una fase de liga/grupos ya terminada. */
function roundRobinQualified(ctx: Ctx, comp: Competition, index: number): TeamId[] {
  const stage = comp.stages[index]!;
  const tables = stage.groups.map((g) => groupTable(ctx.world, comp.id, index, g.teams));
  const seed = new Map<TeamId, number>(comp.participants.map((t, i) => [t, i]));
  if (stage.advance?.leaguePhase) return tables[0]!.slice(0, stage.advance.leaguePhase.playoffTo).map((r) => r.team);
  // Orden por puesto en el grupo y, dentro del puesto, por puntos por partido.
  const maxRank = Math.max(...tables.map((t) => t.length));
  const ordered: TableRow[] = [];
  for (let rank = 0; rank < maxRank; rank++) {
    const tier = tables.map((t) => t[rank]).filter((r): r is TableRow => !!r);
    ordered.push(...tier.sort((a, b) => compareRowsPerGame(a, b, seed)));
  }
  const all = ordered.map((r) => r.team);
  return stage.advance?.slots !== undefined ? all.slice(0, stage.advance.slots) : all;
}

function stageComplete(ctx: Ctx, stage: Stage): boolean {
  return stage.rounds.every((r) => r.drawn && r.matchIds.every((id) => !!ctx.world.matches[id]?.result));
}

function finishCompetition(ctx: Ctx, comp: Competition): void {
  const last = comp.stages[comp.stages.length - 1];
  comp.status = "finished";
  if (last) {
    if (last.kind === "knockout" || last.kind === "playoffTie") {
      comp.ranking = last.qualified ?? [];
    } else {
      comp.ranking = last.qualified ?? [];
    }
    if (comp.ranking[0]) comp.winner = comp.ranking[0];
  }
  ctx.world.events.push({
    day: ctx.world.meta.today,
    type: "competitionFinished",
    data: { competitionId: comp.id, kind: comp.kind, winner: comp.winner ?? "" },
  });
  const hook = COMPLETION_HOOKS[comp.kind];
  if (hook) hook(ctx, comp);
  // Competiciones que esperaban a esta.
  for (const other of Object.values(ctx.world.competitions)) {
    const deps = other.meta.dependsOn;
    if (other.status !== "finished" && Array.isArray(deps) && deps.includes(comp.id)) tryAdvance(ctx, other);
  }
}

export function tryAdvance(ctx: Ctx, comp: Competition): void {
  for (let guard = 0; guard < 64 && comp.status !== "finished"; guard++) {
    const index = comp.currentStage;
    const stage = comp.stages[index];
    if (!stage) {
      finishCompetition(ctx, comp);
      return;
    }
    if (stage.status === "pending" && !startStage(ctx, comp, index)) return;
    if (stage.status === "active") {
      if (stage.kind === "knockout" || stage.kind === "playoffTie") {
        if (!advanceKnockout(ctx, comp, index)) return;
      } else {
        if (!stageComplete(ctx, stage)) return;
        stage.qualified = roundRobinQualified(ctx, comp, index);
      }
      stage.status = "finished";
    }
    if (stage.status === "finished") {
      if (index + 1 < comp.stages.length) comp.currentStage = index + 1;
      else {
        finishCompetition(ctx, comp);
        return;
      }
    }
  }
}
