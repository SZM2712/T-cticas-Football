// Encaje de un jugador en su club (DISEÑO §5.5): táctico, cultural, social y con el mánager.
// Con desglose explicable; modifica el rendimiento en partido (±5 %) y la felicidad.

import { FIT_WEIGHTS } from "../config/social";
import { familiarity } from "../match/lineup";
import { FORMATIONS, teamStyle } from "../match/tactics";
import type { Player, World } from "../types/domain";
import type { ClubId } from "../types/ids";
import { clamp, round } from "../util/math";
import { managerOf, pairKey, trustOf, valence } from "./store";

export interface FitBreakdown {
  tactical: number;
  cultural: number;
  social: number;
  manager: number;
  /** Total ponderado, −1..1. */
  total: number;
}

export function fitOf(world: World, p: Player, clubId: ClubId): FitBreakdown {
  const club = world.clubs[clubId]!;
  // Táctico: lo cómodo que está en el mejor hueco del dibujo de su equipo.
  const formation = world.tactics[clubId]?.formation ?? teamStyle(clubId).preferred;
  const slots = FORMATIONS[formation] ?? [];
  const bestFam = Math.max(0, ...slots.map((s) => familiarity(p, s.role)));
  const tactical = clamp(2 * bestFam - 1, -1, 1);
  // Cultural: idioma del país, compatriota y capacidad de adaptación.
  const langs = world.nations[club.nation]?.languages ?? [];
  const fluency = Math.max(0, ...p.languages.filter((l) => langs.includes(l.lang)).map((l) => l.fluency));
  const cultural = clamp(2 * (0.5 * fluency + 0.25 * (p.nationality === club.nation ? 1 : 0) + 0.25 * (p.hidden.adaptability / 20)) - 1, -1, 1);
  // Social: cómo le ven sus compañeros.
  let sum = 0;
  let n = 0;
  for (const id of club.squad) {
    if (id === p.id) continue;
    const rel = world.relationships[pairKey(p.id, id)];
    if (!rel) continue;
    sum += valence(rel, id, p.id);
    n++;
  }
  const social = n ? clamp((2 * sum) / n, -1, 1) : 0;
  const mgr = managerOf(world, clubId);
  const manager = mgr ? clamp(trustOf(world, p.id, mgr.id), -1, 1) : 0;
  const W = FIT_WEIGHTS;
  const total = W.tactical * tactical + W.cultural * cultural + W.social * social + W.manager * manager;
  return { tactical: round(tactical, 3), cultural: round(cultural, 3), social: round(social, 3), manager: round(manager, 3), total: round(total, 3) };
}
