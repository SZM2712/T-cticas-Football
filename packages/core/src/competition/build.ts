// Construcción genérica de competiciones. Toda fase se crea primero con sus rondas
// RESERVADAS (fechas y tipo de jornada) y se rellena con partidos cuando se conocen
// los participantes: así el calendario de la temporada queda fijado desde el 1 de julio.

import type { Competition, Match, Stage, World } from "../types/domain";
import { isNationalTeamId, type CompetitionId, type GameDay, type MatchId, type TeamId } from "../types/ids";
import { nextId } from "../world/ids";
import { roundRobin, type Pairing } from "./roundRobin";
import { candidatesFor, placeMatch, type SlotKind, type TeamSchedule } from "./schedule";

export interface Ctx {
  world: World;
  schedule: TeamSchedule;
  /** Choques de calendario aceptados (deberían ser 0; lo comprueban los tests). */
  clashes: number;
}

/** Fuerza de referencia para sembrar y elegir local (Elo en selecciones, calidad en clubes). */
export function teamStrength(world: World, team: TeamId): number {
  if (isNationalTeamId(team)) return world.nationalTeams[team]?.elo ?? 1000;
  return world.clubs[team]?.quality ?? 0;
}

/** Ordena de más fuerte a más débil (desempate por id: determinista). */
export function bySeed(world: World, teams: readonly TeamId[]): TeamId[] {
  return teams.slice().sort((a, b) => teamStrength(world, b) - teamStrength(world, a) || a.localeCompare(b));
}

export function newCompetition(world: World, data: Omit<Competition, "id" | "stages" | "currentStage" | "status">): Competition {
  const comp: Competition = { ...data, id: nextId<CompetitionId>(world, "co", 5), stages: [], currentStage: 0, status: "scheduled" };
  world.competitions[comp.id] = comp;
  return comp;
}

export interface RoundSlot {
  /** Día base de cada pierna (una para partido único, dos para ida y vuelta). En grupos, el día base de la jornada. */
  slots: GameDay[];
  kind: SlotKind;
  neutral?: boolean;
  /** Reparte los partidos de la ronda en `spread` días consecutivos (torneos). */
  spread?: number;
}

export function addStage(comp: Competition, kind: Stage["kind"], nameKey: string, rounds: RoundSlot[], extra: Partial<Stage> = {}): Stage {
  const stage: Stage = {
    kind,
    nameKey,
    pairing: "seeded",
    groups: [],
    rounds: rounds.map((r) => ({ slots: r.slots.slice(), matchIds: [], drawn: false })),
    roundMeta: rounds.map((r) => {
      const meta: { kind: SlotKind; neutral: boolean; spread?: number } = { kind: r.kind, neutral: r.neutral ?? false };
      if (r.spread) meta.spread = r.spread;
      return meta;
    }),
    status: "pending",
    ...extra,
  };
  comp.stages.push(stage);
  return stage;
}

export function addMatch(
  ctx: Ctx,
  comp: Competition,
  stage: number,
  round: number,
  home: TeamId,
  away: TeamId,
  base: GameDay,
  kind: SlotKind,
  opts: { neutral?: boolean; leg?: number; decisive?: boolean } = {},
): Match {
  const m: Match = {
    id: nextId<MatchId>(ctx.world, "mt", 7),
    competitionId: comp.id,
    stage,
    round,
    home,
    away,
    day: base,
    candidates: candidatesFor(base, kind),
    neutral: opts.neutral ?? false,
    decisive: opts.decisive ?? false,
  };
  if (opts.leg !== undefined) m.leg = opts.leg;
  ctx.world.matches[m.id] = m;
  if (!placeMatch(ctx.world, ctx.schedule, m)) ctx.clashes++;
  return m;
}

function roundBase(stage: Stage, round: number, index: number): { base: GameDay; kind: SlotKind; neutral: boolean } {
  const meta = stage.roundMeta?.[round] ?? { kind: "fixed" as SlotKind, neutral: false };
  const slot = stage.rounds[round]!.slots[0]!;
  return { base: (slot + (meta.spread ? index % meta.spread : 0)) as GameDay, kind: meta.kind, neutral: meta.neutral };
}

/** Rellena una fase todos contra todos (una tabla o varios grupos) sobre sus rondas reservadas. */
export function fillRoundRobinStage(ctx: Ctx, comp: Competition, stageIndex: number, groups: readonly TeamId[][], double: boolean): void {
  const stage = comp.stages[stageIndex]!;
  stage.groups = groups.map((teams) => ({ teams: teams.slice() }));
  const perGroup = groups.map((teams) => roundRobin(teams, double));
  const needed = Math.max(...perGroup.map((r) => r.length));
  if (needed > stage.rounds.length) throw new Error(`${comp.nameKey}: ${needed} jornadas y solo ${stage.rounds.length} reservadas`);
  perGroup.forEach((rounds, g) => {
    rounds.forEach((pairs, r) => {
      const { base, kind, neutral } = roundBase(stage, r, g);
      for (const [home, away] of pairs) {
        stage.rounds[r]!.matchIds.push(addMatch(ctx, comp, stageIndex, r, home, away, base, kind, { neutral }).id);
      }
    });
  });
  for (const round of stage.rounds) round.drawn = true;
  stage.status = "active";
}

/** Rellena una fase de liga con jornadas ya emparejadas (fase suiza). */
export function fillPairedRounds(ctx: Ctx, comp: Competition, stageIndex: number, teams: readonly TeamId[], rounds: Pairing<TeamId>[][]): void {
  const stage = comp.stages[stageIndex]!;
  stage.groups = [{ teams: teams.slice() }];
  rounds.forEach((pairs, r) => {
    const { base, kind, neutral } = roundBase(stage, r, 0);
    stage.rounds[r]!.matchIds = pairs.map(([h, a]) => addMatch(ctx, comp, stageIndex, r, h, a, base, kind, { neutral }).id);
    stage.rounds[r]!.drawn = true;
  });
  stage.status = "active";
}

/** Crea los partidos de una ronda eliminatoria ya emparejada. */
export function fillKnockoutRound(ctx: Ctx, comp: Competition, stageIndex: number, roundIndex: number, pairs: Pairing<TeamId>[]): void {
  const stage = comp.stages[stageIndex]!;
  const round = stage.rounds[roundIndex]!;
  const meta = stage.roundMeta?.[roundIndex] ?? { kind: "midweek" as SlotKind, neutral: false };
  round.ties = [];
  round.matchIds = [];
  pairs.forEach(([a, b], i) => {
    const ids: MatchId[] = [];
    round.slots.forEach((slot, leg) => {
      const [home, away] = leg === 0 ? [a, b] : [b, a];
      const base = (slot + (meta.spread ? i % meta.spread : 0)) as GameDay;
      const decisive = leg === round.slots.length - 1;
      const opts = round.slots.length > 1 ? { neutral: meta.neutral, leg: leg + 1, decisive } : { neutral: meta.neutral, decisive };
      ids.push(addMatch(ctx, comp, stageIndex, roundIndex, home, away, base, meta.kind, opts).id);
    });
    round.ties!.push({ a, b, matchIds: ids });
    round.matchIds.push(...ids);
  });
  round.drawn = true;
}

export interface KnockoutPlan {
  rounds: number;
  /** Mínimo de equipos al empezar cada ronda para que el cuadro cuadre. */
  minPool: number[];
  maxPool: number[];
}

/**
 * Plan de una eliminatoria con exentos y con equipos que entran en rondas posteriores
 * (`extras[r]` se incorporan al empezar la ronda r). Devuelve el mínimo de rondas.
 */
export function knockoutPlan(entrants: number, extras: Record<number, number> = {}): KnockoutPlan {
  if (entrants <= 1 && Object.keys(extras).length === 0) return { rounds: 0, minPool: [], maxPool: [] };
  for (let rounds = 1; rounds < 12; rounds++) {
    const maxPool = new Array<number>(rounds).fill(0);
    const minPool = new Array<number>(rounds).fill(0);
    maxPool[rounds - 1] = 2;
    minPool[rounds - 1] = 2;
    for (let r = rounds - 2; r >= 0; r--) {
      const e = extras[r + 1] ?? 0;
      maxPool[r] = 2 * (maxPool[r + 1]! - e);
      minPool[r] = Math.max(1, minPool[r + 1]! - e);
    }
    const first = entrants + (extras[0] ?? 0);
    if (maxPool.every((x) => x > 0) && first <= maxPool[0]! && first >= minPool[0]!) return { rounds, minPool, maxPool };
  }
  throw new Error(`knockoutPlan imposible para ${entrants} participantes`);
}

/** Cuántos equipos del bombo de la ronda r deben jugar (el resto pasa exento). */
export function playersThisRound(pool: number, round: number, plan: KnockoutPlan, extras: Record<number, number>): number {
  const nextMin = round + 1 < plan.rounds ? plan.minPool[round + 1]! - (extras[round + 1] ?? 0) : 1;
  const winners = Math.max(Math.ceil(pool / 2), nextMin);
  return 2 * (pool - winners);
}

export function extrasOf(stage: Stage): Record<number, number> {
  return stage.extraEntrants?.length ? { [stage.extraEntrantsRound ?? 1]: stage.extraEntrants.length } : {};
}

/** Pierna(s) de las rondas de una eliminatoria: días base a partir de `start`, separadas `gap` días. */
export function sequentialRounds(start: number, legsPerRound: number[], kind: SlotKind, gap = 7, legGap = 3): RoundSlot[] {
  let day = start;
  return legsPerRound.map((legs) => {
    const slots: GameDay[] = [];
    for (let l = 0; l < legs; l++) slots.push((day + l * legGap) as GameDay);
    day += gap + (legs - 1) * legGap;
    return { slots, kind };
  });
}
