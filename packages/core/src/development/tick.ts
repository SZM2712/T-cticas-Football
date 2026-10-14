// Desarrollo mensual de los jugadores (DISEÑO §4.2). Cada jugador usa su propio stream
// `dev/<año>/<mes>/<id>`: añadir o quitar jugadores no altera el desarrollo de los demás.

import { ALL_ATTRS, ATTR_GROUP, POSITION_WEIGHTS, type AttrKey } from "../config/attributes";
import {
  AGE_GROWTH_CURVE, CEILING_DRIFT, CEILING_NOISE, CRITICAL_WINDOW, CRITICAL_WINDOW_MULT, DECLINING_PHYSICAL, EXPERIENCE_ATTRS,
  EXPERIENCE_GAIN, FOCUS_ATTRS, FOCUS_BOOST, FULL_MINUTES, GAP_HALF, YOUTH_MINUTES_FLOOR, IRRELEVANT_GROWTH, MAX_CEILING, MENTOR_MIN_AGE,
  MENTOR_TRAITS, MENTOR_TRANSFER, MONTH_LUCK_SD, MONTHLY_GROWTH, PHYSICAL_DECLINE, SERIOUS_INJURY_DAYS,
  SLEEP_CONSISTENCY, TECHNICAL_DECLINE, TECHNICAL_DECLINE_AGE,
} from "../config/development";
import { attributeShape } from "../gen/player";
import { coachAuthority, invalidateAbilityCache } from "../match/lineup";
import { POSITION_LINE } from "../config/attributes";
import { currentAbility } from "../player/ability";
import type { Rng } from "../rng/rng";
import { dateOf, exactAge } from "../time/calendar";
import type { Player, World } from "../types/domain";
import type { DevFactor } from "../types/development";
import type { GameDay } from "../types/ids";
import { clamp, clamp01, round } from "../util/math";
import { worldRng } from "../world/rng";
import { planEffects, resetStaffCache, rollAdherence, staffQuality } from "./plan";

const shapeCache = new WeakMap<Player, Record<AttrKey, number>>();

function shapeOf(world: World, p: Player): Record<AttrKey, number> {
  let s = shapeCache.get(p);
  if (!s) shapeCache.set(p, (s = attributeShape(worldRng(world), p.id)));
  return s;
}

/** Interpolación lineal en una curva [x, y]. */
export function curve(points: readonly (readonly [number, number])[], x: number): number {
  if (x <= points[0]![0]) return points[0]![1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i]!;
    const [x0, y0] = points[i - 1]!;
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return points[points.length - 1]![1];
}

/** Volatilidad anual del techo según la edad (alta a los 16, casi nula a los 26). */
export function volatilityFor(age: number): number {
  return round(0.1 + 1.4 * Math.pow(clamp01((26 - age) / 10), 1.3), 3);
}

function group(p: Player, a: AttrKey): Record<string, number> {
  return p[ATTR_GROUP[a]] as Record<string, number>;
}

function addAttr(p: Player, a: AttrKey, delta: number): void {
  const g = group(p, a);
  g[a] = round(clamp(g[a]! + delta, 1, 20), 3);
}

/** Cuánto crece cada tipo de atributo según la edad: el físico madura antes, la cabeza después. */
function typeCurve(kind: string, age: number): number {
  if (kind === "physical") return age < 23 ? 1.25 : age < 27 ? 0.8 : 0.3;
  if (kind === "mental") return age < 20 ? 0.7 : 1.15;
  return 1;
}

interface MonthCtx {
  day: GameDay;
  rngFor: (id: string) => Rng;
  /** Entorno medio del mundo este mes: la deriva del techo se mide respecto a él (anti-inflación). */
  meanEnv: number;
}

/** Minutos efectivos (0..1) tras el decaimiento mensual; los jóvenes juegan en filial. */
function minutesFactor(dev: Player["development"], age: number): number {
  const m = clamp01(dev.recentMinutes / FULL_MINUTES);
  return age <= 21 ? Math.max(m, YOUTH_MINUTES_FLOOR) : m;
}

/** Calidad de entrenamiento del club (instalaciones y técnicos). */
function trainingOf(world: World, p: Player): number {
  const club = p.clubId ? world.clubs[p.clubId] : undefined;
  return club ? 0.5 * club.facilities.training + 0.5 * staffQuality(world, club).coaching : 0.3;
}

/** Parte del entorno que no depende del plan (para centrar la deriva del techo). */
function baseEnv(minutes: number, training: number): number {
  return 0.45 * (minutes - 0.5) + 0.35 * (training - 0.5);
}

/** Mentoría: el aprendiz toma hábitos del mentor (buenos y malos). Devuelve la compatibilidad. */
function mentoring(world: World, p: Player, mentorId: string | undefined, day: GameDay): number | null {
  if (!mentorId) return null;
  const m = world.players[mentorId];
  if (!m || m.retired || m.clubId !== p.clubId || m.id === p.id || exactAge(m.birthDay, day) < MENTOR_MIN_AGE) return null;
  const sharedLanguage = m.languages.some((l) => p.languages.some((x) => x.lang === l.lang && x.fluency > 0.5));
  const sameLine = POSITION_LINE[m.position] === POSITION_LINE[p.position];
  let compat = (sharedLanguage ? 1 : 0.5) * (sameLine ? 1 : 0.7);
  if (m.psych.ego > 0.7 && p.psych.ego > 0.7) compat = -0.5;
  for (const t of MENTOR_TRAITS) {
    p.psych[t] = round(clamp01(p.psych[t] + MENTOR_TRANSFER * Math.abs(compat) * (m.psych[t] - p.psych[t])), 4);
  }
  if (compat > 0) {
    for (const a of ["composure", "decisions"] as const) {
      if (m.mental[a] > p.mental[a]) addAttr(p, a, 0.01 * compat);
    }
  } else {
    world.events.push({ day, type: "player.mentorClash", data: { player: p.id, mentor: m.id } });
  }
  return compat;
}

function developPlayer(world: World, p: Player, ctx: MonthCtx): void {
  const dev = p.development;
  const age = exactAge(p.birthDay, ctx.day);
  const rng = ctx.rngFor(p.id);
  const club = p.clubId ? world.clubs[p.clubId] : undefined;
  const q = staffQuality(world, club);
  const before = currentAbility(p);

  // Minutos (ya actualizados en la primera pasada) y calidad del entrenamiento.
  const minutes = minutesFactor(dev, age);
  const training = trainingOf(world, p);

  // Plan individual y lo que de verdad hizo el jugador.
  const plan = world.plans[p.id];
  if (plan) {
    const authority = club ? coachAuthority(world, club.id, p) : 0.5;
    dev.adherence = rollAdherence(p, plan, authority, q, age, rng);
    const ignored = Object.entries(dev.adherence).filter(([, v]) => v === "none").map(([k]) => k);
    if (ignored.length) world.events.push({ day: ctx.day, type: "player.planIgnored", data: { player: p.id, parts: ignored } });
  } else delete dev.adherence;
  const fx = planEffects(plan, dev.adherence, q);
  dev.recoveryMult = round(fx.recoveryMult, 3);
  dev.injuryRiskDelta = round(fx.injuryRiskDelta, 2);
  const mentorCompat = mentoring(world, p, plan?.mentor, ctx.day);

  // 1) El techo latente se mueve.
  const window = age >= CRITICAL_WINDOW[0] && age <= CRITICAL_WINDOW[1] ? CRITICAL_WINDOW_MULT : 1;
  const env = baseEnv(minutes, training) - ctx.meanEnv + 0.2 * (fx.score - 0.5) + (mentorCompat !== null ? 0.05 * mentorCompat : 0);
  const drift = CEILING_DRIFT * window * env * (0.5 + p.psych.growthMindset);
  dev.volatility = volatilityFor(age);
  const noise = rng.normal(0, (dev.volatility / Math.sqrt(12)) * CEILING_NOISE);
  // Sin suelo en la CA: si el techo pudiera rebotar en ella, el ruido solo empujaría hacia
  // arriba (efecto trinquete) e inflaría el talento. Por debajo de la CA, ya no crece.
  dev.latentCeiling = clamp(dev.latentCeiling + drift + noise, 1, MAX_CEILING);

  // 2) Crecimiento de la capacidad actual hacia el techo.
  const gap = Math.max(0, dev.latentCeiling - before);
  const envMult = (0.35 + 0.65 * minutes) * (0.6 + 0.5 * training) * (0.7 + 0.6 * p.psych.professionalism) * fx.growth;
  const luck = Math.exp(rng.normal(0, MONTH_LUCK_SD));
  const growth = MONTHLY_GROWTH * curve(AGE_GROWTH_CURVE, age - dev.maturationShift) * (gap / (gap + GAP_HALF)) * envMult * luck;

  // 3) Reparto entre atributos: talento natural, foco del plan, edad y margen hasta 20.
  if (growth > 0) {
    const shape = shapeOf(world, p);
    const posW = POSITION_WEIGHTS[p.position];
    const focus = new Set(plan ? FOCUS_ATTRS[plan.focus] : []);
    let sumRel = 0;
    let sumRelW = 0;
    const w: Partial<Record<AttrKey, number>> = {};
    for (const a of ALL_ATTRS) {
      const rel = posW[a] ?? 0;
      const value = group(p, a)[a]!;
      const margin = clamp((20 - value) / 8, 0.05, 1);
      let weight = shape[a]! * shape[a]! * typeCurve(ATTR_GROUP[a], age) * margin * (rel > 0 ? rel : IRRELEVANT_GROWTH);
      if (focus.has(a)) weight *= 1 + (FOCUS_BOOST - 1) * fx.focus;
      w[a] = weight;
      sumRel += rel;
      sumRelW += rel * weight;
    }
    const k = sumRelW > 0 ? (growth * sumRel) / sumRelW : 0;
    for (const a of ALL_ATTRS) {
      // Los porteros no ganan juego de pies de campo, ni los de campo atributos de portero.
      if ((ATTR_GROUP[a] === "goalkeeping") !== (p.position === "GK") && !(posW[a] ?? 0)) continue;
      addAttr(p, a, k * w[a]!);
    }
  }

  // 4) Efectos directos del plan (dieta y rutinas) y del sueño.
  for (const [a, v] of Object.entries(fx.attrs)) addAttr(p, a as AttrKey, v as number);
  if (fx.weightKg) p.weightKg = round(clamp(p.weightKg + fx.weightKg, 55, 105), 2);
  if (plan?.sleep === "routine" && dev.adherence?.sleep === "full") p.hidden.consistency = round(Math.min(20, p.hidden.consistency + SLEEP_CONSISTENCY), 3);

  // 5) Declive con la edad y experiencia.
  let decline = 0;
  if (age > dev.physicalPeakAge) {
    const years = Math.min(5, age - dev.physicalPeakAge);
    const k = PHYSICAL_DECLINE * years * (1.25 - p.psych.professionalism) * (0.7 + p.hidden.injuryProneness / 20) * (1 - fx.declineProtection);
    for (const a of DECLINING_PHYSICAL) addAttr(p, a, -k * (0.7 + 0.6 * rng.float()));
    decline += k;
  }
  if (age > TECHNICAL_DECLINE_AGE) {
    const k = TECHNICAL_DECLINE * Math.min(6, age - TECHNICAL_DECLINE_AGE);
    for (const a of ["firstTouch", "technique", "dribbling", "crossing"] as const) addAttr(p, a, -k);
    decline += k * 0.5;
  }
  if (age >= 22 && age <= 32 && minutes > 0.2) for (const a of EXPERIENCE_ATTRS) addAttr(p, a, EXPERIENCE_GAIN * minutes);

  // 6) Secuelas de una lesión larga reciente: techo y explosividad.
  let injuryHit = 0;
  const inj = p.injury;
  if (inj && inj.until - inj.since >= SERIOUS_INJURY_DAYS && inj.since > ctx.day - 32 && dev.lastShockDay !== inj.since) {
    dev.lastShockDay = inj.since;
    dev.seriousInjuries = (dev.seriousInjuries ?? 0) + 1;
    injuryHit = rng.range(0.3, 0.8) * (1 - 0.4 * q.medical);
    dev.latentCeiling -= injuryHit;
    addAttr(p, "acceleration", -injuryHit * 0.6);
    addAttr(p, "pace", -injuryHit * 0.4);
  }

  const after = currentAbility(p);
  dev.latentCeiling = round(clamp(dev.latentCeiling, 1, MAX_CEILING), 3);
  dev.caMonthly.push(Math.round(after * 10));
  if (dev.caMonthly.length > 24) dev.caMonthly.shift();

  // 7) Informe «¿por qué?»: los factores con más peso este mes.
  const factors: DevFactor[] = [
    { key: "age", value: curve(AGE_GROWTH_CURVE, age - dev.maturationShift) - 0.5 },
    { key: "minutes", value: minutes - 0.5 },
    { key: "training", value: training - 0.5 },
    { key: "attitude", value: p.psych.professionalism - 0.5 },
    ...fx.factors,
  ];
  if (mentorCompat !== null) factors.push({ key: "mentor", value: mentorCompat });
  if (decline > 0) factors.push({ key: "decline", value: -decline * 20 });
  if (injuryHit > 0) factors.push({ key: "injury", value: -injuryHit * 2 });
  dev.recentFactors = factors
    .filter((f) => Math.abs(f.value) > 0.05)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value) || a.key.localeCompare(b.key))
    .slice(0, 4)
    .map((f) => ({ key: f.key, value: round(f.value, 2) }));
}

/** Tick mensual de desarrollo de todo el mundo (primer día de cada mes). */
export function monthlyDevelopment(world: World, day: GameDay): void {
  const { y, m } = dateOf(day);
  const root = worldRng(world).fork(`dev/${y}/${m}`);
  resetStaffCache(world);
  // Primera pasada: minutos del mes y entorno medio del mundo.
  let sum = 0;
  let n = 0;
  for (const p of Object.values(world.players)) {
    if (p.retired) continue;
    const dev = p.development;
    dev.recentMinutes = Math.round(dev.recentMinutes * 0.5 + dev.monthMinutes);
    dev.monthMinutes = 0;
    sum += baseEnv(minutesFactor(dev, exactAge(p.birthDay, day)), trainingOf(world, p));
    n++;
  }
  const ctx: MonthCtx = { day, rngFor: (id) => root.fork(id), meanEnv: n ? sum / n : 0 };
  for (const p of Object.values(world.players)) {
    if (p.retired) continue;
    developPlayer(world, p, ctx);
  }
  // Los atributos han cambiado: la CA por posición en caché ya no vale.
  invalidateAbilityCache();
}
