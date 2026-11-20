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
export const MONTH_LUCK_SD = 0.2;
/** Curva de crecimiento por edad (ajustada por la maduración): [edad, factor]. */
export const AGE_GROWTH_CURVE: readonly (readonly [number, number])[] = [
  [15, 1.1], [18, 1], [21, 0.85], [24, 0.45], [27, 0.12], [30, 0.03], [40, 0],
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
/** Ruido mensual del techo como fracción de la volatilidad anual (/√12). */
export const CEILING_NOISE = 0.4;
/** Edades de la ventana crítica (el entorno pesa más). */
export const CRITICAL_WINDOW: readonly [number, number] = [16, 21];
export const CRITICAL_WINDOW_MULT = 1.8;
/** Fuera de la ventana crítica el entorno apenas mueve el techo (el adulto alcanza su techo, no lo crea). */
export const ADULT_DRIFT_MULT = 0;
/**
 * Techo máximo absoluto. El techo puede quedar por debajo de la CA (jugador que ya tocó su
 * máximo): entonces no crece; los ojeadores nunca estiman un potencial por debajo de lo visto.
 */
export const MAX_CEILING = 20;

// ── Encaje: táctica, mánager, cultura y vestuario ───────────────────────────
/**
 * El encaje total (−1..1, `social/fit.ts`) entra en el entorno que mueve el techo y en el
 * ritmo de crecimiento: un jugador en su puesto, con un técnico que confía en él y a gusto en
 * el vestuario progresa más; uno descolocado o enfrentado con el mánager se estanca.
 */
export const FIT_ENV_WEIGHT = 0.3;
/**
 * Peso de cada parte del encaje en el desarrollo: aquí mandan la táctica (jugar en su sitio) y
 * el mánager (que confíe en él); en el partido pesa más lo cultural y social (`config/social.ts`).
 * Sin mánager humano la parte del mánager es neutra.
 */
export const DEV_FIT_WEIGHTS = { tactical: 0.4, manager: 0.35, social: 0.15, cultural: 0.1 } as const;
/** Multiplicador del crecimiento mensual: × (1 + FIT_GROWTH × encaje). */
export const FIT_GROWTH = 0.25;
/**
 * Prodigios: su techo es una promesa, no un destino. Un buen entorno la sostiene (no la agranda);
 * uno malo la erosiona PRODIGY_DRIFT_MULT veces más deprisa que a un canterano normal. Cuentan sus
 * minutos reales (sin el suelo de filial): un prodigio sin minutos, mal encajado o poco
 * profesional se queda por el camino.
 */
export const PRODIGY_DRIFT_MULT = 8;
/** La cabeza del prodigio: su profesionalidad (0..1, centrada en 0,5) suma o resta al entorno. */
export const PRODIGY_ATTITUDE = 0.4;
/** Edad hasta la que un prodigio sigue dependiendo así del entorno. */
export const PRODIGY_MAX_AGE = 23;
/**
 * Florecimiento tardío: entre LATE_BLOOM_AGE, un jugador que aún no es de élite, que juega casi
 * siempre (minutos ≥ LATE_BLOOM_MINUTES) y encaja con la táctica y el técnico claramente mejor que
 * la media (encaje − media > LATE_BLOOM_MIN_FIT) puede subir su techo (solo hacia arriba) hasta
 * LATE_BLOOM_HEADROOM por encima de su nivel y crecer aunque su edad ya no ayude.
 */
export const LATE_BLOOM_AGE: readonly [number, number] = [22, 32];
export const LATE_BLOOM_MAX_CA = 15;
export const LATE_BLOOM_MINUTES = 0.7;
export const LATE_BLOOM_MIN_FIT = 0.1;
/** Encaje (sobre el umbral) con el que el florecimiento es pleno. */
export const LATE_BLOOM_FULL = 0.2;
/** Techo que gana al mes con florecimiento pleno (× mentalidad de crecimiento). */
export const LATE_BLOOM_DRIFT = 0.06;
export const LATE_BLOOM_HEADROOM = 1.2;
/** Curva de edad mínima para un adulto que florece: × intensidad del florecimiento (0..1). */
export const LATE_BLOOM_AGE_FACTOR = 0.5;

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
export const INTAKE_OFFSET = -0.6;
/**
 * Techo de los canteranos: margen medio sobre su nivel de entrada = penalización por edad
 * hasta los 22 + este extra (× calidad de la cantera) y su dispersión. Es el dial
 * principal contra la inflación de talento.
 */
export const INTAKE_GAP_EXTRA = 0.25;
export const INTAKE_GAP_SD = 1.1;
/**
 * Oferta mundial de talento de élite (DISEÑO §4.3): canteranos al año con techo ≥ ELITE_CA.
 * El resto de techos altos se recorta justo por debajo. Mantiene estable el nº de cracks.
 */
export const ELITE_CA = 16;
export const ELITE_INFLOW_PER_YEAR = 7;
/**
 * Jóvenes (CA < élite) con techo de élite: la "generación que viene". El cupo se fija en el
 * mundo inicial y se mantiene cada temporada: si alguien entra, el más flojo sale.
 */
export const ELITE_PIPELINE_START = 15;
/**
 * Control de la élite (criterio del usuario: dentro de ±12 % en 20 temporadas). La "generación
 * que viene" (techo de élite, aún por debajo) se dimensiona para que, dentro de unos años, haya
 * ELITE_TARGET_SHARE de cracks entre los jugadores con club: objetivo − élite actual + salidas
 * previstas por edad. Anticiparse así evita el retraso de 3–5 años de la cantera, que hacía oscilar
 * la élite ±30–40 %. Si sobran, se recorta; si faltan, se da techo de élite a los jóvenes que por
 * nivel y edad llegarían antes.
 */
export const ELITE_TARGET_SHARE = 0.0031;
/**
 * Probabilidad de que un crack deje de serlo en los próximos ~3 años según su edad: la "generación
 * que viene" debe cubrir esas salidas (objetivo − élite + salidas previstas).
 */
/** Banda de la élite (±) fuera de la cual actúa el ajuste de cierre de temporada. */
export const ELITE_BAND = 0.06;
/** Ese ajuste solo toca a jugadores a menos de esto del umbral de élite. */
export const ELITE_NUDGE_MAX = 0.8;
/** Fracción de la diferencia con el objetivo que se corrige cada temporada (amortigua el exceso tras un bache). */
export const ELITE_CONTROL_GAIN = 0.7;
export const ELITE_EXIT_BY_AGE: readonly (readonly [number, number])[] = [[26, 0.05], [29, 0.25], [31, 0.6], [33, 0.9], [35, 1]];
/** Crecimiento esperado en un año según la edad (para saber quién llegaría antes). */
export const NEAR_ELITE_GROWTH: readonly (readonly [number, number])[] = [[17, 2.4], [19, 2.2], [21, 1.8], [23, 1.2], [25, 0.6], [27, 0.2], [30, 0]];
export const NEAR_ELITE_MAX_AGE = 28;
/** Solo candidatos que quedarían a menos de esto de la élite. */
export const NEAR_ELITE_SLACK = 0.3;
/** Techo que reciben: ELITE_CA + MARGIN (+ hasta 0,6). */
export const NEAR_ELITE_MARGIN = 0.4;

// ── Niños prodigio (wonderkids) ─────────────────────────────────────────────
/**
 * Cada temporada sale algún canterano de 16–17 años con un nivel muy alto para su edad y un
 * techo que puede ser de estrella (no todos triunfan: el techo va de 15,5 a 19,5 y luego
 * cuentan los minutos, el entrenamiento y su cabeza); más probable en clubes con buena cantera. Cuentan dentro del cupo de élite
 * (tienen el techo más alto, así que siempre lo conservan). El mundo inicial ya trae algunos.
 */
export const WONDERKIDS_PER_YEAR = 1;
export const WONDERKIDS_AT_START = 5;
export const WONDERKID_AGE: readonly [number, number] = [16, 17];
export const WONDERKID_CA: readonly [number, number] = [12.5, 14.5];
export const WONDERKID_CEILING: readonly [number, number] = [15.5, 19.5];
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

// ── Retirada anticipada (lesión, motivos personales, edad) ──────────────────

/** Lesión a partir de la que un veterano puede plantearse dejarlo (días) y edad mínima. */
export const RETIRE_INJURY_DAYS = 120;
export const RETIRE_INJURY_MIN_AGE = 27;
/** Probabilidad mensual de plantearse dejarlo por motivos personales (× (0,5 + inseguridad + vida fuera/2)). */
export const RETIRE_PERSONAL_MONTHLY = 0.00015;
/** Veterano sin minutos: edad mínima, umbral de minutos (0..1) y probabilidad mensual. */
export const RETIRE_AGE_MIN = 33;
export const RETIRE_AGE_MINUTES = 0.25;
export const RETIRE_AGE_MONTHLY = 0.04;
/** Días que se toma para decidir. */
export const RETIRE_DECISION_DAYS = 28;
/** Probabilidad base de retirarse según el motivo. */
export const RETIRE_BASE: Record<"injury" | "personal" | "age", number> = { injury: 0.55, personal: 0.6, age: 0.65 };

// ── Reparto del tick mensual ────────────────────────────────────────────────
/**
 * El desarrollo mensual de cada jugador ocurre en "su" día del mes (1–28, por hash del id):
 * así ningún día carga con los 16.000 jugadores a la vez (avance de día < 200 ms en móvil).
 */
export const DEV_SPREAD_DAYS = 28;
