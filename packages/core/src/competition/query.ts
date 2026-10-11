// Consultas de solo lectura sobre el mundo, compartidas por varios módulos.

import type { Club, Competition, League, World } from "../types/domain";

export function leaguesOf(world: World, nation: string): [League, League] {
  const ls = Object.values(world.leagues).filter((l) => l.nation === nation).sort((a, b) => a.tier - b.tier);
  return [ls[0]!, ls[1]!];
}

export function shadowTier3(world: World, nation: string): Club[] {
  return Object.values(world.clubs).filter((c) => c.nation === nation && c.shadowTier === 3);
}

export function findCompetition(world: World, pred: (c: Competition) => boolean): Competition | undefined {
  return Object.values(world.competitions).find(pred);
}
