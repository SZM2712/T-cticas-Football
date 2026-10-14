// Métricas de balance del desarrollo (Fase 3): estabilidad del talento mundial.

import { ageOn, currentAbility, quantile, type World } from "@tf/core";

export interface TalentSnapshot {
  season: number;
  players: number;
  p50: number;
  p95: number;
  p99: number;
  /** Jugadores con CA ≥ 16 (élite). */
  elite: number;
  avgAge: number;
  /** Jugadores ≤ 21 años. */
  youth: number;
}

/** Fotografía del talento de los jugadores en activo con club. */
export function talentSnapshot(world: World): TalentSnapshot {
  const day = world.meta.today;
  const cas: number[] = [];
  let ageSum = 0;
  let youth = 0;
  for (const p of Object.values(world.players)) {
    if (p.retired || !p.clubId) continue;
    cas.push(currentAbility(p));
    const age = ageOn(p.birthDay, day);
    ageSum += age;
    if (age <= 21) youth++;
  }
  cas.sort((a, b) => a - b);
  return {
    season: world.meta.season,
    players: cas.length,
    p50: quantile(cas, 0.5),
    p95: quantile(cas, 0.95),
    p99: quantile(cas, 0.99),
    elite: cas.filter((x) => x >= 16).length,
    avgAge: ageSum / Math.max(1, cas.length),
    youth,
  };
}

/** Desviación relativa máxima respecto al año 1 en P50/P95/P99 y élite. */
export function maxDrift(snaps: TalentSnapshot[]): Record<"p50" | "p95" | "p99" | "elite", number> {
  const first = snaps[0]!;
  const out = { p50: 0, p95: 0, p99: 0, elite: 0 };
  for (const s of snaps) {
    for (const k of ["p50", "p95", "p99", "elite"] as const) {
      const d = first[k] ? Math.abs(s[k] - first[k]) / first[k] : 0;
      if (d > out[k]) out[k] = d;
    }
  }
  return out;
}
