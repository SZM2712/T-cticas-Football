// Diales del desarrollo de jugadores (Fase 3, DISEÑO §4). Los ajusta la simulación de
// balance de 20 temporadas (`npm run sim -- --dev`, docs/balance/fase3.md).

import type { AttrKey } from "./attributes";
import type { Diet, Exercise, TrainingFocus } from "../types/development";

// ── Crecimiento ─────────────────────────────────────────────────────────────

/** CA que gana al mes un jugador joven ideal con mucho margen (antes de multiplicadores). */
export const MONTHLY_GROWTH = 0.26;
/** Margen (techo − CA) al que el crecimiento va a media velocidad. */
export const GAP_HALF = 1.2;
/** Dispersión log-normal de los meses buenos y malos. */
export const MONTH_LUCK_SD = 0.3;
/** Curva de crecimiento por edad (ajustada por la maduración): [edad, factor]. */
export const AGE_GROWTH_CURVE: readonly (readonly [number, number])[] = [
  [15, 1.1], [18, 1], [21, 0.72], [24, 0.36], [27, 0.1], [30, 0.03], [40, 0],
];
/** Atributos que no son relevantes para su puesto también crecen, pero menos. */
export const IRRELEVANT_GROWTH = 0.18;
/** Minutos recientes (con decaimiento ×0.5 al mes) que cuentan como "juega siempre". */
export const FULL_MINUTES = 620;
/** Minutos equivalentes mínimos de los jóvenes (≤ 21) por filial y cesiones implícitas (0..1). */
export const YOUTH_MINUTES_FLOOR = 0.45;

// ── Techo latente ───────────────────────────────────────────────────────────

/** Deriva mensual del techo por unidad de entorno por encima/debajo de la media. */
export const CEILING_DRIFT = 0.05;
/** Edades de la ventana crítica (el entorno pesa más). */
export const CRITICAL_WINDOW: readonly [number, number] = [16, 21];
export const CRITICAL_WINDOW_MULT = 1.8;
/**
 * Techo máximo absoluto. El techo puede quedar por debajo de la CA (jugador que ya tocó su
 * máximo): entonces no crece; los ojeadores nunca estiman un potencial por debajo de lo visto.
 */
export const MAX_CEILING = 20;

// ── Declive ─────────────────────────────────────────────────────────────────

/** Atributos físicos que más sufren con la edad. */
export const DECLINING_PHYSICAL: readonly AttrKey[] = ["pace", "acceleration", "stamina", "agility", "jumping", "naturalFitness", "balance"];
/** Pérdida mensual de un físico por año pasado el pico (× (1.25 − profesionalidad)). */
export const PHYSICAL_DECLINE = 0.022;
/** Edad a partir de la que la técnica empieza a bajar y pérdida mensual. */
export const TECHNICAL_DECLINE_AGE = 31;
export const TECHNICAL_DECLINE = 0.008;
/** Ganancia mensual de experiencia en atributos mentales (con minutos) entre 22 y 32 años. */
export const EXPERIENCE_GAIN = 0.006;
export const EXPERIENCE_ATTRS: readonly AttrKey[] = ["decisions", "composure", "anticipation", "positioning", "concentration", "leadership"];
/** Lesión larga (≥ días): secuelas en el techo y en la explosividad. */
export const SERIOUS_INJURY_DAYS = 60;

// ── Entrenamiento ───────────────────────────────────────────────────────────

/** Atributos que potencia cada foco de entrenamiento. */
export const FOCUS_ATTRS: Record<TrainingFocus, readonly AttrKey[]> = {
  balanced: [],
  technical: ["firstTouch", "technique", "shortPassing", "dribbling"],
  mental: ["decisions", "anticipation", "positioning", "concentration", "composure", "teamwork"],
  physical: ["strength", "stamina", "pace", "acceleration", "agility", "jumping"],
  finishing: ["finishing", "composure", "offTheBall", "heading"],
  creativity: ["vision", "longPassing", "flair", "technique"],
  defending: ["tackling", "marking", "positioning", "anticipation"],
  aerial: ["heading", "jumping", "strength", "bravery"],
  goalkeeping: ["reflexes", "handling", "oneOnOnes", "aerialReach", "gkPositioning", "kicking"],
  setPieces: ["freeKicks", "penalties", "crossing", "longShots"],
};
/** Multiplicador del peso de los atributos del foco (× adherencia). */
export const FOCUS_BOOST = 1.6;
/** Intensidad: crecimiento, riesgo de lesión (puntos de propensión 1–20) y recuperación. */
export const INTENSITY = {
  low: { growth: 0.85, injury: -2, recovery: 1.1 },
  normal: { growth: 1, injury: 0, recovery: 1 },
  high: { growth: 1.15, injury: 3, recovery: 0.9 },
} as const;

// ── Dieta, ejercicio y sueño (× adherencia × calidad del staff) ─────────────

export const DIET_EFFECTS: Record<Diet, { attrs: Partial<Record<AttrKey, number>>; weightKg: number; recovery: number; injury: number }> = {
  standard: { attrs: {}, weightKg: 0, recovery: 1, injury: 0 },
  leanMass: { attrs: { strength: 0.035, pace: -0.004 }, weightKg: 0.25, recovery: 1, injury: 0 },
  weightLoss: { attrs: { pace: 0.012, acceleration: 0.012, agility: 0.012, strength: -0.01 }, weightKg: -0.3, recovery: 1, injury: 0 },
  recovery: { attrs: {}, weightKg: 0, recovery: 1.15, injury: -1.5 },
};
export const EXERCISE_EFFECTS: Record<Exercise, { attrs: Partial<Record<AttrKey, number>>; injury: number }> = {
  none: { attrs: {}, injury: 0 },
  strength: { attrs: { strength: 0.03, jumping: 0.008 }, injury: 0.5 },
  speed: { attrs: { pace: 0.02, acceleration: 0.022 }, injury: 1 },
  endurance: { attrs: { stamina: 0.03, naturalFitness: 0.01 }, injury: 0 },
  mobility: { attrs: { agility: 0.015, balance: 0.015 }, injury: -2 },
};
/** Rutina extra con intensidad alta: sobrecarga (puntos de propensión). */
export const OVERLOAD_INJURY = 2;
/** Rutina de sueño cumplida: recuperación y regularidad. */
export const SLEEP_RECOVERY = 1.12;
export const SLEEP_CONSISTENCY = 0.02;

// ── Adherencia al plan ──────────────────────────────────────────────────────

/** Puntuación base de adherencia y peso de cada factor (rasgos 0..1). */
export const ADHERENCE = {
  base: 0.42,
  professionalism: 0.42,
  growthMindset: 0.18,
  authority: 0.15,
  staff: 0.12,
  /** Vida fuera del campo: resta sobre todo en sueño y dieta. */
  offPitch: { training: 0.1, diet: 0.35, exercise: 0.12, sleep: 0.5 },
  /** El ego resta cuando el plan es exigente (intensidad alta o rutina extra). */
  egoDemanding: 0.2,
} as const;
/** Valor de cada nivel de adherencia en los efectos del plan. */
export const ADHERENCE_VALUE = { full: 1, partial: 0.5, none: 0 } as const;

// ── Mentoría ────────────────────────────────────────────────────────────────

/** Fracción de la diferencia mentor − aprendiz que se transfiere al mes (× compatibilidad). */
export const MENTOR_TRANSFER = 0.012;
export const MENTOR_MIN_AGE = 26;
export const MENTOR_TRAITS = ["professionalism", "temperament", "competitiveness", "growthMindset"] as const;

// ── Cantera y retiradas (cierre de temporada) ───────────────────────────────

/** Probabilidad base de retirarse por edad: [edad, probabilidad]. */
export const RETIRE_CURVE: readonly (readonly [number, number])[] = [
  [30, 0], [32, 0.06], [33, 0.12], [34, 0.22], [35, 0.38], [36, 0.55], [37, 0.72], [38, 0.85], [40, 1],
];
/** Edades de los canteranos que suben cada verano. */
export const INTAKE_AGE: readonly [number, number] = [18, 20];
/** Nivel de los canteranos al subir respecto al club (sin contar la penalización por edad). */
export const INTAKE_OFFSET = -1.6;
/**
 * Techo de los canteranos: margen medio sobre su nivel de entrada = penalización por edad
 * hasta los 22 + este extra (× calidad de la cantera) y su dispersión. Es el dial
 * principal contra la inflación de talento.
 */
export const INTAKE_GAP_EXTRA = 0.25;
export const INTAKE_GAP_SD = 1.1;
/** Canteranos extra por club jugable al año (además de cubrir bajas). */
export const INTAKE_EXTRA = 1;
/** Tamaño máximo de plantilla: los más flojos sin minutos salen del club (agentes libres). */
export const SQUAD_MAX = 34;

// ── Ojeadores ───────────────────────────────────────────────────────────────

/** Varianza inicial de la creencia sobre el techo y error de observación base. */
export const SCOUT_PRIOR_VAR = 4;
export const SCOUT_OBS_SD = 2.2;
/** Mejora del error por punto de juzgar potencial por encima de 10 (y mínimo). */
export const SCOUT_SKILL_K = 0.09;
export const SCOUT_MIN_SD = 0.6;
/** Jugadores ajenos que observa cada ojeador al mes y máximo de fichas guardadas. */
export const SCOUT_EXTRA_PER_MONTH = 6;
export const SCOUT_MAX_BELIEFS = 160;
