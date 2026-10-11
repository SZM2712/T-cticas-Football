// Capacidad actual (CA) derivada de los atributos: media ponderada por la posición.

import { ALL_ATTRS, ATTR_GROUP, POSITION_WEIGHTS, type AttrKey, type Position } from "../config/attributes";
import type { Player } from "../types/domain";

export type AttributeMap = Record<AttrKey, number>;

export function attributeMap(p: Pick<Player, "technical" | "mental" | "physical" | "goalkeeping">): AttributeMap {
  return { ...p.technical, ...p.mental, ...p.physical, ...p.goalkeeping } as AttributeMap;
}

export function abilityFor(attrs: AttributeMap, position: Position): number {
  const weights = POSITION_WEIGHTS[position];
  let sum = 0;
  let total = 0;
  for (const key of ALL_ATTRS) {
    const w = weights[key];
    if (!w) continue;
    sum += w * attrs[key];
    total += w;
  }
  return total ? sum / total : 0;
}

/** CA en la posición natural del jugador. */
export function currentAbility(p: Player): number {
  return abilityFor(attributeMap(p), p.position);
}

/** Mejor CA entre las posiciones que el jugador domina (familiaridad ≥ 0.75). */
export function bestAbility(p: Player): number {
  const attrs = attributeMap(p);
  let best = 0;
  for (const [pos, fam] of Object.entries(p.positions)) {
    if ((fam ?? 0) >= 0.75) best = Math.max(best, abilityFor(attrs, pos as Position));
  }
  return best;
}

export { ATTR_GROUP };

// Versión rápida para el motor: pesos precompilados por posición y lectura directa de
// los grupos de atributos (sin construir el mapa intermedio).
const COMPILED = POSITIONS_ORDER().map((pos) => {
  const w = POSITION_WEIGHTS[pos];
  const keys: { group: "technical" | "mental" | "physical" | "goalkeeping"; key: string; w: number }[] = [];
  let total = 0;
  for (const key of ALL_ATTRS) {
    const v = w[key];
    if (!v) continue;
    keys.push({ group: ATTR_GROUP[key], key, w: v });
    total += v;
  }
  return { pos, keys, total };
});

function POSITIONS_ORDER(): Position[] {
  return ["GK", "CB", "LB", "RB", "DM", "CM", "LM", "RM", "AM", "LW", "RW", "ST"];
}

/** Índice de cada posición en el vector de `abilityVector`. */
export const POSITION_INDEX: Record<Position, number> = Object.fromEntries(POSITIONS_ORDER().map((p, i) => [p, i])) as Record<Position, number>;

/** CA del jugador en las 12 posiciones (orden de POSITION_INDEX). */
export function abilityVector(p: Pick<Player, "technical" | "mental" | "physical" | "goalkeeping">): Float64Array {
  const out = new Float64Array(12);
  for (let i = 0; i < COMPILED.length; i++) {
    const c = COMPILED[i]!;
    let sum = 0;
    for (const k of c.keys) sum += k.w * (p[k.group] as Record<string, number>)[k.key]!;
    out[i] = sum / c.total;
  }
  return out;
}
