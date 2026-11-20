// Diales de generación del mundo (Fase 1). Cada constante documenta qué controla.

/** Versión del generador: cambia el hash del mundo de referencia si se toca. */
export const GENERATOR_VERSION = "gen-1";
/** Versión del formato del estado: cada cambio añade una migración en world/migrations.ts. */
export const SAVE_VERSION = 5;
/** Año de la primera temporada (julio). */
export const DEFAULT_START_YEAR = 2026;

/** Desplazamiento de calidad (CA) respecto a la del club según el puesto en la jerarquía de su posición. */
export const DEPTH_OFFSETS = [0.9, -0.1, -1.2, -2.2] as const;
/** Canteranos/promesas extra por plantilla jugable y su desfase de calidad. */
export const PROSPECTS_PER_SQUAD = 3;
export const PROSPECT_OFFSET = -3.2;
/** Techo inicial de los jóvenes: extra sobre su nivel adulto (× cantera) y dispersión por año de juventud. */
export const GEN_GAP_EXTRA = 0.25;
export const GEN_GAP_SD_PER_YEAR = 0.22;
/** Penalización de CA por juventud: por cada año por debajo de 22. */
export const YOUTH_CA_PENALTY = 0.45;
/** Penalización de CA por veteranía a partir de 32 años. */
export const VETERAN_CA_PENALTY = 0.35;

/** Edad de jugadores de primer equipo ~ N(media, sd) recortada. */
export const AGE_MEAN = 26.2;
export const AGE_SD = 4.1;
export const AGE_MIN = 17;
export const AGE_MAX = 37;

/** Separación entre atributos relevantes e irrelevantes para la posición (puntos 1–20). */
export const ATTR_RELEVANCE_SPREAD = 9.5;
/** Ruido individual por atributo. */
export const ATTR_NOISE = 1.5;
/** Talento natural por atributo ~ N(1, sd): dispersión de puntos fuertes y débiles. */
export const SHAPE_SD = 0.12;

/** Clubes en sombra por nación no jugable: 1 + round(a·strength² + b·talent). */
export const SHADOW_CLUBS_A = 4;
export const SHADOW_CLUBS_B = 1.5;
/** Calidad del mejor club en sombra de una nación: base + k·strength. */
export const SHADOW_QUALITY_BASE = 7.6;
export const SHADOW_QUALITY_K = 6.4;
/** Caída de calidad entre clubes en sombra consecutivos de la misma nación. */
export const SHADOW_QUALITY_STEP = 0.55;
export const SHADOW_SQUAD_SIZE = 22;
/** Proporción de extranjeros en clubes en sombra. */
export const SHADOW_FOREIGN_SHARE = 0.12;
/** Calidad del tercer nivel en sombra respecto a la segunda división. */
export const SHADOW_TIER3_OFFSET = -1.3;

/** Staff por club jugable. */
export const STAFF_PER_CLUB = { headCoach: 1, assistant: 1, coach: 2, scout: 2, physio: 1, nutritionist: 1, fitnessCoach: 1 } as const;
/** Árbitros por nación jugable y (mínimo) por nación no jugable. */
export const REFEREES_PLAYABLE = 24;
export const REFEREES_OTHER = 1;

/** Elo inicial de selecciones: base + k·strength (+ ajuste por la calidad real de su plantilla). */
export const ELO_BASE = 1150;
export const ELO_STRENGTH_K = 900;

/** Probabilidad de doble nacionalidad cuando la cultura del jugador apunta a otra nación. */
export const DUAL_NATIONALITY_CHANCE = 0.35;
/** Probabilidad de que un doble nacional elija la segunda selección (si es más débil que la primera, se ajusta). */
export const SECOND_NATION_CHOICE = 0.35;
