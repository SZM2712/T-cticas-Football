// Táctica de un equipo: sistema, estilo, balón parado e instrucciones individuales.
// `Tactics` es la táctica completa que usa el motor; `TacticsPlan` es lo que fija el
// usuario para su equipo (lo que no fija lo decide la IA).

import type { PlayerId } from "./ids";

export type FormationId = "4-4-2" | "4-3-3" | "4-2-3-1" | "3-5-2" | "5-3-2" | "4-1-4-1";

/** Córner: al primer palo, al segundo, en corto o atrás al borde del área. */
export type CornerRoutine = "nearPost" | "farPost" | "short" | "edgeOfBox";
/** Cuántos suben al remate en los córners (más remate, más riesgo de contra). */
export type CornerCrowd = "stay" | "some" | "all";
/** Falta en zona de disparo: a puerta, centrada al área o en corto. */
export type FreeKickRoutine = "shoot" | "cross" | "short";
/** Saque de banda en campo rival: corto (conservar) o largo al área. */
export type ThrowInRoutine = "short" | "long";
/** Saque inicial (al empezar y tras el descanso): elaborar desde atrás o balón largo. */
export type KickoffRoutine = "buildUp" | "long";

export interface SetPieces {
  /** Orden de lanzadores de penalti; si ninguno está en el campo, el mejor disponible. */
  penaltyTakers: PlayerId[];
  freeKickTaker: PlayerId | null;
  cornerTaker: PlayerId | null;
  /** Lanzador de saques de banda largos. */
  throwInTaker: PlayerId | null;
  corners: CornerRoutine;
  cornerCrowd: CornerCrowd;
  freeKicks: FreeKickRoutine;
  throwIns: ThrowInRoutine;
  kickoff: KickoffRoutine;
}

export const INSTRUCTION_KEYS = [
  "shootMore", "shootLess", "dribbleMore", "dribbleLess", "crossMore", "passShort", "passLong",
  "getForward", "stayBack", "pressMore", "pressLess", "tackleHarder", "stayOnFeet",
] as const;
export type InstructionKey = (typeof INSTRUCTION_KEYS)[number];

/** Instrucción a un jugador concreto. Puede no cumplirla (ego, carácter, autoridad del técnico). */
export interface PlayerInstruction {
  player: PlayerId;
  key: InstructionKey;
}

export interface Tactics {
  formation: FormationId;
  /** −1 (muy defensiva) … +1 (muy ofensiva). */
  mentality: number;
  /** 0..1 intensidad de la presión. */
  pressing: number;
  /** 0..1 ritmo: más acciones y más riesgo. */
  tempo: number;
  /** 0..1 amplitud en ataque. */
  width: number;
  /** 0..1 juego directo (balones largos). */
  directness: number;
  setPieces: SetPieces;
  instructions: PlayerInstruction[];
}

/** Plan táctico guardado para un equipo (World.tactics). Lo que falta lo decide la IA. */
export interface TacticsPlan {
  formation?: FormationId;
  /** Once en el orden de los puestos de la formación; los no disponibles los cubre la IA. */
  lineup?: PlayerId[];
  mentality?: number;
  pressing?: number;
  tempo?: number;
  width?: number;
  directness?: number;
  setPieces?: Partial<SetPieces>;
  instructions?: PlayerInstruction[];
}
