// Grafo social del vestuario (DISEÑO §5.1–5.2): relaciones de partida, deriva semanal,
// estatus percibido, jerarquía (influencia real con PageRank sobre el respeto), camarillas
// (Louvain determinista) y contagio emocional. Solo en clubes dirigidos por humanos (LOD completo).

import type { Position } from "../config/attributes";
import {
  BASE_CLOSE_AGE, BASE_COMMON_LANGUAGE, BASE_NOISE_SD, BASE_RIVALRY, BASE_SAME_NATION, CLIQUE_EDGE_QUANTILE, CLIQUE_MIN_SIZE, CLIQUE_MIN_VALENCE,
  CONTAGION, INFLUENCE_WEIGHTS, K_ENVY_STATUS, K_ENVY_WAGE, K_LANGUAGE, K_RESPECT_PERF, K_RESPECT_PROF, K_RIVALRY,
  K_SOCIABILITY, LEVEL_PERCENTILES, MAX_LEADERS, MORALE_DECAY, OUTCAST_VALENCE, RELATION_DECAY, SENIORITY_YEARS,
  STATUS_STARTS, STATUS_WINDOW,
} from "../config/social";
import { currentAbility } from "../player/ability";
import type { Rng } from "../rng/rng";
import { ageOn } from "../time/calendar";
import type { Player, SquadStatus, World } from "../types/domain";
import type { ClubId, CompetitionId, GameDay, PlayerId } from "../types/ids";
import type { Clique, DressingRoom, HierarchyLevel, ManagerId, Relationship } from "../types/social";
import { clamp, round } from "../util/math";
import { feelingAbout, pairKey, trustKey, trustOf, valence } from "./store";
import { TRUST_START } from "../config/social";
import { pickLineup } from "../match/lineup";

/** Líneas del campo para la rivalidad de puesto. */
const LINE: Record<Position, string> = {
  GK: "gk", CB: "cb", LB: "fb", RB: "fb", DM: "cm", CM: "cm", LM: "wm", RM: "wm", AM: "am", LW: "w", RW: "w", ST: "st",
};

export const STATUS_ORDER: readonly SquadStatus[] = ["prospect", "backup", "rotation", "firstTeam", "keyPlayer"];
export const statusRank = (s: SquadStatus): number => STATUS_ORDER.indexOf(s);

/** Jugadores de la plantilla de un club, en orden estable. */
export function squadPlayers(world: World, clubId: ClubId): Player[] {
  const club = world.clubs[clubId];
  if (!club) return [];
  return [...club.squad].sort().map((id) => world.players[id]!).filter((p) => p && !p.retired);
}

function shareLanguage(a: Player, b: Player): boolean {
  return a.languages.some((la) => la.fluency >= 0.5 && b.languages.some((lb) => lb.lang === la.lang && lb.fluency >= 0.5));
}

/** Relación nueva entre dos compañeros (§5.1). */
function newRelationship(a: Player, b: Player, day: GameDay, rng: Rng): Relationship {
  const [x, y] = a.id < b.id ? [a, b] : [b, a];
  let base = 0;
  if (shareLanguage(x, y)) base += BASE_COMMON_LANGUAGE;
  if (x.nationality === y.nationality) base += BASE_SAME_NATION;
  if (Math.abs(ageOn(x.birthDay, day) - ageOn(y.birthDay, day)) <= 3) base += BASE_CLOSE_AGE;
  base = round(clamp(base + rng.normal(0, BASE_NOISE_SD), -1, 1), 3);
  const sameLine = LINE[x.position] === LINE[y.position] ? 1 : 0;
  const respectFor = (p: Player): number => clamp(0.4 + 0.04 * (currentAbility(p) - 12) + 0.2 * (p.psych.professionalism - 0.5), 0, 1);
  return {
    affinity: base, baseline: base,
    rivalry: round(BASE_RIVALRY * sameLine * x.psych.competitiveness * y.psych.competitiveness, 3),
    respectAB: round(respectFor(y), 3), respectBA: round(respectFor(x), 3),
    envyAB: 0, envyBA: 0, sinceDay: day,
  };
}

/** Crea las relaciones que falten (llegadas, canteranos) entre los jugadores de un club. */
export function ensureRelationships(world: World, clubId: ClubId, day: GameDay, rng: Rng): void {
  const squad = squadPlayers(world, clubId);
  for (let i = 0; i < squad.length; i++) {
    for (let j = i + 1; j < squad.length; j++) {
      const key = pairKey(squad[i]!.id, squad[j]!.id);
      if (!world.relationships[key]) world.relationships[key] = newRelationship(squad[i]!, squad[j]!, day, rng.fork(key));
    }
  }
}

/**
 * Papel previsible de cada jugador: el once que elegiría la IA (los 4 mejores, clave), el
 * banquillo (rotación), el resto (reserva) y los jóvenes sin sitio (promesa).
 */
export function predictedStatuses(world: World, clubId: ClubId, day: GameDay): Map<string, SquadStatus> {
  const club = world.clubs[clubId]!;
  const comp = (club.leagueId ? world.leagues[club.leagueId]?.currentCompetition : null) ?? ("" as CompetitionId);
  const lineup = pickLineup(world, clubId, day, comp);
  const out = new Map<string, SquadStatus>();
  const xi = [...lineup.xi].sort((a, b) => (lineup.ability.get(b.id) ?? 0) - (lineup.ability.get(a.id) ?? 0) || (a.id < b.id ? -1 : 1));
  xi.forEach((p, i) => out.set(p.id, i < 4 ? "keyPlayer" : "firstTeam"));
  for (const p of lineup.bench) out.set(p.id, "rotation");
  for (const p of squadPlayers(world, clubId)) {
    if (!out.has(p.id)) out.set(p.id, ageOn(p.birthDay, day) <= 21 ? "prospect" : "backup");
  }
  return out;
}

/** Vestuario nuevo cuando un humano toma el mando de un club. */
export function initDressingRoom(world: World, clubId: ClubId, manager: ManagerId, day: GameDay, rng: Rng): DressingRoom {
  ensureRelationships(world, clubId, day, rng);
  const dr: DressingRoom = { cliques: [], levels: {}, influence: {}, roles: {}, steps: {}, talks: {}, recent: {}, lastWeekly: day };
  world.dressing[clubId] = dr;
  const predicted = predictedStatuses(world, clubId, day);
  for (const p of squadPlayers(world, clubId)) {
    world.trust[trustKey(p.id, manager)] ??= { trust: TRUST_START, sinceDay: day };
    // Espera el papel que de verdad le corresponde; con mucho ego y un contrato que le promete
    // más, un escalón por encima.
    let expected = predicted.get(p.id) ?? "backup";
    const contract = p.contract?.squadStatus;
    if (contract && p.psych.ego > 0.75 && statusRank(contract) > statusRank(expected)) expected = STATUS_ORDER[statusRank(expected) + 1]!;
    p.state.expectedStatus = expected;
    p.state.perceivedStatus = expected;
    p.state.statusGap = 0;
  }
  recomputeStructure(world, clubId);
  return dr;
}

// ── Rendimiento, estatus ───────────────────────────────────────────────────

/** Rendimiento visible: valoración media de la temporada (o una estimación por nivel si apenas ha jugado). */
export function performance(world: World, p: Player, clubId: ClubId): number {
  let apps = 0;
  let sum = 0;
  for (const compId of Object.keys(world.stats).sort()) {
    const st = world.stats[compId]![p.id];
    if (!st || st.team !== clubId) continue;
    apps += st.apps;
    sum += st.ratingSum;
  }
  const byLevel = 6.6 + 0.12 * (currentAbility(p) - 12);
  if (apps === 0) return byLevel;
  const w = Math.min(1, apps / 5);
  return w * (sum / apps) + (1 - w) * byLevel;
}

/** Cuota de participación reciente (0..1). Sin partidos, la que corresponde a su contrato. */
export function participation(dr: DressingRoom, p: Player): number {
  const r = dr.recent[p.id];
  if (!r || r.length < 3) return STATUS_FALLBACK[p.state.expectedStatus];
  return r.reduce((a, b) => a + b, 0) / r.length;
}

const STATUS_FALLBACK: Record<SquadStatus, number> = { keyPlayer: 0.9, firstTeam: 0.65, rotation: 0.4, backup: 0.15, prospect: 0.05 };

export function statusFromParticipation(x: number): SquadStatus {
  if (x >= STATUS_STARTS.keyPlayer) return "keyPlayer";
  if (x >= STATUS_STARTS.firstTeam) return "firstTeam";
  if (x >= STATUS_STARTS.rotation) return "rotation";
  if (x >= STATUS_STARTS.backup) return "backup";
  return "prospect";
}

/** Registra la participación de la plantilla en un partido oficial. */
export function recordParticipation(dr: DressingRoom, squad: readonly string[], played: ReadonlyMap<string, boolean>): void {
  for (const id of [...squad].sort()) {
    const r = (dr.recent[id] ??= []);
    const started = played.get(id);
    r.push(started === undefined ? 0 : started ? 1 : 0.5);
    if (r.length > STATUS_WINDOW) r.shift();
  }
}

// ── Tick semanal ───────────────────────────────────────────────────────────

/** Deriva semanal de todas las relaciones del club (§5.2). */
function driftRelationships(world: World, squad: Player[], clubId: ClubId, dr: DressingRoom): void {
  const perf = new Map(squad.map((p) => [p.id, performance(world, p, clubId)]));
  const meanPerf = squad.reduce((a, p) => a + perf.get(p.id)!, 0) / Math.max(1, squad.length);
  const status = new Map(squad.map((p) => [p.id, participation(dr, p)]));
  const envyOf = (i: Player, j: Player): number => {
    const wi = i.contract?.wage ?? 1;
    const wj = j.contract?.wage ?? 1;
    return i.psych.ego * (K_ENVY_WAGE * Math.max(0, wj / wi - 1) * Math.max(0, perf.get(i.id)! - perf.get(j.id)!) +
      K_ENVY_STATUS * Math.max(0, status.get(j.id)! - status.get(i.id)!));
  };
  const respectGain = (j: Player): number => K_RESPECT_PERF * (perf.get(j.id)! - meanPerf) + K_RESPECT_PROF * (j.psych.professionalism - 0.5);
  for (let a = 0; a < squad.length; a++) {
    for (let b = a + 1; b < squad.length; b++) {
      const x = squad[a]!;
      const y = squad[b]!;
      const rel = world.relationships[pairKey(x.id, y.id)];
      if (!rel) continue;
      const dAff = (shareLanguage(x, y) ? K_LANGUAGE : 0) + K_SOCIABILITY * x.psych.sociability * y.psych.sociability;
      rel.affinity = round(clamp(rel.affinity + dAff - RELATION_DECAY * (rel.affinity - rel.baseline), -1, 1), 4);
      const overlap = LINE[x.position] === LINE[y.position] ? 1 : 0;
      rel.rivalry = round(clamp(rel.rivalry + K_RIVALRY * overlap * x.psych.competitiveness * y.psych.competitiveness - RELATION_DECAY * rel.rivalry, 0, 1), 4);
      // x < y por el orden de la plantilla: AB = de x hacia y.
      rel.envyAB = round(clamp(rel.envyAB + envyOf(x, y) - RELATION_DECAY * rel.envyAB, 0, 1), 4);
      rel.envyBA = round(clamp(rel.envyBA + envyOf(y, x) - RELATION_DECAY * rel.envyBA, 0, 1), 4);
      rel.respectAB = round(clamp(rel.respectAB + respectGain(y) - RELATION_DECAY * (rel.respectAB - 0.4), 0, 1), 4);
      rel.respectBA = round(clamp(rel.respectBA + respectGain(x) - RELATION_DECAY * (rel.respectBA - 0.4), 0, 1), 4);
    }
  }
}

/** Estatus percibido, felicidad y moral (con contagio de los influyentes). */
function updateMoods(world: World, squad: Player[], clubId: ClubId, dr: DressingRoom, day: GameDay): void {
  const mgr = Object.keys(world.managers).sort().map((id) => world.managers[id]!).find((m) => m.clubId === clubId);
  for (const p of squad) {
    const s = p.state;
    // Un veterano que no juega se siente reserva, no promesa; e ir lesionado no cuenta como desaire.
    const perceived = statusFromParticipation(participation(dr, p));
    const floor = ageOn(p.birthDay, day) <= 21 ? "prospect" : "backup";
    if (!p.injury) s.perceivedStatus = statusRank(perceived) < statusRank(floor) ? floor : perceived;
    s.statusGap = round((statusRank(s.perceivedStatus) - statusRank(s.expectedStatus)) / 4, 3);
    let incoming = 0;
    for (const q of squad) {
      if (q.id === p.id) continue;
      const rel = world.relationships[pairKey(p.id, q.id)];
      if (rel) incoming += valence(rel, q.id, p.id);
    }
    incoming /= Math.max(1, squad.length - 1);
    const trust = mgr ? trustOf(world, p.id, mgr.id) : 0;
    const aboutManager = mgr ? feelingAbout(world, p, (a) => a.kind === "manager", day) : 0;
    const maxTension = Math.max(0, ...Object.values(s.tensions));
    s.happiness = round(clamp(0.1 + 0.35 * trust + 0.6 * Math.min(0, s.statusGap) + 0.6 * incoming + 0.3 * aboutManager - 0.3 * maxTension, -1, 1), 3);
  }
  // Contagio: cada uno se acerca a la moral de aquellos a los que aprecia, ponderado por su influencia.
  const next = new Map<string, number>();
  for (const p of squad) {
    let num = 0;
    let den = 0;
    for (const q of squad) {
      if (q.id === p.id) continue;
      const rel = world.relationships[pairKey(p.id, q.id)];
      if (!rel || rel.affinity <= 0) continue;
      const w = (dr.influence[q.id] ?? 0.3) * rel.affinity;
      num += w * (q.state.morale - p.state.morale);
      den += w;
    }
    const contagion = den > 0 ? CONTAGION * (num / den) : 0;
    next.set(p.id, p.state.morale + contagion - MORALE_DECAY * (p.state.morale - p.state.happiness));
  }
  for (const p of squad) {
    p.state.morale = round(clamp(next.get(p.id)!, -1, 1), 3);
    p.state.lastUpdated = day;
  }
}

export function weeklySocial(world: World, clubId: ClubId, day: GameDay, rng: Rng): void {
  const dr = world.dressing[clubId];
  if (!dr) return;
  ensureRelationships(world, clubId, day, rng);
  const squad = squadPlayers(world, clubId);
  driftRelationships(world, squad, clubId, dr);
  recomputeStructure(world, clubId);
  updateMoods(world, squad, clubId, dr, day);
  dr.lastWeekly = day;
}

// ── Jerarquía y camarillas ─────────────────────────────────────────────────

/** PageRank sobre las aristas de respeto (determinista, 30 iteraciones, matriz precalculada). */
function pageRank(ids: string[], weight: (from: string, to: string) => number): Map<string, number> {
  const n = ids.length;
  const d = 0.85;
  const W = ids.map((i) => ids.map((j) => (i === j ? 0 : weight(i, j))));
  const share = W.map((row) => {
    const out = row.reduce((a, b) => a + b, 0);
    return row.map((w) => (out > 0 ? w / out : 1 / (n - 1)));
  });
  for (let i = 0; i < n; i++) share[i]![i] = 0;
  let pr = new Float64Array(n).fill(1 / n);
  for (let it = 0; it < 30; it++) {
    const nx = new Float64Array(n).fill((1 - d) / n);
    for (let i = 0; i < n; i++) {
      const row = share[i]!;
      const pi = d * pr[i]!;
      for (let j = 0; j < n; j++) nx[j]! += pi * row[j]!;
    }
    pr = nx;
  }
  return new Map(ids.map((id, i) => [id, pr[i]!]));
}

/** Louvain (una o varias pasadas de movimiento local + agregación) con orden fijo de nodos. */
export function louvain(ids: string[], w: (a: string, b: string) => number): string[][] {
  // Grafo de trabajo: nodos agregados con sus miembros.
  let nodes = ids.map((id) => [id]);
  let weight = (a: number, b: number): number => {
    let s = 0;
    for (const x of nodes[a]!) for (const y of nodes[b]!) if (x !== y) s += w(x, y);
    return s;
  };
  for (let level = 0; level < 5; level++) {
    const n = nodes.length;
    const W: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : weight(i, j))));
    const self: number[] = Array.from({ length: n }, (_, i) => {
      let s = 0;
      const m = nodes[i]!;
      for (let a = 0; a < m.length; a++) for (let b = a + 1; b < m.length; b++) s += w(m[a]!, m[b]!);
      return s;
    });
    const k = W.map((row, i) => row.reduce((a, b) => a + b, 0) + 2 * self[i]!);
    const m2 = k.reduce((a, b) => a + b, 0);
    if (m2 <= 0) break;
    const comm = Array.from({ length: n }, (_, i) => i);
    const tot = [...k];
    let moved = true;
    let any = false;
    for (let pass = 0; moved && pass < 20; pass++) {
      moved = false;
      for (let i = 0; i < n; i++) {
        const ci = comm[i]!;
        const links = new Map<number, number>();
        for (let j = 0; j < n; j++) if (j !== i && W[i]![j]! > 0) links.set(comm[j]!, (links.get(comm[j]!) ?? 0) + W[i]![j]!);
        tot[ci]! -= k[i]!;
        let best = ci;
        let bestGain = (links.get(ci) ?? 0) - (tot[ci]! * k[i]!) / m2;
        for (const c of [...links.keys()].sort((a, b) => a - b)) {
          const gain = links.get(c)! - (tot[c]! * k[i]!) / m2;
          if (gain > bestGain + 1e-12) {
            bestGain = gain;
            best = c;
          }
        }
        tot[best]! += k[i]!;
        if (best !== ci) {
          comm[i] = best;
          moved = true;
          any = true;
        }
      }
    }
    const groups = new Map<number, string[]>();
    for (let i = 0; i < n; i++) groups.set(comm[i]!, [...(groups.get(comm[i]!) ?? []), ...nodes[i]!]);
    const next = [...groups.keys()].sort((a, b) => a - b).map((c) => groups.get(c)!.sort());
    if (!any || next.length === nodes.length) {
      nodes = next;
      break;
    }
    nodes = next;
    const snapshot = nodes;
    weight = (a, b) => {
      let s = 0;
      for (const x of snapshot[a]!) for (const y of snapshot[b]!) s += w(x, y);
      return s;
    };
  }
  return nodes;
}

function labelClique(world: World, members: Player[], clubId: ClubId, day: GameDay): Pick<Clique, "label" | "labelParam"> {
  const club = world.clubs[clubId]!;
  const clubLangs = world.nations[club.nation]?.languages ?? [];
  const share = (pred: (p: Player) => boolean): boolean => members.filter(pred).length >= 0.75 * members.length;
  const counts = new Map<string, number>();
  for (const p of members) for (const l of p.languages) if (l.fluency >= 0.8) counts.set(l.lang, (counts.get(l.lang) ?? 0) + 1);
  for (const lang of [...counts.keys()].sort()) {
    if (!clubLangs.includes(lang) && counts.get(lang)! >= 0.75 * members.length) return { label: "language", labelParam: lang };
  }
  const nat = members[0]!.nationality;
  if (nat !== club.nation && share((p) => p.nationality === nat)) return { label: "nation", labelParam: nat };
  if (share((p) => ageOn(p.birthDay, day) >= 29)) return { label: "veterans" };
  if (share((p) => ageOn(p.birthDay, day) <= 22)) return { label: "youngsters" };
  if (share((p) => p.homegrown)) return { label: "homegrown" };
  if (share((p) => p.nationality === club.nation)) return { label: "locals" };
  return { label: "mixed" };
}

/** Recalcula jerarquía y camarillas del club. */
export function recomputeStructure(world: World, clubId: ClubId): void {
  const dr = world.dressing[clubId];
  if (!dr) return;
  const day = world.meta.today;
  const squad = squadPlayers(world, clubId);
  const ids = squad.map((p) => p.id);
  if (ids.length < 2) return;
  const byId = new Map(squad.map((p) => [p.id, p]));
  const rel = (a: string, b: string): Relationship | undefined => world.relationships[pairKey(a, b)];

  // Influencia real (§5.2).
  const pr = pageRank(ids, (i, j) => {
    const r = rel(i, j);
    return r ? (i < j ? r.respectAB : r.respectBA) : 0;
  });
  const prMax = Math.max(...pr.values());
  const repMax = Math.max(1e-6, ...squad.map((p) => p.reputation));
  const W = INFLUENCE_WEIGHTS;
  const influence: Record<string, number> = {};
  for (const p of squad) {
    const years = p.contract ? Math.max(0, (day - p.contract.signed) / 365) : 0;
    influence[p.id] = round(
      W.trait * p.psych.influence + W.pagerank * (pr.get(p.id)! / prMax) + W.seniority * Math.min(1, years / SENIORITY_YEARS) +
        W.status * participation(dr, p) + W.reputation * (p.reputation / repMax),
      4,
    );
  }
  dr.influence = influence;

  // Niveles: líderes (≤ 3), influyentes, núcleo, periferia; marginados por valencia.
  const sorted = [...ids].sort((a, b) => influence[b]! - influence[a]! || (a < b ? -1 : 1));
  const levels: Record<string, HierarchyLevel> = {};
  const n = sorted.length;
  sorted.forEach((id, i) => {
    const pct = 1 - i / Math.max(1, n - 1);
    levels[id] = i < MAX_LEADERS && pct >= 0.9 ? "leader" : pct >= LEVEL_PERCENTILES.influential ? "influential" : pct >= LEVEL_PERCENTILES.core ? "core" : "periphery";
  });
  for (const id of ids) {
    let sum = 0;
    let positive = false;
    for (const other of ids) {
      if (other === id) continue;
      const r = rel(id, other);
      if (!r) continue;
      const v = valence(r, other, id);
      sum += v;
      if (v > CLIQUE_MIN_VALENCE || valence(r, id, other) > CLIQUE_MIN_VALENCE) positive = true;
    }
    if (sum / (n - 1) < OUTCAST_VALENCE || !positive) levels[id] = "outcast";
  }
  dr.levels = levels;

  // Camarillas: Louvain sobre las aristas más fuertes del vestuario (por encima de un umbral
  // absoluto y del percentil CLIQUE_EDGE_QUANTILE: si no, todo el mundo cae en dos bloques).
  const mutual = (a: string, b: string): number => {
    const r = rel(a, b);
    return r ? (valence(r, a, b) + valence(r, b, a)) / 2 : 0;
  };
  const all: number[] = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) all.push(mutual(ids[i]!, ids[j]!));
  all.sort((a, b) => a - b);
  const th = Math.max(CLIQUE_MIN_VALENCE, all[Math.floor(CLIQUE_EDGE_QUANTILE * (all.length - 1))] ?? 0);
  const groups = louvain(ids, (a, b) => Math.max(0, mutual(a, b) - th));
  dr.cliques = groups
    .filter((g) => g.length >= CLIQUE_MIN_SIZE)
    .map((g) => ({ members: g as PlayerId[], ...labelClique(world, g.map((id) => byId.get(id as PlayerId)!), clubId, day) }));
}
