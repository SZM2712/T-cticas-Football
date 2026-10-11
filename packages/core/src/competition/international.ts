// Ciclo internacional de 4 años (§8.2 de DISEÑO.md):
//   año par (otoño)        → Ligas de Naciones (Europa y Norte/Centroamérica); finales en marzo.
//   junio impar → marzo    → clasificatorias europeas (Mundial o Eurocopa).
//   sep–nov del año previo → clasificatorias de África, Asia, Norte/Centroamérica y Oceanía.
//   sep (W-2) → mar (W)    → clasificatoria sudamericana (liga única de 10).
//   veranos                → Mundial (W%4==2), Eurocopa y Copa América (%4==0),
//                            Copa Oro y Copa de África (impares), Copa de Asia (%4==3).

import { NATIONS, type ConfederationId } from "@tf/data";
import { TOURNAMENT_GROUP_GAP, TOURNAMENT_ROUND_GAP, TOURNAMENT_START, WORLD_CUP_SLOTS } from "../config/calendar";
import { dayOf, nextWeekday, THU } from "../time/calendar";
import type { Competition, CompetitionKind, World } from "../types/domain";
import { nationalTeamIdOf, type GameDay, type NationalTeamId, type NationId, type TeamId } from "../types/ids";
import { worldRng } from "../world/rng";
import { addStage, addMatch, newCompetition, type Ctx, type RoundSlot } from "./build";
import { tryAdvance } from "./progress";
import { windowsOf } from "./seasonPlan";

const intlKind = (i: number): "intl1" | "intl2" => (i % 2 === 0 ? "intl1" : "intl2");

/** Jornadas internacionales (2 por ventana) de las ventanas indicadas de una temporada. */
function windowMatchdays(season: number, keys: readonly string[]): GameDay[] {
  return windowsOf(season)
    .filter((w) => keys.includes(w.key))
    .flatMap((w) => w.matchdays);
}

export function teamsOfConfed(world: World, confed: ConfederationId): NationalTeamId[] {
  return Object.values(world.nationalTeams)
    .filter((t) => world.nations[t.nation]?.confed === confed)
    .sort((a, b) => b.elo - a.elo || a.id.localeCompare(b.id))
    .map((t) => t.id);
}

/** Anfitriones de un torneo; se deciden una vez y se guardan en el mundo. */
export function hostsFor(world: World, key: string, year: number, pool: readonly ConfederationId[], minStrength: number): NationId[] {
  const k = `${key}-${year}`;
  if (!world.hosts[k]) {
    const rng = worldRng(world).fork(`hosts/${k}`);
    const candidates = NATIONS.filter((n) => pool.includes(n.confed) && n.strength >= minStrength).map((n) => n.code);
    world.hosts[k] = [rng.weighted(candidates, (c) => NATIONS.find((n) => n.code === c)!.strength) as NationId];
  }
  return world.hosts[k]!;
}

const WORLD_CUP_POOL: ConfederationId[] = ["EUR", "SAM", "NCA", "AFR", "ASI"];

function intlRounds(days: readonly GameDay[]): RoundSlot[] {
  return days.map((d, i) => ({ slots: [d], kind: intlKind(i) }));
}

function newIntl(world: World, kind: CompetitionKind, nameKey: string, season: number, confed: ConfederationId | undefined, participants: TeamId[], meta: Competition["meta"]): Competition {
  const data: Parameters<typeof newCompetition>[1] = { kind, nameKey, season, teamType: "national", participants, meta };
  if (confed) data.confed = confed;
  return newCompetition(world, data);
}

// ── Ligas de Naciones ───────────────────────────────────────────────────────

const NL_TIERS: Partial<Record<ConfederationId, number[]>> = { EUR: [16, 16, 16, 7], NCA: [8, 6] };

function buildNationsLeague(ctx: Ctx, season: number, confed: ConfederationId): void {
  const sizes = NL_TIERS[confed]!;
  const teams = teamsOfConfed(ctx.world, confed);
  // Equipos sin división asignada (primera edición): por Elo.
  const ordered = teams
    .map((id, eloRank) => ({ id, tier: ctx.world.nationalTeams[id]!.nationsLeagueTier, eloRank }))
    .sort((a, b) => (a.tier ?? 99) - (b.tier ?? 99) || a.eloRank - b.eloRank);
  const days = windowMatchdays(season, ["sep", "oct", "nov"]);
  const tierComps: string[] = [];
  let offset = 0;
  sizes.forEach((size, tier) => {
    const members = ordered.slice(offset, offset + size).map((x) => x.id);
    offset += size;
    for (const id of members) ctx.world.nationalTeams[id]!.nationsLeagueTier = tier;
    const comp = newIntl(ctx.world, "nationsLeague", `comp.nationsLeague.${confed}.${tier}`, season, confed, members, { tier });
    addStage(comp, "groups", "stage.groups", intlRounds(days), { groupCount: Math.ceil(size / 4) });
    tryAdvance(ctx, comp);
    tierComps.push(comp.id);
  });
  // Finales en la ventana de marzo: semifinal (jueves) y final (domingo).
  const [sf, final] = windowMatchdays(season, ["mar"]);
  const finals = newIntl(ctx.world, "nationsLeagueFinals", `comp.nationsLeagueFinals.${confed}`, season, confed, [], {
    resolver: "takeRanking",
    source: tierComps[0]!,
    take: 4,
    dependsOn: [tierComps[0]!],
  });
  addStage(finals, "knockout", "stage.finals", [
    { slots: [sf!], kind: "fixed", neutral: true },
    { slots: [final!], kind: "fixed", neutral: true },
  ]);
}

// ── Clasificatorias ─────────────────────────────────────────────────────────

function buildQualifier(
  ctx: Ctx,
  season: number,
  confed: ConfederationId,
  target: "worldCup" | "euro",
  year: number,
  days: readonly GameDay[],
  groupSize: number,
  slots: number,
  double = true,
): void {
  const hosts = target === "worldCup" ? hostsFor(ctx.world, "worldCup", year, WORLD_CUP_POOL, 0.6) : hostsFor(ctx.world, "euro", year, ["EUR"], 0.55);
  const hostTeams = hosts.map(nationalTeamIdOf);
  const teams = teamsOfConfed(ctx.world, confed).filter((t) => !hostTeams.includes(t));
  const hostSlots = hostTeams.filter((t) => ctx.world.nations[t.slice(3)]?.confed === confed).length;
  const comp = newIntl(ctx.world, "qualifier", `comp.qualifier.${target}.${confed}`, season, confed, teams, {
    target,
    year,
    slots: slots - hostSlots,
  });
  addStage(comp, "groups", "stage.groups", intlRounds(days), {
    groupCount: Math.max(1, Math.ceil(teams.length / groupSize)),
    double,
    advance: { slots: slots - hostSlots },
  });
  tryAdvance(ctx, comp);
}

// ── Torneos finales ─────────────────────────────────────────────────────────

interface TournamentDef {
  kind: CompetitionKind;
  confed?: ConfederationId;
  size: number;
  groups: number;
  advance: number;
  hostPool: ConfederationId[];
  hostMin: number;
}

const TOURNAMENTS: Record<string, TournamentDef> = {
  worldCup: { kind: "worldCup", size: 48, groups: 12, advance: 32, hostPool: WORLD_CUP_POOL, hostMin: 0.6 },
  euro: { kind: "continentalCup", confed: "EUR", size: 24, groups: 6, advance: 16, hostPool: ["EUR"], hostMin: 0.55 },
  copaAmerica: { kind: "continentalCup", confed: "SAM", size: 16, groups: 4, advance: 8, hostPool: ["SAM"], hostMin: 0.6 },
  goldCup: { kind: "continentalCup", confed: "NCA", size: 12, groups: 3, advance: 8, hostPool: ["NCA"], hostMin: 0.6 },
  afcon: { kind: "continentalCup", confed: "AFR", size: 16, groups: 4, advance: 8, hostPool: ["AFR"], hostMin: 0.5 },
  asianCup: { kind: "continentalCup", confed: "ASI", size: 16, groups: 4, advance: 8, hostPool: ["ASI"], hostMin: 0.5 },
};

export function tournamentStart(year: number): GameDay {
  return nextWeekday(dayOf(year, TOURNAMENT_START.month, TOURNAMENT_START.day), THU);
}

function buildTournament(ctx: Ctx, season: number, key: keyof typeof TOURNAMENTS, year: number): void {
  const def = TOURNAMENTS[key]!;
  const { world } = ctx;
  const hosts = hostsFor(world, key, year, def.hostPool, def.hostMin).map(nationalTeamIdOf);
  const start = tournamentStart(year);
  const meta: Competition["meta"] = { year, hosts: hosts.slice(), tournament: key };
  let participants: TeamId[] = [];
  if (key === "worldCup" || key === "euro") {
    const sources = Object.values(world.competitions)
      .filter((c) => c.kind === "qualifier" && c.meta.target === key && c.meta.year === year)
      .map((c) => c.id);
    if (sources.length) {
      meta.resolver = "union";
      meta.sources = sources;
      meta.dependsOn = sources;
      meta.fixed = hosts.slice();
    } else {
      // El mundo empezó a mitad de ciclo: plazas por Elo.
      const pool = key === "euro" ? teamsOfConfed(world, "EUR") : bestByConfed(world);
      participants = [...hosts, ...pool.filter((t) => !hosts.includes(t as NationalTeamId))].slice(0, def.size);
    }
  } else {
    const pool = key === "copaAmerica"
      ? [...teamsOfConfed(world, "SAM"), ...teamsOfConfed(world, "NCA").slice(0, def.size - teamsOfConfed(world, "SAM").length)]
      : teamsOfConfed(world, def.confed!);
    participants = [...hosts, ...pool.filter((t) => !hosts.includes(t))].slice(0, def.size);
  }
  const comp = newIntl(world, def.kind, `comp.${key}`, season, def.confed, participants, meta);
  const groupRounds: RoundSlot[] = [0, 1, 2].map((r) => ({
    slots: [(start + r * TOURNAMENT_GROUP_GAP) as GameDay],
    kind: "fixed",
    neutral: true,
    spread: 3,
  }));
  addStage(comp, "groups", "stage.groups", groupRounds, {
    groupCount: def.groups,
    double: false,
    ...(key === "worldCup" ? { groupConstraint: "confed" as const } : {}),
    advance: { slots: def.advance },
  });
  const koRounds = Math.round(Math.log2(def.advance));
  const koStart = start + 3 * TOURNAMENT_GROUP_GAP + 1;
  const ko: RoundSlot[] = Array.from({ length: koRounds }, (_, k) => ({
    slots: [(koStart + k * TOURNAMENT_ROUND_GAP) as GameDay],
    kind: "fixed",
    neutral: true,
    spread: Math.max(1, Math.min(3, (def.advance >> (k + 1)) / 2)),
  }));
  addStage(comp, "knockout", "stage.knockout", ko, { pairing: "seeded" });
  tryAdvance(ctx, comp);
}

/** Reparto por Elo de las plazas mundialistas (solo si no hubo clasificatorias). */
function bestByConfed(world: World): TeamId[] {
  const out: TeamId[] = [];
  for (const [confed, slots] of Object.entries(WORLD_CUP_SLOTS)) out.push(...teamsOfConfed(world, confed as ConfederationId).slice(0, slots));
  return out;
}

// ── Temporada internacional ─────────────────────────────────────────────────

export function buildInternationalSeason(ctx: Ctx, season: number): void {
  const a = season;
  const b = season + 1;
  if (a % 2 === 0) {
    buildNationsLeague(ctx, season, "EUR");
    buildNationsLeague(ctx, season, "NCA");
  }
  // Europa: junio (año impar) → marzo siguiente, grupos de 5 (Mundial) o 6 (Eurocopa).
  const europeDays = [...windowMatchdays(season, ["jun"]), ...windowMatchdays(season + 1, ["sep", "oct", "nov", "mar"])];
  if ((b + 1) % 4 === 2) buildQualifier(ctx, season, "EUR", "worldCup", b + 1, europeDays, 5, WORLD_CUP_SLOTS.EUR);
  if ((b + 1) % 4 === 0) buildQualifier(ctx, season, "EUR", "euro", b + 1, europeDays, 6, 24);
  // Resto: septiembre–noviembre del año previo al Mundial.
  if ((a + 1) % 4 === 2) {
    const days = windowMatchdays(season, ["sep", "oct", "nov"]);
    buildQualifier(ctx, season, "AFR", "worldCup", a + 1, days, 4, WORLD_CUP_SLOTS.AFR);
    buildQualifier(ctx, season, "ASI", "worldCup", a + 1, days, 4, WORLD_CUP_SLOTS.ASI);
    buildQualifier(ctx, season, "NCA", "worldCup", a + 1, days, 4, WORLD_CUP_SLOTS.NCA);
    buildQualifier(ctx, season, "OCE", "worldCup", a + 1, days, 6, WORLD_CUP_SLOTS.OCE, false);
  }
  // Sudamérica: liga única de 10 a lo largo de 9 ventanas.
  if ((a + 2) % 4 === 2) {
    const days = [...windowMatchdays(season, ["sep", "oct", "nov", "mar", "jun"]), ...windowMatchdays(season + 1, ["sep", "oct", "nov", "mar"])];
    buildQualifier(ctx, season, "SAM", "worldCup", a + 2, days, 10, WORLD_CUP_SLOTS.SAM);
  }
  if (b % 4 === 2) buildTournament(ctx, season, "worldCup", b);
  if (b % 4 === 0) {
    buildTournament(ctx, season, "euro", b);
    buildTournament(ctx, season, "copaAmerica", b);
  }
  if (b % 2 === 1) {
    buildTournament(ctx, season, "goldCup", b);
    buildTournament(ctx, season, "afcon", b);
    if (b % 4 === 3) buildTournament(ctx, season, "asianCup", b);
  }
}

/**
 * Amistosos para las selecciones sin partido oficial en una jornada FIFA. Se emparejan
 * por confederación y Elo. No juegan quienes empiezan un torneo en los 12 días siguientes.
 */
export function scheduleFriendlies(ctx: Ctx, season: number, matchday: GameDay, kind: "intl1" | "intl2"): void {
  const { world } = ctx;
  const busySoon = new Set<TeamId>();
  for (const c of Object.values(world.competitions)) {
    if (c.teamType !== "national" || c.status === "finished") continue;
    const first = c.stages[0]?.rounds[0]?.slots[0];
    if ((c.kind === "worldCup" || c.kind === "continentalCup") && first !== undefined && first >= matchday && first - matchday <= 12) {
      for (const t of c.participants) busySoon.add(t);
    }
    // Rondas aún sin sortear cerca de esta fecha (p. ej. la final de la Liga de Naciones):
    // todos los que siguen vivos en la competición quedan reservados.
    const pending = c.stages.some((st) => st.rounds.some((r) => !r.drawn && r.slots.some((d) => Math.abs(d - matchday) < 3)));
    if (pending) for (const t of c.participants) busySoon.add(t);
  }
  const idle = Object.values(world.nationalTeams)
    .filter((t) => !busySoon.has(t.id) && ctx.schedule.isFree({ id: "" as never, home: t.id, away: t.id }, matchday))
    .sort((x, y) => (world.nations[x.nation]!.confed.localeCompare(world.nations[y.nation]!.confed)) || y.elo - x.elo || x.id.localeCompare(y.id));
  if (idle.length < 2) return;
  const comp = newIntl(world, "friendly", "comp.friendly", season, undefined, idle.map((t) => t.id), {});
  addStage(comp, "roundRobin", "stage.friendly", [{ slots: [matchday], kind }]);
  const stage = comp.stages[0]!;
  const rng = worldRng(world).fork(`friendly/${matchday}`);
  for (let i = 0; i + 1 < idle.length; i += 2) {
    const [h, a] = rng.chance(0.5) ? [idle[i]!, idle[i + 1]!] : [idle[i + 1]!, idle[i]!];
    stage.rounds[0]!.matchIds.push(addMatch(ctx, comp, 0, 0, h.id, a.id, matchday, kind).id);
  }
  stage.rounds[0]!.drawn = true;
  stage.status = "active";
  comp.status = "active";
}
