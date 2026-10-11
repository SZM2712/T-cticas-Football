// Tiempo de juego. GameDay = días desde el 1 de enero de 2000 (calendario gregoriano
// proléptico). Conversión con aritmética entera (algoritmo days_from_civil de
// H. Hinnant); nunca se usa Date en el núcleo.

import type { GameDay } from "../types/ids";

export interface CivilDate {
  y: number;
  m: number; // 1..12
  d: number; // 1..31
}

const EPOCH_OFFSET = daysFromCivil(2000, 1, 1);

function daysFromCivil(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const mp = (m + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

export function dayOf(y: number, m: number, d: number): GameDay {
  return (daysFromCivil(y, m, d) - EPOCH_OFFSET) as GameDay;
}

export function dateOf(day: GameDay | number): CivilDate {
  const z = day + EPOCH_OFFSET + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return { y: yoe + era * 400 + (m <= 2 ? 1 : 0), m, d };
}

/** Día de la semana: 0 = lunes … 6 = domingo. El 1/1/2000 fue sábado. */
export function weekday(day: GameDay | number): number {
  return (((day + 5) % 7) + 7) % 7;
}

export const MON = 0, TUE = 1, WED = 2, THU = 3, FRI = 4, SAT = 5, SUN = 6;

/** Primer día >= `day` que cae en el día de la semana `wd`. */
export function nextWeekday(day: number, wd: number): GameDay {
  return (day + ((wd - weekday(day) + 7) % 7)) as GameDay;
}

/** Lunes de la semana que contiene `day`. */
export function mondayOf(day: number): GameDay {
  return (day - weekday(day)) as GameDay;
}

export function formatDate(day: GameDay | number): string {
  const { y, m, d } = dateOf(day);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Edad entera en años en `day` para alguien nacido en `birth`. */
export function ageOn(birth: GameDay | number, day: GameDay | number): number {
  const b = dateOf(birth);
  const t = dateOf(day);
  let age = t.y - b.y;
  if (t.m < b.m || (t.m === b.m && t.d < b.d)) age--;
  return age;
}

/** Edad con decimales (para curvas continuas). */
export function exactAge(birth: GameDay | number, day: GameDay | number): number {
  return (day - birth) / 365.2425;
}

/** Inicio de la temporada que empieza en julio de `startYear`. */
export function seasonStartDay(startYear: number): GameDay {
  return dayOf(startYear, 7, 1);
}

/** Año de inicio de la temporada que contiene `day` (las temporadas van de julio a junio). */
export function seasonYearOf(day: GameDay | number): number {
  const { y, m } = dateOf(day);
  return m >= 7 ? y : y - 1;
}
