// Plan individual de desarrollo que el técnico propone a un jugador con su staff
// (entrenadores, preparador físico, nutricionista y servicio médico). El jugador decide
// cada mes si lo sigue: su adherencia depende de su carácter y de la autoridad del técnico.

import type { GameDay, PlayerId } from "./ids";

/** Foco del entrenamiento individual (a qué atributos van los progresos). */
export const TRAINING_FOCUSES = [
  "balanced", "technical", "mental", "physical", "finishing", "creativity", "defending", "aerial", "goalkeeping", "setPieces",
] as const;
export type TrainingFocus = (typeof TRAINING_FOCUSES)[number];

export const INTENSITIES = ["low", "normal", "high"] as const;
export type Intensity = (typeof INTENSITIES)[number];

/** Dieta pautada por el nutricionista. */
export const DIETS = ["standard", "leanMass", "weightLoss", "recovery"] as const;
export type Diet = (typeof DIETS)[number];

/** Rutina extra de ejercicio con el preparador físico. */
export const EXERCISES = ["none", "strength", "speed", "endurance", "mobility"] as const;
export type Exercise = (typeof EXERCISES)[number];

/** Pauta de descanso: libre o rutina de sueño supervisada. */
export const SLEEP_PLANS = ["free", "routine"] as const;
export type SleepPlan = (typeof SLEEP_PLANS)[number];

export interface DevelopmentPlan {
  focus: TrainingFocus;
  intensity: Intensity;
  diet: Diet;
  exercise: Exercise;
  sleep: SleepPlan;
  /** Veterano de la plantilla que lo apadrina (mentoría). */
  mentor?: PlayerId;
}

/** Lo que el jugador hizo con cada parte del plan el último mes (observable, no oculto). */
export type Adherence = "full" | "partial" | "none";
export interface PlanAdherence {
  training: Adherence;
  diet: Adherence;
  exercise: Adherence;
  sleep: Adherence;
}

/** Factor que explica la evolución del último periodo (informe «¿por qué?»). */
export interface DevFactor {
  key: string;
  /** Contribución con signo (en décimas de CA aproximadas); la UI solo muestra su sentido e intensidad. */
  value: number;
}

/** Creencia de un ojeador sobre un jugador (filtro de Kalman 1D sobre el techo latente). */
export interface ScoutBelief {
  /** Techo estimado y su varianza. */
  mu: number;
  v: number;
  /** Nivel actual estimado. */
  ca: number;
  day: GameDay;
  /** Observaciones acumuladas. */
  n: number;
}

/** Motivo por el que un jugador se plantea retirarse. */
export type RetirementReason = "injury" | "personal" | "age";
/** Cómo intenta convencerle el técnico: lo que significa para el club, un papel importante, apoyo, o aceptarlo. */
export const PERSUASION_APPROACHES = ["club", "role", "support", "accept"] as const;
export type PersuasionApproach = (typeof PERSUASION_APPROACHES)[number];

export interface RetirementIntent {
  reason: RetirementReason;
  since: GameDay;
  /** Día en que tomará la decisión. */
  decideBy: GameDay;
  /** Lo que intentó el técnico (una sola vez). */
  persuasion?: PersuasionApproach;
}
