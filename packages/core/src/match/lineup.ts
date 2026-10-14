// Alineaciones de la IA y construcción de la instantánea de entrada del motor.
// Disponibilidad (lesiones, sanciones), forma física con recuperación perezosa,
// elección de formación por encaje con la plantilla y banquillo.

import { RELATED_POSITIONS, type Position } from "../config/attributes";
import { BENCH_SIZE, RECOVERY_PER_DAY } from "../config/match";
import { POSITION_INDEX, abilityVector } from "../player/ability";
import { fnv1a32 } from "../rng/hash";
import type { Match, Player, World } from "../types/domain";
import { isNationalTeamId, type CompetitionId, type GameDay, type TeamId } from "../types/ids";
import { clamp } from "../util/math";
import { FORMATIONS, FORMATION_IDS, aiTactics, instructionCompliance, resolveTactics, teamStyle } from "./tactics";
import { INSTRUCTION_KEYS, type InstructionKey } from "../types/tactics";
import type { FormationId, MatchInput, SheetPlayer, Skills, TacticsPlan, TeamSheet } from "./types";

/** Forma física hoy: la del último partido más la recuperación de los días pasados. */
export function fitnessOn(p: Player, day: GameDay): number {
  const rate = RECOVERY_PER_DAY * (0.6 + p.physical.naturalFitness / 25);
  return Math.min(1, p.fitness + rate * Math.max(0, day - p.fitnessDay));
}

export function isInjured(p: Player, day: GameDay): boolean {
  return p.injury !== null && p.injury.until > day;
}

export function isSuspended(p: Player, competitionId: CompetitionId): boolean {
  return p.suspensions.some((s) => s.competitionId === competitionId && s.matches > 0);
}

export function skillsOf(p: Player): Skills {
  const t = p.technical;
  const m = p.mental;
  const ph = p.physical;
  const g = p.goalkeeping;
  return {
    passing: t.shortPassing * 0.6 + t.longPassing * 0.15 + m.decisions * 0.25,
    vision: m.vision * 0.7 + t.longPassing * 0.3,
    firstTouch: t.firstTouch,
    technique: t.technique,
    dribbling: t.dribbling * 0.7 + m.flair * 0.15 + ph.balance * 0.15,
    crossing: t.crossing,
    finishing: t.finishing * 0.65 + m.composure * 0.2 + m.offTheBall * 0.15,
    longShots: t.longShots * 0.75 + t.technique * 0.25,
    heading: t.heading,
    aerial: t.heading * 0.45 + ph.jumping * 0.35 + ph.strength * 0.2,
    tackling: t.tackling,
    marking: t.marking,
    positioning: m.positioning,
    anticipation: m.anticipation,
    composure: m.composure,
    decisions: m.decisions,
    pace: ph.pace * 0.5 + ph.acceleration * 0.5,
    agility: ph.agility,
    strength: ph.strength,
    stamina: ph.stamina,
    workRate: m.workRate,
    aggression: m.aggression,
    penalties: t.penalties * 0.75 + m.composure * 0.25,
    freeKicks: t.freeKicks,
    keeping: g.reflexes * 0.35 + g.handling * 0.2 + g.gkPositioning * 0.3 + g.aerialReach * 0.15,
    oneOnOnes: g.oneOnOnes,
    naturalFitness: ph.naturalFitness,
  };
}

/** Familiaridad de un jugador con un puesto. */
export function familiarity(p: Player, role: Position): number {
  const known = p.positions[role];
  if (known !== undefined) return known;
  if (role === "GK" || p.position === "GK") return 0.02;
  return RELATED_POSITIONS[p.position].includes(role) ? 0.5 : 0.2;
}

interface Candidate {
  p: Player;
  fitness: number;
  ability: Float64Array;
  /** Valor en cada posición (orden de POSITION_INDEX): CA − desencaje − cansancio. */
  value: Float64Array;
  used: boolean;
}

// Caché de CA y familiaridad por posición. Los atributos solo cambian con el desarrollo
// (Fase 3), que debe llamar a `invalidateAbilityCache` al aplicarse.
interface CachedAbility {
  ability: Float64Array;
  familiarity: Float64Array;
}
let abilityEpoch = 0;
const abilityCache = new WeakMap<Player, { epoch: number; v: CachedAbility }>();

/** Invalida la caché de CA por posición (tras cambiar atributos o posiciones de jugadores). */
export function invalidateAbilityCache(): void {
  abilityEpoch++;
}

const ORDER = Object.keys(POSITION_INDEX) as Position[];

function cachedAbility(p: Player): CachedAbility {
  const hit = abilityCache.get(p);
  if (hit && hit.epoch === abilityEpoch) return hit.v;
  const fam = new Float64Array(12);
  for (const pos of ORDER) fam[POSITION_INDEX[pos]] = familiarity(p, pos);
  const v = { ability: abilityVector(p), familiarity: fam };
  abilityCache.set(p, { epoch: abilityEpoch, v });
  return v;
}

function candidate(p: Player, day: GameDay): Candidate {
  const { ability, familiarity: fam } = cachedAbility(p);
  const fitness = fitnessOn(p, day);
  const value = new Float64Array(12);
  for (let i = 0; i < 12; i++) value[i] = ability[i]! - (1 - fam[i]!) * 5 - (1 - fitness) * 8;
  return { p, fitness, ability, value, used: false };
}

function valueAt(c: Candidate, role: Position): number {
  return c.value[POSITION_INDEX[role]]!;
}

/** Orden en que se cubren los puestos (de los más escasos a los más intercambiables). */
const FILL_ORDER: Position[] = ["GK", "CB", "LB", "RB", "DM", "ST", "CM", "AM", "LW", "RW", "LM", "RM"];
const SLOT_ORDER = Object.fromEntries(
  Object.entries(FORMATIONS).map(([id, slots]) => [
    id,
    slots.map((s, i) => ({ i, role: POSITION_INDEX[s.role], rank: FILL_ORDER.indexOf(s.role) })).sort((a, b) => a.rank - b.rank || a.i - b.i),
  ]),
) as unknown as Record<FormationId, { i: number; role: number }[]>;

function fill(formation: FormationId, pool: Candidate[], forced?: readonly string[]): { xi: Candidate[]; total: number } {
  for (const c of pool) c.used = false;
  const xi: Candidate[] = new Array(FORMATIONS[formation].length);
  let total = 0;
  // Titulares elegidos por el usuario, si están disponibles.
  if (forced) {
    for (const { i, role } of SLOT_ORDER[formation]) {
      const c = pool.find((x) => x.p.id === forced[i] && !x.used);
      if (!c) continue;
      c.used = true;
      xi[i] = c;
      total += c.value[role]!;
    }
  }
  for (const { i, role } of SLOT_ORDER[formation]) {
    if (xi[i]) continue;
    let best: Candidate | undefined;
    let bestV = -Infinity;
    for (const c of pool) {
      if (c.used) continue;
      const v = c.value[role]!;
      if (v > bestV) {
        bestV = v;
        best = c;
      }
    }
    if (!best) break;
    best.used = true;
    xi[i] = best;
    total += bestV;
  }
  return { xi, total };
}

export interface Lineup {
  formation: FormationId;
  xi: Player[];
  bench: Player[];
  /** CA media del once. */
  level: number;
  /** CA de cada convocado en su posición natural. */
  ability: Map<string, number>;
}

/** Jugadores disponibles de un equipo para un partido de una competición. */
export function availablePlayers(world: World, team: TeamId, day: GameDay, competitionId: CompetitionId): Player[] {
  const ids = isNationalTeamId(team) ? world.nationalTeams[team]?.squad : world.clubs[team]?.squad;
  const out: Player[] = [];
  for (const id of ids ?? []) {
    const p = world.players[id];
    if (!p || p.retired || isInjured(p, day) || isSuspended(p, competitionId)) continue;
    out.push(p);
  }
  return out;
}

/**
 * Once, formación y banquillo. Sin plan los elige la IA (formación de mejor encaje);
 * con plan se respeta su formación y los titulares que estén disponibles.
 */
export function pickLineup(world: World, team: TeamId, day: GameDay, competitionId: CompetitionId, plan?: TacticsPlan): Lineup {
  const pool: Candidate[] = availablePlayers(world, team, day, competitionId).map((p) => candidate(p, day));
  const preferred = teamStyle(team).preferred;
  let best: { formation: FormationId; xi: Candidate[]; score: number } | undefined;
  const formations = plan?.formation ? [plan.formation] : FORMATION_IDS;
  for (const formation of formations) {
    const { xi, total } = fill(formation, pool, plan?.formation === formation ? plan.lineup : undefined);
    if (xi.filter(Boolean).length < 11) continue;
    // Pequeña preferencia por la formación de la casa: los equipos tienen identidad.
    const score = total + (formation === preferred ? 2.5 : 0);
    if (!best || score > best.score) best = { formation, xi, score };
  }
  if (!best) {
    // Plantilla corta (no debería pasar): se juega con lo que haya.
    const formation = plan?.formation ?? "4-4-2";
    const { xi } = fill(formation, pool);
    best = { formation, xi: xi.filter(Boolean), score: 0 };
  }
  const chosen = new Set(best.xi);
  const rest = pool.filter((c) => !chosen.has(c));
  const bench: Candidate[] = [];
  const gk = rest.filter((c) => c.p.position === "GK").sort((a, b) => valueAt(b, "GK") - valueAt(a, "GK"))[0];
  if (gk) bench.push(gk);
  const others = rest
    .filter((c) => c !== gk)
    .sort((a, b) => valueAt(b, b.p.position) - valueAt(a, a.p.position) || a.p.id.localeCompare(b.p.id));
  // Cobertura por líneas antes que pura calidad: al menos un defensa, un medio y un delantero.
  for (const line of [["CB", "LB", "RB"], ["DM", "CM", "AM", "LM", "RM"], ["ST", "LW", "RW"]] as Position[][]) {
    const c = others.find((o) => line.includes(o.p.position) && !bench.includes(o));
    if (c && bench.length < BENCH_SIZE) bench.push(c);
  }
  for (const c of others) {
    if (bench.length >= BENCH_SIZE) break;
    if (!bench.includes(c)) bench.push(c);
  }
  const xi = best.xi.map((c) => c.p);
  const level = best.xi.reduce((s, c) => s + valueAt(c, c.p.position), 0) / Math.max(1, best.xi.length);
  const ability = new Map<string, number>();
  for (const c of [...best.xi, ...bench]) ability.set(c.p.id, c.ability[POSITION_INDEX[c.p.position]]!);
  return { formation: best.formation, xi, bench: bench.map((c) => c.p), level, ability };
}

/**
 * Autoridad del técnico sobre un jugador (0..1): su reputación frente a la del jugador
 * y su mano con la gente. Sin técnico, autoridad media.
 */
export function coachAuthority(world: World, team: TeamId, p: Player): number {
  const coachId = isNationalTeamId(team)
    ? world.nationalTeams[team]?.coachId
    : world.clubs[team]?.staff.find((id) => world.staff[id]?.role === "headCoach");
  const coach = coachId ? world.staff[coachId] : undefined;
  if (!coach) return 0.5;
  return clamp(0.5 + (coach.reputation - p.reputation) * 0.6 + (coach.attributes.manManagement - 10) / 25, 0, 1);
}

function sheetPlayer(
  p: Player, role: Position | null, day: GameDay, ability: number, instructions: InstructionKey[], authority: number,
): SheetPlayer {
  const compliance = {} as Record<InstructionKey, number>;
  for (const key of INSTRUCTION_KEYS) compliance[key] = instructionCompliance(p, key, authority);
  return {
    id: p.id,
    position: p.position,
    familiarity: role ? familiarity(p, role) : 1,
    fitness: Math.round(fitnessOn(p, day) * 1000) / 1000,
    skills: skillsOf(p),
    consistency: p.hidden.consistency,
    bigMatches: p.hidden.bigMatches,
    pressure: p.hidden.pressure,
    injuryProneness: p.hidden.injuryProneness,
    temperament: p.hidden.temperament,
    morale: p.state.morale,
    ability,
    instructions,
    compliance,
  };
}

export function teamSheet(
  world: World, lineup: Lineup, team: TeamId, oppLevel: number, home: boolean, day: GameDay, plan?: TacticsPlan,
): TeamSheet {
  const slots = FORMATIONS[lineup.formation];
  const tactics = resolveTactics(aiTactics(team, lineup.formation, lineup.level, oppLevel, home), plan);
  tactics.formation = lineup.formation;
  const ids = new Set([...lineup.xi, ...lineup.bench].map((p) => p.id as string));
  tactics.instructions = tactics.instructions.filter((i) => ids.has(i.player));
  const instructionsOf = (p: Player) => tactics.instructions.filter((i) => i.player === p.id).map((i) => i.key);
  const sheet = (p: Player, role: Position | null) =>
    sheetPlayer(p, role, day, lineup.ability.get(p.id) ?? 10, instructionsOf(p), coachAuthority(world, team, p));
  const out: TeamSheet = {
    team,
    tactics,
    xi: lineup.xi.map((p, i) => sheet(p, slots[i]?.role ?? p.position)),
    bench: lineup.bench.map((p) => sheet(p, null)),
  };
  if (plan) out.human = true;
  return out;
}

const refereeCache = new WeakMap<World, Map<string, number[]>>();

/** Rigor del árbitro asignado: uno de la nación de la competición (o cualquiera si es internacional). */
function refereeStrictness(world: World, m: Match): number {
  let byNation = refereeCache.get(world);
  if (!byNation) {
    byNation = new Map();
    for (const s of Object.values(world.staff)) {
      if (s.role !== "referee") continue;
      for (const key of [s.nationality as string, "*"]) {
        const list = byNation.get(key) ?? [];
        list.push(s.attributes.refStrictness ?? 11);
        byNation.set(key, list);
      }
    }
    refereeCache.set(world, byNation);
  }
  const nation = world.competitions[m.competitionId]?.nation;
  const list = (nation && byNation.get(nation)) || byNation.get("*") || [11];
  return list[fnv1a32(m.id) % list.length]!;
}

/** Importancia del partido: finales y eliminatorias pesan más que una jornada de liga. */
function importance(world: World, m: Match): number {
  const comp = world.competitions[m.competitionId];
  if (!comp) return 0.3;
  const stage = comp.stages[m.stage];
  const lastRound = stage ? m.round === stage.rounds.length - 1 : false;
  let base = comp.kind === "friendly" ? 0.05 : comp.kind === "league" ? 0.35 : 0.45;
  if (m.decisive) base += 0.25;
  if (m.decisive && lastRound && stage?.kind === "knockout") base += 0.25;
  if (comp.kind === "worldCup" || comp.kind === "continentalCup") base += 0.15;
  return clamp(base, 0, 1);
}

/** Instantánea de entrada del motor para un partido del mundo. */
export function buildMatchInput(world: World, m: Match, aggregate?: [number, number]): MatchInput {
  const planH = world.tactics[m.home];
  const planA = world.tactics[m.away];
  const h = pickLineup(world, m.home, m.day, m.competitionId, planH);
  const a = pickLineup(world, m.away, m.day, m.competitionId, planA);
  const input: MatchInput = {
    seedPath: `match/${m.id}`,
    home: teamSheet(world, h, m.home, a.level, !m.neutral, m.day, planH),
    away: teamSheet(world, a, m.away, h.level, false, m.day, planA),
    neutral: m.neutral,
    decisive: m.decisive,
    importance: importance(world, m),
    refStrictness: refereeStrictness(world, m),
  };
  if (aggregate) input.aggregate = aggregate;
  return input;
}

