// Protocolo entre la UI y el Worker que hospeda el juego. La UI pide vistas y envía
// comandos; nunca toca el estado del mundo (regla 3 de CLAUDE.md).

import type {
  Command, CommandResult, CompetitionId, FixtureView, LeagueOption, MatchId, MatchReport, ScorerView, SquadRowView,
  TableRowView, TacticsView, TeamId,
} from "@tf/core";

export interface Summary {
  seed: string;
  today: number;
  season: number;
  real: boolean;
  /** Partidos jugados desde el inicio. */
  played: number;
}

export interface WatchedMatch {
  fixture: FixtureView;
  report: MatchReport;
  engine: "full" | "quick";
  /** Nombres de los jugadores que aparecen en el informe. */
  names: Record<string, string>;
  colors: [string, string];
}

export interface Api {
  newGame(args: { seed: string; real: boolean }): Summary;
  summary(args: object): Summary;
  advance(args: { days: number }): Summary;
  /** Avanza hasta el próximo partido del equipo (incluido). */
  advanceToMatch(args: { team: TeamId }): Summary;
  /** Avanza hasta el partido y lo juega con fotogramas para el visor. */
  watch(args: { match: MatchId }): WatchedMatch | null;
  /** Último partido visto (para repetirlo sin volver a simularlo). */
  lastWatched(args: object): WatchedMatch | null;
  leagues(args: object): LeagueOption[];
  table(args: { competition: CompetitionId }): TableRowView[];
  results(args: { competition: CompetitionId }): FixtureView[];
  scorers(args: { competition: CompetitionId }): ScorerView[];
  squad(args: { team: TeamId; competition?: CompetitionId }): SquadRowView[];
  fixtures(args: { team: TeamId }): { past: FixtureView[]; next: FixtureView[] };
  tactics(args: { team: TeamId }): TacticsView;
  command(args: { cmd: Command }): CommandResult;
  /** Huella del mundo (para comprobar el determinismo navegador = Node). */
  hash(args: object): string;
}

export type Method = keyof Api;
export interface Request<M extends Method = Method> {
  id: number;
  method: M;
  args: Parameters<Api[M]>[0];
}
export type Response = { id: number; ok: true; data: unknown } | { id: number; ok: false; error: string };
