// Medios, redes y disciplina (Fase 5, DISEÑO §6 y §11.4). Todo es dato plano serializable.
// El núcleo guarda claves y parámetros; la UI redacta (regla 4). Ningún parámetro de una
// publicación es un rasgo oculto (regla 6).

import type { ClubId, CompetitionId, GameDay, MatchId, PlayerId, StaffId } from "./ids";
import type { ManagerId } from "./social";

// ── Narrativas ──────────────────────────────────────────────────────────────

export const NARRATIVE_KINDS = [
  "newManager", "winningStreak", "losingStreak", "goalDrought", "brokenPromise", "egoPublic", "transferRequest",
  "injuryBlow", "prodigy", "breakthrough", "retirementRumour", "refereeRow", "dividedSquad", "hypocrisy",
  "disciplinary", "topScorer", "captaincy",
] as const;
export type NarrativeKind = (typeof NARRATIVE_KINDS)[number];

/** De quién o de qué trata algo que se publica o se pregunta. */
export type MediaSubject =
  | { kind: "club"; id: ClubId }
  | { kind: "player"; id: PlayerId }
  | { kind: "manager"; id: ManagerId }
  | { kind: "referee"; id: StaffId }
  | { kind: "match"; id: MatchId };

/** Historia viva sobre un club dirigido por un humano: el tablero del que salen preguntas y titulares. */
export interface Narrative {
  id: string;
  kind: NarrativeKind;
  club: ClubId;
  /** Protagonista (jugador, mánager, árbitro…) o el propio club. */
  subject: MediaSubject;
  /** Relevancia 0..1: sube con cada hecho nuevo y se enfría con los días. */
  heat: number;
  /** Hechos que la sostienen (referencias a eventos del mundo y a lo que se dijo: "ev:123", "press:…"). */
  facts: string[];
  openedDay: GameDay;
  lastFedDay: GameDay;
  /** Número que la UI puede contar (partidos de la racha, goles…). Nunca un rasgo oculto. */
  count?: number;
  resolvedDay?: GameDay;
}

// ── Periodistas y medios ────────────────────────────────────────────────────

export const OUTLET_KINDS = ["newspaper", "radio", "tv", "forum"] as const;
export type OutletKind = (typeof OUTLET_KINDS)[number];

/** Periodista ficticio con línea editorial y memoria (la relación con cada mánager). */
export interface Journalist {
  id: string;
  firstName: string;
  lastName: string;
  nation: string;
  outlet: OutletKind;
  /** Ciudad del medio (para su nombre genérico) y club de la ciudad al que es afín, si lo hay. */
  city: string;
  favours?: ClubId;
  /** Línea editorial 0..1: gusto por el escándalo, rigor y agresividad al preguntar. */
  sensationalism: number;
  rigor: number;
  aggression: number;
  /** Alcance del medio 0..1. */
  reach: number;
}

// ── Ruedas de prensa ────────────────────────────────────────────────────────

export const ANSWER_INTENTS = [
  "praisePlayer", "backPlayer", "criticizePlayer", "blamePlayers", "takeBlame", "calm", "promiseImprovement",
  "promisePlayingTime", "criticizeReferee", "acceptDecision", "deny", "confirm", "noComment", "humble", "ambitious",
] as const;
export type AnswerIntent = (typeof ANSWER_INTENTS)[number];

export const ANSWER_TONES = ["calm", "firm", "combative"] as const;
export type AnswerTone = (typeof ANSWER_TONES)[number];

export interface PressQuestion {
  journalist: string;
  /** Narrativa de la que sale, o ninguna si es la pregunta del partido. */
  narrative?: string;
  /** Plantilla de la pregunta (la UI la redacta con los parámetros). */
  templateId: string;
  subject: MediaSubject;
  /** Respuestas posibles (intenciones) para esta pregunta. */
  intents: AnswerIntent[];
  /** Pregunta incisiva: el periodista aprieta. */
  pointed: boolean;
  answer?: { intent: AnswerIntent; tone: AnswerTone; by: "manager" | "assistant"; reaction: string };
}

export interface PressConference {
  id: string;
  club: ClubId;
  manager: ManagerId;
  kind: "preMatch" | "postMatch";
  match: MatchId;
  day: GameDay;
  /** Si no respondes antes de que acabe este día, responde tu asistente con tus directrices. */
  deadline: GameDay;
  questions: PressQuestion[];
  status: "pending" | "answered" | "delegated";
}

/** Directrices para el asistente cuando atiende a la prensa por ti. */
export interface PressDirectives {
  refereeCriticism: boolean;
  criticizePlayers: boolean;
  promises: boolean;
  tone: AnswerTone;
}

/** Algo que el mánager dijo en público (para detectar contradicciones). */
export interface Statement {
  day: GameDay;
  manager: ManagerId;
  /** Tema y sujeto ("player:pl_000012", "transfer:pl_000012", "referee:st_000044"). */
  topic: string;
  /** Postura: +1 a favor, −1 en contra. */
  stance: 1 | -1;
  /** De dónde salió ("press:pc_00012:1" o "post:ps_000123"). */
  source: string;
}

// ── Redes y publicaciones ──────────────────────────────────────────────────

export const PLATFORMS = ["shortMessages", "photos", "newspaper", "radioTv", "fanForum"] as const;
export type Platform = (typeof PLATFORMS)[number];

export type PostAuthor =
  | { kind: "journalist"; id: string }
  | { kind: "player"; id: PlayerId }
  | { kind: "manager"; id: ManagerId }
  | { kind: "fans"; club: ClubId; segment: "ultras" | "members" | "casual" | "international" }
  | { kind: "refereeCollective"; nation: string };

/** Alcance cualitativo (nunca un número). */
export type Reach = "low" | "medium" | "viral";

export interface Post {
  id: string;
  day: GameDay;
  platform: Platform;
  author: PostAuthor;
  /** Clave de texto ("post.article.losingStreak.neg"…) y sus parámetros visibles. */
  key: string;
  params: Record<string, string | number>;
  subjects: MediaSubject[];
  /** A favor (+1), en contra (−1) o neutra (0) respecto al protagonista. */
  sentiment: -1 | 0 | 1;
  reach: Reach;
  club: ClubId;
}

// ── Árbitros, polémicas y disciplina ───────────────────────────────────────

export const CONTROVERSY_KINDS = ["penaltyGiven", "penaltyDenied", "redCard", "offsideGoal"] as const;
export type ControversyKind = (typeof CONTROVERSY_KINDS)[number];
export type Clarity = "clear" | "debatable" | "marginal";

/** Decisión arbitral discutible registrada con su evidencia (no cambia el resultado). */
export interface Controversy {
  minute: number;
  kind: ControversyKind;
  /** Lado perjudicado por la decisión (0 local, 1 visitante). */
  harmed: 0 | 1;
  player?: PlayerId;
  /** Lo clara que era la jugada vista después. */
  clarity: Clarity;
  /** Si el árbitro acertó (lo que muestran las imágenes). */
  correct: boolean;
}

/** Memoria del colectivo arbitral respecto a un club (nunca sesga lo que pita). */
export interface RefereeMemory {
  /** Tensión 0..1 con el árbitro: sube con las críticas, baja con el tiempo y las disculpas. */
  tension: number;
  criticisms: number;
  /** Veces que una decisión suya perjudicó a este club (para la viralidad). */
  harmed: number;
}

export const CASE_KINDS = ["refereeCriticism", "violentConduct", "protests", "socialPost"] as const;
export type CaseKind = (typeof CASE_KINDS)[number];
export const ALLEGATIONS = ["accept", "contest", "apologize"] as const;
export type Allegation = (typeof ALLEGATIONS)[number];

export interface Sanction {
  kind: "fine" | "touchlineBan" | "playerBan" | "stadiumClosure";
  /** Multa en euros. */
  amount?: number;
  /** Partidos (sin banquillo, de sanción o con el estadio cerrado parcialmente). */
  matches?: number;
}

/** Expediente del comité de disciplina: acta → expediente → alegaciones → sanción → recurso. */
export interface DisciplinaryCase {
  id: string;
  club: ClubId;
  kind: CaseKind;
  /** A quién se expedienta. */
  subject: MediaSubject;
  referee?: StaffId;
  match?: MatchId;
  competition?: CompetitionId;
  /** Hechos enlazados: nunca hay sanción sin ellos. */
  facts: string[];
  /** Gravedad 0..1 según los hechos (decide la sanción base). */
  gravity: number;
  openedDay: GameDay;
  /** Fin del plazo actual (alegaciones o recurso). */
  deadline: GameDay;
  status: "allegations" | "sanctioned" | "appealed" | "closed" | "dismissed";
  allegation?: Allegation;
  /** Sanciones impuestas (puede haber multa y partidos a la vez). */
  sanctions?: Sanction[];
  appeal?: { day: GameDay; outcome: "upheld" | "reduced" | "annulled" };
}

/** Estado de los medios del mundo (solo hay actividad alrededor de clubes dirigidos por humanos). */
export interface MediaState {
  journalists: Record<string, Journalist>;
  /** Relación periodista–mánager (−1..1), clave "periodista|mánager". */
  relations: Record<string, number>;
  narratives: Record<string, Narrative>;
  conferences: Record<string, PressConference>;
  /** Plantilla + sujeto + temporada → último día en que se preguntó (anti-repetición). */
  asked: Record<string, GameDay>;
  posts: Post[];
  statements: Statement[];
  directives: Record<string, PressDirectives>;
  /** Clave "árbitro|club". */
  referees: Record<string, RefereeMemory>;
  controversies: Record<string, Controversy[]>;
  cases: Record<string, DisciplinaryCase>;
  /** Sanciones de banquillo pendientes por mánager (partidos). */
  touchlineBans: Record<string, number>;
  /** Partidos con el estadio parcialmente cerrado pendientes por club. */
  stadiumClosures: Record<string, number>;
  /** Últimos resultados oficiales de cada club dirigido por un humano ("W", "D", "L"; el último al final). */
  form: Record<string, string>;
  /** Goles de cada jugador en sus últimos partidos como titular (el último al final). */
  scoring: Record<string, number[]>;
  /** Primer evento del mundo aún no leído por los medios. */
  cursor: number;
}
