// Ojeadores con incertidumbre (DISEÑO §4.5): cada ojeador mantiene su propia creencia
// sobre el techo de un jugador (filtro de Kalman 1D con deriva) y la actualiza con
// observaciones ruidosas y sesgadas. Dos ojeadores discrepan de forma natural y explicable.

import {
  SCOUT_EXTRA_PER_MONTH, SCOUT_MAX_BELIEFS, SCOUT_MIN_SD, SCOUT_OBS_SD, SCOUT_PRIOR_VAR, SCOUT_SKILL_K,
} from "../config/development";
import { PHYSICAL, TECHNICAL } from "../config/attributes";
import { currentAbility } from "../player/ability";
import type { Rng } from "../rng/rng";
import { dateOf, exactAge } from "../time/calendar";
import type { Player, Staff, World } from "../types/domain";
import type { ScoutBelief } from "../types/development";
import type { GameDay, StaffId } from "../types/ids";
import { clamp, round } from "../util/math";
import { worldRng } from "../world/rng";
import { volatilityFor } from "./tick";

/** Cuánto «tira» a físico (+) o a técnico (−) un jugador, de −1 a 1. */
function physicalLean(p: Player): number {
  const avg = (keys: readonly string[], g: Record<string, number>) => keys.reduce((s, k) => s + (g[k] ?? 0), 0) / keys.length;
  return clamp((avg(PHYSICAL, p.physical) - avg(TECHNICAL, p.technical)) / 5, -1, 1);
}

/** Sesgo sistemático del ojeador con este jugador (en puntos de CA). */
export function scoutBias(s: Staff, p: Player): number {
  return (s.scoutBias ?? 0) * physicalLean(p) + (p.nationality === s.nationality ? 0.25 : 0);
}

/** Una observación del ojeador: actualiza (o crea) su creencia sobre el jugador. */
export function observe(world: World, s: Staff, p: Player, day: GameDay, rng: Rng, closeLook: boolean): ScoutBelief {
  const book = (world.scouting[s.id] ??= {});
  const age = exactAge(p.birthDay, day);
  const ca = currentAbility(p);
  const sdObs = Math.max(SCOUT_MIN_SD, SCOUT_OBS_SD - SCOUT_SKILL_K * (s.attributes.judgingPotential - 10)) * (closeLook ? 0.75 : 1);
  const sdCa = Math.max(0.3, 1.4 - 0.08 * (s.attributes.judgingAbility - 10));
  const bias = scoutBias(s, p);
  const obs = p.development.latentCeiling + bias + rng.normal(0, sdObs);
  const caObs = ca + bias * 0.5 + rng.normal(0, sdCa);
  let b = book[p.id];
  if (!b) {
    b = { mu: ca + (age < 23 ? 1.5 : 0.3), v: SCOUT_PRIOR_VAR, ca: caObs, day, n: 0 };
  } else {
    // La incertidumbre crece con el tiempo sin observar: el techo se mueve.
    const months = Math.max(0, (day - b.day) / 30.4);
    b.v += (volatilityFor(age) ** 2 * months) / 12;
    b.ca += 0.35 * (caObs - b.ca);
  }
  const k = b.v / (b.v + sdObs * sdObs);
  b.mu = round(b.mu + k * (obs - b.mu), 3);
  b.v = round((1 - k) * b.v, 4);
  b.ca = round(b.ca, 3);
  b.day = day;
  b.n++;
  book[p.id] = b;
  return b;
}

/** Trabajo mensual de los ojeadores de los clubes: su plantilla y algunos jugadores de su liga. */
export function monthlyScouting(world: World, day: GameDay): void {
  const { y, m } = dateOf(day);
  const root = worldRng(world).fork(`scout/${y}/${m}`);
  for (const s of Object.values(world.staff)) {
    if (s.role !== "scout" || !s.clubId) continue;
    const club = world.clubs[s.clubId];
    if (!club) continue;
    const rng = root.fork(s.id);
    for (const id of club.squad) {
      const p = world.players[id];
      if (p && !p.retired) observe(world, s, p, day, rng, true);
    }
    const league = club.leagueId ? world.leagues[club.leagueId] : undefined;
    if (league) {
      for (let i = 0; i < SCOUT_EXTRA_PER_MONTH; i++) {
        const other = world.clubs[rng.pick(league.clubs)];
        if (!other || other.id === club.id || !other.squad.length) continue;
        const p = world.players[rng.pick(other.squad)];
        if (p && !p.retired) observe(world, s, p, day, rng, false);
      }
    }
    // Las fichas más antiguas de jugadores ajenos se archivan.
    const book = world.scouting[s.id];
    if (book) {
      const ids = Object.keys(book);
      if (ids.length > SCOUT_MAX_BELIEFS) {
        const own = new Set<string>(club.squad);
        ids.filter((id) => !own.has(id)).sort((a, b) => book[a]!.day - book[b]!.day || a.localeCompare(b))
          .slice(0, ids.length - SCOUT_MAX_BELIEFS)
          .forEach((id) => delete book[id]);
      }
    }
  }
}

/** Estrellas (0,5–5) de un nivel en escala CA, como las ve un aficionado. */
export function starsOf(x: number): number {
  return Math.max(0.5, Math.min(5, Math.round(((x - 6) / 2.4) * 2) / 2));
}

export interface ScoutReportView {
  scout: StaffId;
  name: string;
  /** Nivel actual estimado en estrellas. */
  ability: number;
  /** Potencial estimado: horquilla del 80 % en estrellas. */
  potential: [number, number];
  confidence: "low" | "medium" | "high";
  /** Sesgo conocido del ojeador (texto cualitativo en la UI). */
  lean: "physical" | "technical" | null;
  observations: number;
}

/** Informes de los ojeadores sobre un jugador (sin exponer el techo real). */
export function scoutReportsView(world: World, playerId: string): ScoutReportView[] {
  const out: ScoutReportView[] = [];
  for (const [sid, book] of Object.entries(world.scouting)) {
    const b = book[playerId];
    const s = world.staff[sid];
    if (!b || !s) continue;
    const sd = Math.sqrt(b.v);
    out.push({
      scout: sid as StaffId,
      name: `${s.firstName} ${s.lastName}`,
      ability: starsOf(b.ca),
      potential: [starsOf(Math.max(b.ca, b.mu - 1.28 * sd)), starsOf(Math.max(b.ca, b.mu + 1.28 * sd))],
      confidence: sd < 0.6 ? "high" : sd < 1.1 ? "medium" : "low",
      lean: (s.scoutBias ?? 0) > 0.4 ? "physical" : (s.scoutBias ?? 0) < -0.4 ? "technical" : null,
      observations: b.n,
    });
  }
  return out.sort((a, b) => b.observations - a.observations || a.scout.localeCompare(b.scout));
}
