// Calendario: ventanas internacionales, fechas de competiciones continentales de clubes
// y ciclo internacional de 4 años (§8.2 de DISEÑO.md). Fechas como (mes, día) objetivo;
// el planificador las ajusta al día de la semana correcto.

export interface MonthDay {
  month: number;
  day: number;
}

/** Ventanas FIFA de una temporada: primer lunes >= fecha objetivo. Mar/Jun son del año siguiente. */
export const FIFA_WINDOWS: { key: string; start: MonthDay }[] = [
  { key: "sep", start: { month: 9, day: 1 } },
  { key: "oct", start: { month: 10, day: 5 } },
  { key: "nov", start: { month: 11, day: 9 } },
  { key: "mar", start: { month: 3, day: 20 } },
  { key: "jun", start: { month: 6, day: 1 } },
];
/** Duración de una ventana (lunes a martes de la semana siguiente). */
export const WINDOW_DAYS = 9;
/** Desplazamiento de las dos jornadas internacionales dentro de la ventana (jueves y domingo). */
export const WINDOW_MATCHDAY_OFFSETS = [3, 6] as const;

/** Fechas objetivo de la competición continental 1 (martes/miércoles). */
export const C1_DATES = {
  leaguePhase: [
    { month: 9, day: 16 }, { month: 9, day: 30 }, { month: 10, day: 21 }, { month: 11, day: 4 },
    { month: 11, day: 25 }, { month: 12, day: 9 }, { month: 1, day: 20 }, { month: 1, day: 27 },
  ],
  playoff: [{ month: 2, day: 10 }, { month: 2, day: 17 }],
  r16: [{ month: 3, day: 3 }, { month: 3, day: 10 }],
  qf: [{ month: 4, day: 7 }, { month: 4, day: 14 }],
  sf: [{ month: 4, day: 28 }, { month: 5, day: 5 }],
  final: { month: 5, day: 30 },
} as const;
/** Las competiciones 2 y 3 juegan los jueves de las mismas semanas; finales en miércoles. */
export const C2_FINAL: MonthDay = { month: 5, day: 20 };
export const C3_FINAL: MonthDay = { month: 5, day: 27 };

/** Ventana de copa nacional: primera y última semana posibles para las rondas previas a la final. */
export const CUP_FIRST: MonthDay = { month: 9, day: 15 };
export const CUP_LAST: MonthDay = { month: 4, day: 25 };

/** Inicio de los torneos de verano: primer jueves >= esta fecha. */
export const TOURNAMENT_START: MonthDay = { month: 6, day: 14 };
/** Días entre jornadas de grupo y entre rondas eliminatorias de un torneo; dispersión de partidos de una jornada. */
export const TOURNAMENT_GROUP_GAP = 5;
export const TOURNAMENT_ROUND_GAP = 6;
export const TOURNAMENT_SPREAD = 3;

/** Mínimo de días entre dos partidos del mismo equipo (3 = sábado → martes). */
export const MIN_REST_DAYS = 3;

/** Plazas mundialistas por confederación (incluido el anfitrión si es de esa confederación). Total 48. */
export const WORLD_CUP_SLOTS = { EUR: 16, AFR: 9, ASI: 8, SAM: 7, NCA: 7, OCE: 1 } as const;
