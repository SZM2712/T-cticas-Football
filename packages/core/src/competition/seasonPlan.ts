// Fechas de una temporada: ventanas FIFA, jornadas continentales y asignación de
// semanas a ligas y copas de cada nación sin choques entre competiciones que pueden
// compartir equipos.

import type { NationLeagueData } from "@tf/data";
import {
  C1_DATES, C2_FINAL, C3_FINAL, CUP_FIRST, CUP_LAST, FIFA_WINDOWS, WINDOW_DAYS, WINDOW_MATCHDAY_OFFSETS,
  type MonthDay,
} from "../config/calendar";
import { dayOf, mondayOf, nextWeekday, SAT, TUE, WED, weekday } from "../time/calendar";
import type { GameDay } from "../types/ids";

export interface InternationalWindow {
  key: string;
  /** Año civil de la ventana. */
  year: number;
  monday: GameDay;
  matchdays: [GameDay, GameDay];
}

/** Año civil de una fecha (mes, día) dentro de la temporada que empieza en julio de `seasonYear`. */
export function yearIn(seasonYear: number, md: MonthDay): number {
  return md.month >= 7 ? seasonYear : seasonYear + 1;
}

export function dayIn(seasonYear: number, md: MonthDay): GameDay {
  return dayOf(yearIn(seasonYear, md), md.month, md.day);
}

export function windowsOf(seasonYear: number): InternationalWindow[] {
  return FIFA_WINDOWS.map((w) => {
    const monday = nextWeekday(dayIn(seasonYear, w.start), 0);
    return {
      key: w.key,
      year: yearIn(seasonYear, w.start),
      monday,
      matchdays: [(monday + WINDOW_MATCHDAY_OFFSETS[0]) as GameDay, (monday + WINDOW_MATCHDAY_OFFSETS[1]) as GameDay],
    };
  });
}

export function isInWindow(day: number, windows: readonly InternationalWindow[]): boolean {
  return windows.some((w) => day >= w.monday && day < w.monday + WINDOW_DAYS);
}

/** Lleva una fecha objetivo al día de la semana `wd` de su semana, evitando ventanas FIFA. */
function snap(seasonYear: number, md: MonthDay, wd: number, windows: readonly InternationalWindow[]): GameDay {
  let day = (mondayOf(dayIn(seasonYear, md)) + wd) as GameDay;
  while (isInWindow(day, windows)) day = (day + 7) as GameDay;
  return day;
}

export interface ContinentalDates {
  /** Días base (martes) de la competición 1; las 2 y 3 juegan el jueves de la misma semana. */
  leaguePhase: GameDay[];
  playoff: GameDay[];
  r16: GameDay[];
  qf: GameDay[];
  sf: GameDay[];
  finals: { c1: GameDay; c2: GameDay; c3: GameDay };
}

export function continentalDates(seasonYear: number, windows: readonly InternationalWindow[]): ContinentalDates {
  // Cada fecha debe caer al menos una semana después de la anterior (incluso entre rondas):
  // si una ventana FIFA empuja una ida, la vuelta se desplaza con ella.
  let last = -Infinity;
  const s = (md: MonthDay): GameDay => {
    let day = snap(seasonYear, md, TUE, windows);
    while (day < last + 7 || isInWindow(day, windows)) day = (day + 7) as GameDay;
    last = day;
    return day;
  };
  return {
    leaguePhase: C1_DATES.leaguePhase.map(s),
    playoff: C1_DATES.playoff.map(s),
    r16: C1_DATES.r16.map(s),
    qf: C1_DATES.qf.map(s),
    sf: C1_DATES.sf.map(s),
    finals: {
      c1: nextWeekday(dayIn(seasonYear, C1_DATES.final), SAT),
      c2: snap(seasonYear, C2_FINAL, WED, windows),
      c3: snap(seasonYear, C3_FINAL, WED, windows),
    },
  };
}

/** Todos los días con partido continental (para bloquear semanas de ligas y copas). */
export function continentalDays(cd: ContinentalDates): GameDay[] {
  const tuesdays = [...cd.leaguePhase, ...cd.playoff, ...cd.r16, ...cd.qf, ...cd.sf];
  const days: GameDay[] = [];
  for (const t of tuesdays) days.push(t, (t + 1) as GameDay, (t + 2) as GameDay); // mar, mié, jue
  days.push(cd.finals.c1, cd.finals.c2, cd.finals.c3);
  return days;
}

export interface NationPlan {
  /** Días base de cada jornada de liga por división. */
  leagueSlots: [GameDay[], GameDay[]];
  /** Miércoles de las rondas de copa (incluidas idas/vueltas), en orden. */
  cupSlots: GameDay[][];
  cupFinal: GameDay;
  /** Último fin de semana de liga (sábado). */
  lastWeekend: GameDay;
}

function spreadPick<T>(items: readonly T[], count: number): T[] {
  if (count >= items.length) return items.slice();
  if (count <= 0) return [];
  const out: T[] = [];
  for (let i = 0; i < count; i++) out.push(items[Math.round((i * (items.length - 1)) / Math.max(1, count - 1))]!);
  return out;
}

/**
 * Reparte las fechas de una nación:
 * - copa: miércoles de semanas sin ventana ni partidos continentales;
 * - 1.ª división: fines de semana libres y, si faltan, miércoles libres (sin continental ni copa);
 * - 2.ª división: fines de semana y martes (puede coincidir con semanas continentales, no con copa).
 */
export function planNation(
  seasonYear: number,
  data: NationLeagueData,
  rounds: [number, number],
  cupRoundLegs: number[],
  windows: readonly InternationalWindow[],
  continental: readonly GameDay[],
): NationPlan {
  const start = nextWeekday(dayIn(seasonYear, data.seasonStart), SAT);
  const endTarget = dayIn(seasonYear, data.seasonEnd);
  const lastWeekend = (endTarget - ((weekday(endTarget) - SAT + 7) % 7)) as GameDay;
  const breakFrom = data.winterBreak ? dayIn(seasonYear, data.winterBreak.from) : null;
  const breakTo = data.winterBreak ? dayIn(seasonYear, data.winterBreak.to) : null;
  const inBreak = (d: number) => breakFrom !== null && breakTo !== null && d >= breakFrom && d <= breakTo;
  const contSet = new Set<number>(continental);
  const busyWeek = (monday: number) => {
    for (let d = monday; d < monday + 7; d++) if (contSet.has(d)) return true;
    return false;
  };
  const windowWeek = (monday: number) =>
    windows.some((w) => monday + 6 >= w.monday && monday <= w.monday + WINDOW_DAYS);

  // Final de copa: el sábado más tardío al menos una semana antes del final de liga sin continental cercano.
  let cupFinal = (lastWeekend - 7) as GameDay;
  while (contSet.has(cupFinal - 2) || contSet.has(cupFinal - 1) || contSet.has(cupFinal + 1) || contSet.has(cupFinal + 2) || contSet.has(cupFinal + 3) || isInWindow(cupFinal, windows)) {
    cupFinal = (cupFinal - 7) as GameDay;
  }

  // Semanas candidatas.
  const mondays: number[] = [];
  for (let m: number = mondayOf(start); m <= lastWeekend; m += 7) mondays.push(m);

  // Copa (rondas previas a la final).
  const cupFirst = dayIn(seasonYear, CUP_FIRST);
  const cupLast = Math.min(dayIn(seasonYear, CUP_LAST), cupFinal - 10);
  const cupWeeks = mondays.filter((m) => m >= mondayOf(cupFirst) && m <= cupLast && !busyWeek(m) && !windowWeek(m) && !inBreak(m + WED));
  const legsNeeded = cupRoundLegs.reduce((a, b) => a + b, 0);
  const chosenCup = spreadPick(cupWeeks, legsNeeded);
  if (chosenCup.length < legsNeeded) throw new Error(`Sin semanas suficientes para la copa de ${data.nation}`);
  const cupSlots: GameDay[][] = [];
  let k = 0;
  for (const legs of cupRoundLegs) {
    const slots: GameDay[] = [];
    for (let l = 0; l < legs; l++) slots.push((chosenCup[k++]! + WED) as GameDay);
    cupSlots.push(slots);
  }
  const cupWeekSet = new Set(chosenCup);

  // Fines de semana de liga.
  const weekends = mondays
    .map((m) => m + SAT)
    .filter((s) => s >= start && s <= lastWeekend && !isInWindow(s, windows) && !inBreak(s) && s !== cupFinal);

  const leagueSlots: [GameDay[], GameDay[]] = [[], []];
  for (const tier of [0, 1] as const) {
    const needed = rounds[tier];
    const weekendsUsed = spreadPick(weekends, needed);
    let slots: number[] = weekendsUsed;
    if (needed > weekends.length) {
      const extra = needed - weekends.length;
      const midweekDay = tier === 0 ? WED : TUE;
      const midweeks = mondays
        .filter((m) => !windowWeek(m) && !cupWeekSet.has(m) && (tier === 1 || !busyWeek(m)))
        .map((m) => m + midweekDay)
        .filter((d) => d > start && d < lastWeekend && !inBreak(d) && !isInWindow(d, windows) && Math.abs(d - cupFinal) > 2);
      const chosen = spreadPick(midweeks, extra);
      if (chosen.length < extra) throw new Error(`Sin fechas suficientes para la liga ${data.nation} nivel ${tier + 1}`);
      slots = [...weekends, ...chosen];
    }
    // spreadPick conserva el último fin de semana: la liga siempre acaba en `lastWeekend`.
    slots.sort((a, b) => a - b);
    leagueSlots[tier] = slots as GameDay[];
  }
  return { leagueSlots, cupSlots, cupFinal, lastWeekend };
}

