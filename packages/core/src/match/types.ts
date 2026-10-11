// Tipos del motor de partido. La entrada (`MatchInput`) es una instantánea completa: con
// la misma entrada y el mismo `seedPath` el motor produce exactamente el mismo partido.

import type { Position } from "../config/attributes";
import type { PlayerId, TeamId } from "../types/ids";

export type {
  FormationId, Tactics, SetPieces, PlayerInstruction, InstructionKey, TacticsPlan, CornerRoutine, CornerCrowd,
  FreeKickRoutine, ThrowInRoutine, KickoffRoutine,
} from "../types/tactics";
import type { InstructionKey, Tactics } from "../types/tactics";

/** Habilidades que usa el motor (1–20), ya combinadas a partir de los atributos. */
export interface Skills {
  passing: number;
  vision: number;
  firstTouch: number;
  technique: number;
  dribbling: number;
  crossing: number;
  finishing: number;
  longShots: number;
  heading: number;
  aerial: number;
  tackling: number;
  marking: number;
  positioning: number;
  anticipation: number;
  composure: number;
  decisions: number;
  pace: number;
  agility: number;
  strength: number;
  stamina: number;
  workRate: number;
  aggression: number;
  penalties: number;
  freeKicks: number;
  keeping: number;
  oneOnOnes: number;
  naturalFitness: number;
}

export interface SheetPlayer {
  id: PlayerId;
  /** Posición natural. */
  position: Position;
  /** Familiaridad con el puesto que ocupa en el once (0..1); en el banquillo, 1. */
  familiarity: number;
  /** Forma física al empezar (0..1). */
  fitness: number;
  skills: Skills;
  /** Ocultos relevantes (1–20). */
  consistency: number;
  bigMatches: number;
  pressure: number;
  injuryProneness: number;
  temperament: number;
  /** −1..1 */
  morale: number;
  /** CA en su posición natural (para decidir cambios). */
  ability: number;
  /**
   * Instrucciones que le dio el técnico y probabilidad de que las cumpla en este partido
   * (sale de su carácter y de la autoridad del técnico; nunca se muestra como número).
   */
  instructions: { key: InstructionKey; compliance: number }[];
}

export interface TeamSheet {
  team: TeamId;
  tactics: Tactics;
  /** Once inicial en el orden de los puestos de la formación. */
  xi: SheetPlayer[];
  bench: SheetPlayer[];
}

export interface MatchInput {
  /** Ruta del stream RNG del partido (`match/<id>`). */
  seedPath: string;
  home: TeamSheet;
  away: TeamSheet;
  neutral: boolean;
  /** Hay que decidir un ganador (prórroga y penaltis si hace falta). */
  decisive: boolean;
  /** Goles previos de la eliminatoria [local de este partido, visitante]. */
  aggregate?: [number, number];
  /** 0..1 importancia (finales, derbis): activa el rasgo de partidos grandes. */
  importance: number;
  /** Rigor del árbitro (1–20). */
  refStrictness: number;
}

export type Side = 0 | 1;

export type MatchEventType =
  | "kickoff"
  | "goal"
  | "ownGoal"
  | "shotSaved"
  | "shotOff"
  | "shotBlocked"
  | "woodwork"
  | "foul"
  | "penaltyAwarded"
  | "yellow"
  | "red"
  | "corner"
  | "sub"
  | "injury"
  | "halfTime"
  | "fullTime"
  | "extraTime"
  | "shootout"
  | "penaltyScored"
  | "penaltyMissed";

export type GoalKind = "open" | "header" | "penalty" | "freeKick" | "longShot" | "rebound" | "ownGoal";

export interface MatchEvent {
  /** Segundo del reloj del partido (la 2.ª parte empieza en 2700). */
  t: number;
  /** Minuto mostrado (1..120) y añadido (45+2 → minute 45, added 2). */
  minute: number;
  added: number;
  side: Side;
  type: MatchEventType;
  player?: PlayerId;
  /** Asistente, jugador que entra, jugador que comete la falta… */
  other?: PlayerId;
  /** Detalle codificado (tipo de gol, segunda amarilla, días de lesión…). */
  detail?: string;
  /** Puesto (0..10) afectado en cambios y expulsiones, para el visor. */
  slot?: number;
}

export interface TeamStats {
  shots: number;
  onTarget: number;
  xg: number;
  /** Segundos con el balón. */
  possession: number;
  passes: number;
  passesCompleted: number;
  tackles: number;
  fouls: number;
  corners: number;
  yellow: number;
  red: number;
}

export interface PlayerLine {
  id: PlayerId;
  side: Side;
  started: boolean;
  minutes: number;
  rating: number;
  goals: number;
  assists: number;
  yellow: number;
  red: boolean;
  /** Días de baja si se lesionó. */
  injuryDays?: number;
  /** Condición física al terminar (0..1). */
  condition: number;
}

/**
 * Fotogramas clave para el visor 2D: el motor ya decidió todo; el visor solo interpola.
 * Arrays planos para que pesen poco: `pos` tiene 44 valores por fotograma (x, y de los
 * 11 puestos del local y luego del visitante; −1 si el puesto quedó vacío).
 */
export interface Frames {
  /** Tiempo real acumulado (s) de cada fotograma. */
  t: number[];
  ball: number[];
  pos: number[];
  /** Equipo con el balón. */
  owner: Side[];
  /** Índice del evento que ocurre en ese fotograma, o −1. */
  event: number[];
  /** Eventos ya ocurridos al llegar a ese fotograma (para el registro del visor). */
  evCount: number[];
  /** Reloj del partido (s) en ese fotograma: la 2.ª parte empieza en 2700. */
  clock: number[];
}

/** Si el jugador siguió cada instrucción (consecuencia que se recuerda en el mundo). */
export interface InstructionOutcome {
  player: PlayerId;
  key: InstructionKey;
  followed: boolean;
}

export interface MatchReport {
  seedPath: string;
  score: [number, number];
  pens?: [number, number];
  extraTime: boolean;
  events: MatchEvent[];
  stats: [TeamStats, TeamStats];
  players: PlayerLine[];
  /** Ocupantes iniciales de los 11 puestos de cada equipo y formación usada. */
  lineups: [PlayerId[], PlayerId[]];
  tactics: [Tactics, Tactics];
  instructions: InstructionOutcome[];
  frames?: Frames;
}
