// Clasificaciones calculadas a partir de los partidos (no se guardan).

import type { Match, World } from "../types/domain";
import type { TeamId } from "../types/ids";

export interface TableRow {
  team: TeamId;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  points: number;
}

export const goalDiff = (r: TableRow): number => r.gf - r.ga;

/** Orden: puntos, diferencia de goles, goles a favor, siembra original (determinista). */
export function compareRows(a: TableRow, b: TableRow, seed: Map<TeamId, number>): number {
  return (
    b.points - a.points ||
    goalDiff(b) - goalDiff(a) ||
    b.gf - a.gf ||
    (seed.get(a.team) ?? 0) - (seed.get(b.team) ?? 0)
  );
}

/** Comparación entre grupos de distinto tamaño (mejores terceros): por partido jugado. */
export function compareRowsPerGame(a: TableRow, b: TableRow, seed: Map<TeamId, number>): number {
  const pa = a.played || 1;
  const pb = b.played || 1;
  return (
    b.points / pb - a.points / pa ||
    goalDiff(b) / pb - goalDiff(a) / pa ||
    b.gf / pb - a.gf / pa ||
    (seed.get(a.team) ?? 0) - (seed.get(b.team) ?? 0)
  );
}

export function emptyRow(team: TeamId): TableRow {
  return { team, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 };
}

export function addResult(rows: Map<TeamId, TableRow>, m: Match): void {
  if (!m.result) return;
  const h = rows.get(m.home);
  const a = rows.get(m.away);
  if (!h || !a) return;
  const { home, away } = m.result;
  h.played++;
  a.played++;
  h.gf += home;
  h.ga += away;
  a.gf += away;
  a.ga += home;
  if (home > away) {
    h.won++;
    h.points += 3;
    a.lost++;
  } else if (home < away) {
    a.won++;
    a.points += 3;
    h.lost++;
  } else {
    h.drawn++;
    a.drawn++;
    h.points++;
    a.points++;
  }
}

/** Tabla de un grupo (o de la tabla única) de una fase de liga/grupos. */
export function groupTable(world: World, competitionId: string, stage: number, teams: readonly TeamId[]): TableRow[] {
  const comp = world.competitions[competitionId]!;
  const st = comp.stages[stage]!;
  const rows = new Map<TeamId, TableRow>(teams.map((t) => [t, emptyRow(t)]));
  for (const round of st.rounds) {
    for (const id of round.matchIds) {
      const m = world.matches[id];
      if (m) addResult(rows, m);
    }
  }
  const seed = new Map<TeamId, number>(comp.participants.map((t, i) => [t, i]));
  return [...rows.values()].sort((a, b) => compareRows(a, b, seed));
}
