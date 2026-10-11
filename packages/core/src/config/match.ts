// Diales del motor de partido (Fase 2). Cada constante documenta qué controla; son los
// valores que ajusta la simulación de balance (`npm run sim`, docs/balance/fase2.md).

// ── Tiempo ──────────────────────────────────────────────────────────────────

/** Segundos que consume cada tipo de acción [mín, máx]. */
export const ACTION_SECONDS = {
  recycle: [3, 6],
  progress: [4, 8],
  long: [5, 9],
  through: [4, 7],
  dribble: [3, 6],
  cross: [4, 6],
  shot: [2, 4],
} as const;
/** Tiempo muerto tras cada interrupción (segundos). */
export const DEAD_SECONDS = {
  goal: 70,
  foul: 28,
  corner: 35,
  goalKick: 25,
  throwIn: 14,
  sub: 30,
  injury: 75,
  card: 25,
} as const;
/** Añadido de cada parte [mín, máx] en minutos. */
export const STOPPAGE_FIRST = [0, 3] as const;
export const STOPPAGE_SECOND = [2, 7] as const;

// ── Resolución de duelos (escala logística) ─────────────────────────────────

/** Logits por punto de diferencia de atributo (1–20) entre atacante y defensor. */
export const SKILL_K = 0.09;
/** Ventaja de campo en cada duelo del local (logits). */
export const HOME_EDGE = 0.04;
/** Penalización por cada jugador de menos (logits en cada duelo). */
export const MAN_DOWN = 0.28;
/** Logit base de éxito de cada tipo de pase. */
export const PASS_BASE = { recycle: 2.7, progress: 1.45, long: 0.15, through: -1.3 } as const;
/** Logit base del regate. */
export const DRIBBLE_BASE = 0.12;
/** Logit base de que un centro llegue a un rematador. */
export const CROSS_BASE = -0.85;
/** Probabilidad de que un despeje tras centro acabe en córner. */
export const CROSS_CORNER = 0.45;
/** Probabilidad de que un córner acabe en remate. */
export const CORNER_SHOT = 0.3;
/** Dificultad de pasar en el último tercio: logits en contra por cada 0.1 de campo más allá de 0.7. */
export const FINAL_THIRD_PENALTY = 0.22;
/** Presión sobre el rematador: logits de xG en contra por unidad de presión cercana. */
export const SHOT_PRESSURE = 0.15;
/** Presión alta: logits a favor del defensor cuando el balón está en campo del rival × intensidad. */
export const PRESS_EDGE = 0.55;

/** Mentalidad y riesgo: logits a favor del atacante por punto de mentalidad propia y del rival. */
export const MENTALITY_EDGE = 0.12;
/** Gestión del marcador: cambio de mentalidad del que gana (−) y del que pierde (+) al final. */
export const GAME_STATE_SHIFT = 0.7;
/** Minutos entre los que la gestión del marcador pasa de 0 a su valor completo. */
export const GAME_STATE_RAMP = [50, 85] as const;

/** Partidos abiertos o trabados: dispersión del factor común de ocasiones de ambos equipos. */
export const OPENNESS_SD = 0.3;

// ── Elección de acción (pesos relativos) ────────────────────────────────────

export const ACTION_WEIGHTS = {
  shotBox: 1.8,
  shotBoxWide: 0.45,
  shotLong: 0.55,
  cross: 1.25,
  through: 0.5,
  dribble: 0.55,
  progress: 2.2,
  recycle: 2.0,
  long: 0.35,
  longDirect: 1.0,
} as const;

// ── Disparos ────────────────────────────────────────────────────────────────

/** Probabilidad base de gol (xG) por tipo de ocasión, para un rematador y un portero medios. */
export const XG_BASE = {
  box: 0.105,
  boxClose: 0.24,
  boxWide: 0.05,
  long: 0.032,
  header: 0.085,
  oneOnOne: 0.28,
  penalty: 0.76,
  freeKick: 0.065,
  cornerHeader: 0.07,
  rebound: 0.26,
} as const;
/** Logits de xG por punto de calidad del rematador y del portero. */
export const SHOOTER_K = 0.11;
export const KEEPER_K = 0.09;
/** Probabilidad de que un tiro sea bloqueado por un defensor (según tipo). */
export const BLOCK_CHANCE = { box: 0.2, long: 0.3, other: 0.08 } as const;
/** Fracción de los tiros no convertidos que van a puerta (base). */
export const ON_TARGET_SHARE = 0.4;
/** Tras una parada: córner / rechace aprovechable. */
export const SAVE_CORNER = 0.33;
export const SAVE_REBOUND = 0.1;
/** Tras un bloqueo: córner. */
export const BLOCK_CORNER = 0.4;

// ── Faltas, tarjetas y lesiones ─────────────────────────────────────────────

/** Probabilidad de falta en un regate fallido (× agresividad del defensor). */
export const FOUL_ON_TACKLE = 0.35;
/** Falta táctica tras un regate superado en la zona media (corta la contra). */
export const TACTICAL_FOUL = 0.08;
/** Faltas sueltas por posesión (disputas, empujones) por acción. */
export const LOOSE_FOUL = 0.02;
/** Las faltas dentro del área (penalti) son más raras: multiplicador de la probabilidad de falta. */
export const BOX_FOUL_MULT = 0.35;
/** Amarilla por falta (base, × rigor del árbitro y agresividad). */
export const YELLOW_PER_FOUL = 0.2;
/** Multiplicador de amarilla en falta táctica. */
export const TACTICAL_YELLOW_MULT = 2.5;
/** Un amonestado se cuida: multiplica su probabilidad de falta y de que el árbitro le saque otra amarilla. */
export const BOOKED_CAUTION = { foul: 0.5, card: 0.6 } as const;
/** Roja directa por falta (base). */
export const RED_PER_FOUL = 0.0012;
/** Amarillas por protestas por equipo y minuto (× temperamento volátil). */
export const DISSENT_PER_MINUTE = 0.0012;
/** Lesión por minuto y jugador (base, × propensión y cansancio). */
export const INJURY_PER_MINUTE = 0.000055;
/** Lesión del jugador que recibe una falta. */
export const INJURY_ON_FOUL = 0.012;
/** Duración de lesiones [probabilidad, días mín, días máx]. */
export const INJURY_DAYS: readonly (readonly [number, number, number])[] = [
  [0.68, 3, 14],
  [0.25, 15, 45],
  [0.07, 60, 220],
];

// ── Físico ──────────────────────────────────────────────────────────────────

/** Desgaste de condición por minuto (× (1.35 − aguante/20) × intensidad). */
export const FATIGUE_PER_MINUTE = 0.0034;
/** Rendimiento según condición: (base + (1 − base) × condición). */
export const CONDITION_FLOOR = 0.78;
/** Recuperación diaria de forma física (× (0.6 + condición natural/25)). */
export const RECOVERY_PER_DAY = 0.085;
/** Dispersión del estado de forma del día (× (1.1 − regularidad/20)). */
export const FORM_SD = 0.085;

// ── Cambios ─────────────────────────────────────────────────────────────────

export const MAX_SUBS = 5;
export const SUB_WINDOWS = 3;
export const BENCH_SIZE = 9;
/** Condición por debajo de la cual el entrenador cambia a un jugador. */
export const SUB_CONDITION = 0.74;

// ── Valoración ──────────────────────────────────────────────────────────────

export const RATING_BASE = 6.2;

// ── Modelo rápido (LOD ligero), calibrado contra el motor completo ──────────

export const QUICK = {
  /** Goles esperados de referencia del local y del visitante. */
  baseHome: 1.45,
  baseAway: 1.2,
  neutral: 1.32,
  /** Peso de la diferencia de nivel del once (goles en escala log por punto de CA). */
  k: 0.27,
} as const;

// ── Instrucciones individuales y balón parado ───────────────────────────────

/**
 * Efecto de cada instrucción cumplida. shot/dribble/cross/long/short/through multiplican
 * el peso de esa acción; dx desplaza su posición (fracción de campo); press y tackle son
 * logits a favor como defensor; fatigue y foul multiplican cansancio y faltas.
 */
export const INSTRUCTION_EFFECTS = {
  shootMore: { shot: 1.5 },
  shootLess: { shot: 0.55 },
  dribbleMore: { dribble: 1.6 },
  dribbleLess: { dribble: 0.5 },
  crossMore: { cross: 1.6 },
  passShort: { long: 0.35, short: 1.15, through: 0.8 },
  passLong: { long: 1.8, through: 1.3, short: 0.9 },
  getForward: { dx: 0.06, shot: 1.15, fatigue: 1.1 },
  stayBack: { dx: -0.06, shot: 0.8 },
  pressMore: { press: 0.12, fatigue: 1.25 },
  pressLess: { press: -0.08, fatigue: 0.85 },
  tackleHarder: { tackle: 0.15, foul: 1.4 },
  stayOnFeet: { tackle: -0.1, foul: 0.55 },
} as const;

/** Rutinas de córner: multiplicador de la probabilidad de remate y de su xG. */
export const CORNER_ROUTINES = {
  nearPost: { shot: 1.1, xg: 0.9 },
  farPost: { shot: 0.95, xg: 1.1 },
  short: { shot: 0, xg: 1 },
  edgeOfBox: { shot: 0.6, xg: 1 },
} as const;
/** Cuántos suben al córner: multiplicador del remate y probabilidad de contra rival tras el despeje. */
export const CORNER_CROWD = {
  stay: { shot: 0.85, counter: 0.08 },
  some: { shot: 1, counter: 0.2 },
  all: { shot: 1.18, counter: 0.4 },
} as const;
/** Probabilidad de tirar directo una falta en zona de disparo según la rutina. */
export const FREE_KICK_DIRECT = { shoot: 0.6, cross: 0.2, short: 0 } as const;
/** Ventaja (logits) de un saque de banda largo al área frente a un centro normal. */
export const LONG_THROW_BONUS = 0.05;
