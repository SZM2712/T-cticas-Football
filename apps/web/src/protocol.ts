// Protocolo entre la UI y el Worker que hospeda el juego. La UI pide vistas y envía
// comandos; nunca toca el estado del mundo (regla 3 de CLAUDE.md).

import type {
  ClubOptionView, Command, CommandResult, CommitmentView, GossipView, CompetitionId, DressingRoomView, FixtureView, InboxItemView, Intervention, LeagueOption,
  ManagerView, MatchChange, MatchId, MatchReport, PlayerDevelopmentView, PlayerSocialView, Position, ScorerView, SquadRowView,
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
  /** Partido en directo aún sin cerrar: el usuario puede pausar e intervenir. */
  live: boolean;
  /** Equipo que dirige el usuario en este partido (0 local, 1 visitante) o null si solo mira. */
  side: 0 | 1 | null;
  /** Convocados de cada equipo (once + banquillo) con su posición natural. */
  squads: [{ id: string; position: Position; bench: boolean }[], { id: string; position: Position; bench: boolean }[]];
  interventions: Intervention[];
}

export interface Api {
  newGame(args: { seed: string; real: boolean }): Summary;
  summary(args: object): Summary;
  advance(args: { days: number }): Summary;
  /** Avanza hasta el próximo partido del equipo (incluido). */
  advanceToMatch(args: { team: TeamId }): Summary;
  /** Avanza hasta el día del partido y lo deja listo para jugarlo en directo. */
  startLive(args: { match: MatchId; team: TeamId | null }): WatchedMatch | null;
  /** Intervención en una pausa del partido en directo. */
  intervene(args: { step: number; side: 0 | 1; change: MatchChange }): { ok: true; match: WatchedMatch } | { ok: false; error: string };
  /** Cierra el partido en directo: su resultado pasa al mundo. */
  finishLive(args: object): WatchedMatch | null;
  /** Último partido visto (para repetirlo sin volver a simularlo). */
  lastWatched(args: object): WatchedMatch | null;
  leagues(args: object): LeagueOption[];
  table(args: { competition: CompetitionId }): TableRowView[];
  results(args: { competition: CompetitionId }): FixtureView[];
  scorers(args: { competition: CompetitionId }): ScorerView[];
  squad(args: { team: TeamId; competition?: CompetitionId }): SquadRowView[];
  fixtures(args: { team: TeamId }): { past: FixtureView[]; next: FixtureView[] };
  tactics(args: { team: TeamId }): TacticsView;
  /** Ficha de desarrollo de un jugador (evolución, por qué, plan, ojeadores). */
  player(args: { id: string }): PlayerDevelopmentView;
  /** Vestuario del club (vacío si no lo dirige un humano). */
  dressing(args: { team: TeamId }): DressingRoomView;
  inbox(args: { team: TeamId }): InboxItemView[];
  commitments(args: { team: TeamId }): CommitmentView[];
  /** Lo que se comenta en el vestuario (rumores recientes). */
  gossip(args: { team: TeamId }): GossipView[];
  /** Vida social de un jugador: relaciones, recuerdos, promesas y conversación. */
  playerSocial(args: { id: string }): PlayerSocialView;
  managers(args: object): ManagerView[];
  /** Clubes de una liga para elegir club al empezar. */
  clubs(args: { league: string }): ClubOptionView[];
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
