// Desarrollo mensual de los jugadores (DISEÑO §4.2). Cada jugador usa su propio stream
// `dev/<año>/<mes>/<id>`: añadir o quitar jugadores no altera el desarrollo de los demás.

import { ALL_ATTRS, ATTR_GROUP, POSITION_WEIGHTS, type AttrKey } from "../config/attributes";
import {
  ADULT_DRIFT_MULT, AGE_GROWTH_CURVE, CEILING_DRIFT, CEILING_NOISE, CRITICAL_WINDOW, CRITICAL_WINDOW_MULT, DECLINING_PHYSICAL, EXPERIENCE_ATTRS,
  EXPERIENCE_GAIN, FOCUS_ATTRS, FOCUS_BOOST, FULL_MINUTES, GAP_HALF, YOUTH_MINUTES_FLOOR, IRRELEVANT_GROWTH, MAX_CEILING, MENTOR_MIN_AGE,
  MENTOR_TRAITS, MENTOR_TRANSFER, MONTH_LUCK_SD, MONTHLY_GROWTH, PHYSICAL_DECLINE, SERIOUS_INJURY_DAYS,
  DEV_FIT_WEIGHTS, DEV_SPREAD_DAYS, FIT_ENV_WEIGHT, FIT_GROWTH, LATE_BLOOM_AGE, LATE_BLOOM_AGE_FACTOR, LATE_BLOOM_DRIFT, LATE_BLOOM_FULL, LATE_BLOOM_HEADROOM, LATE_BLOOM_MAX_CA,
  LATE_BLOOM_MIN_FIT, LATE_BLOOM_MINUTES,
  PRODIGY_ATTITUDE, PRODIGY_DRIFT_MULT, PRODIGY_MAX_AGE, SLEEP_CONSISTENCY, TECHNICAL_DECLINE, TECHNICAL_DECLINE_AGE,
} from "../config/development";
import { attributeShape } from "../gen/player";
import { coachAuthority, invalidatePlayerAbility } from "../match/lineup";
import { POSITION_LINE } from "../config/attributes";
import { currentAbility } from "../player/ability";
import { fitOf } from "../social/fit";
import type { Rng } from "../rng/rng";
import { fnv1a32 } from "../rng/hash";
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

/** Atributos con su grupo y pesos por posición precompilados (el reparto mensual es el bucle más caliente). */
const ATTRS = ALL_ATTRS.map((a) => ({ a, g: ATTR_GROUP[a] }));
const POS_WEIGHTS = Object.fromEntries(
  Object.entries(POSITION_WEIGHTS).map(([pos, w]) => [pos, Float64Array.from(ALL_ATTRS, (a) => (w as Partial<Record<AttrKey, number>>)[a] ?? 0)]),
) as Record<string, Float64Array>;
const weightBuf = new Float64Array(ALL_ATTRS.length);

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
  /** Encaje medio del grupo: el encaje acelera o frena el crecimiento respecto a él (sin inflar el mundo). */
  meanFit: number;
  /** Minutos, entrenamiento y encaje de cada jugador del grupo (calculados en la primera pasada). */
  inputs: Map<string, EnvInputs>;
}

interface EnvInputs {
  minutes: number;
  training: number;
  /** Encaje total en su club (−1..1): táctica, mánager, cultura y vestuario. */
  fit: number;
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
function baseEnv(minutes: number, training: number, fit: number): number {
  return 0.45 * (minutes - 0.5) + 0.35 * (training - 0.5) + FIT_ENV_WEIGHT * fit;
}

/** Encaje en su club pesado para el desarrollo; sin club no hay encaje que ayude ni que estorbe. */
function fitFor(world: World, p: Player): number {
  if (!p.clubId || !world.clubs[p.clubId]) return 0;
  const f = fitOf(world, p, p.clubId);
  const W = DEV_FIT_WEIGHTS;
  return W.tactical * f.tactical + W.manager * f.manager + W.social * f.social + W.cultural * f.cultural;
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

  // Minutos (ya actualizados en la primera pasada), calidad del entrenamiento y encaje.
  const { minutes: groupMinutes, training, fit } = ctx.inputs.get(p.id)!;
  // Un prodigio joven depende de sus minutos reales: el suelo de filial no le basta.
  const prodigy = !!dev.prodigy && age <= PRODIGY_MAX_AGE;
  const minutes = prodigy ? clamp01(dev.recentMinutes / FULL_MINUTES) : groupMinutes;

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
  const critical = age >= CRITICAL_WINDOW[0] && age <= CRITICAL_WINDOW[1];
  const env = baseEnv(minutes, training, fit) - ctx.meanEnv + 0.2 * (fx.score - 0.5) + (mentorCompat !== null ? 0.05 * mentorCompat : 0);
  // Para un prodigio, la cabeza cuenta tanto como el sitio: el poco profesional se pierde.
  const attitude = prodigy ? PRODIGY_ATTITUDE * (p.psych.professionalism - 0.5) : 0;
  // El techo de un prodigio es una promesa: un mal entorno la erosiona deprisa; uno bueno la sostiene.
  const promise = env + attitude;
  const window = (critical ? CRITICAL_WINDOW_MULT : ADULT_DRIFT_MULT) * (prodigy ? (promise < 0 ? PRODIGY_DRIFT_MULT : 0) : 1);
  let drift = CEILING_DRIFT * window * (prodigy ? promise : env) * (0.5 + p.psych.growthMindset);
  // Florecimiento tardío: un jugador que no es de élite, que juega y al que la táctica y el
  // técnico le van claramente bien todavía sube (hasta poco por encima de su nivel).
  let bloom = 0;
  const fitEdge = fit - ctx.meanFit - LATE_BLOOM_MIN_FIT;
  if (!critical && age >= LATE_BLOOM_AGE[0] && age <= LATE_BLOOM_AGE[1] && fitEdge > 0 && minutes >= LATE_BLOOM_MINUTES && before < LATE_BLOOM_MAX_CA) {
    bloom = clamp01(fitEdge / LATE_BLOOM_FULL);
    const room = before + LATE_BLOOM_HEADROOM - (dev.latentCeiling + drift);
    if (room > 0) drift += Math.min(room, LATE_BLOOM_DRIFT * bloom * (0.5 + p.psych.growthMindset));
  }
  dev.volatility = volatilityFor(age);
  const noise = rng.normal(0, (dev.volatility / Math.sqrt(12)) * CEILING_NOISE);
  // Sin suelo en la CA: si el techo pudiera rebotar en ella, el ruido solo empujaría hacia
  // arriba (efecto trinquete) e inflaría el talento. Por debajo de la CA, ya no crece.
  dev.latentCeiling = clamp(dev.latentCeiling + drift + noise, 1, MAX_CEILING);

  // 2) Crecimiento de la capacidad actual hacia el techo.
  const gap = Math.max(0, dev.latentCeiling - before);
  const envMult = (0.35 + 0.65 * minutes) * (0.6 + 0.5 * training) * (0.7 + 0.6 * p.psych.professionalism) * fx.growth * (1 + FIT_GROWTH * (fit - ctx.meanFit));
  const luck = Math.exp(rng.normal(0, MONTH_LUCK_SD));
  const ageFactor = Math.max(curve(AGE_GROWTH_CURVE, age - dev.maturationShift), LATE_BLOOM_AGE_FACTOR * bloom);
  const growth = MONTHLY_GROWTH * ageFactor * (gap / (gap + GAP_HALF)) * envMult * luck;

  // 3) Reparto entre atributos: talento natural, foco del plan, edad y margen hasta 20.
  if (growth > 0) {
    const shape = shapeOf(world, p);
    const posW = POS_WEIGHTS[p.position]!;
    const focus = plan ? FOCUS_ATTRS[plan.focus] : [];
    const isGK = p.position === "GK";
    let sumRel = 0;
    let sumRelW = 0;
    const w = weightBuf;
    for (let i = 0; i < ATTRS.length; i++) {
      const { a, g } = ATTRS[i]!;
      const rel = posW[i]!;
      const value = (p[g] as Record<string, number>)[a]!;
      const margin = clamp((20 - value) / 8, 0.05, 1);
      const sh = shape[a]!;
      let weight = sh * sh * typeCurve(g, age) * margin * (rel > 0 ? rel : IRRELEVANT_GROWTH);
      if (focus.length && focus.includes(a)) weight *= 1 + (FOCUS_BOOST - 1) * fx.focus;
      w[i] = weight;
      sumRel += rel;
      sumRelW += rel * weight;
    }
    const k = sumRelW > 0 ? (growth * sumRel) / sumRelW : 0;
    for (let i = 0; i < ATTRS.length; i++) {
      const { a, g } = ATTRS[i]!;
      // Los porteros no ganan juego de pies de campo, ni los de campo atributos de portero.
      if ((g === "goalkeeping") !== isGK && !posW[i]) continue;
      const grp = p[g] as Record<string, number>;
      grp[a] = round(clamp(grp[a]! + k * w[i]!, 1, 20), 3);
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
  // La experiencia madura la cabeza, pero no lleva a nadie por encima de su techo.
  if (age >= 22 && age <= 32 && minutes > 0.2 && before < dev.latentCeiling) for (const a of EXPERIENCE_ATTRS) addAttr(p, a, EXPERIENCE_GAIN * minutes);

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
    { key: "fit", value: fit - ctx.meanFit },
    ...fx.factors,
  ];
  if (bloom > 0) factors.push({ key: "bloom", value: bloom });
  if (mentorCompat !== null) factors.push({ key: "mentor", value: mentorCompat });
  if (decline > 0) factors.push({ key: "decline", value: -decline * 20 });
  if (injuryHit > 0) factors.push({ key: "injury", value: -injuryHit * 2 });
  dev.recentFactors = factors
    .filter((f) => Math.abs(f.value) > 0.05)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value) || a.key.localeCompare(b.key))
    .slice(0, 4)
    .map((f) => ({ key: f.key, value: round(f.value, 2) }));
}

/** Día del mes (1–28) en que se desarrolla cada jugador: reparte el coste del tick mensual. */
export function devDayOf(id: string): number {
  return 1 + (fnv1a32(id) % DEV_SPREAD_DAYS);
}

/**
 * Desarrolla un grupo de jugadores (su tick mensual). El entorno medio se mide sobre el propio
 * grupo: con cientos de jugadores elegidos por hash es la media del mundo con poco ruido.
 */
function developBatch(world: World, day: GameDay, players: Player[]): void {
  if (!players.length) return;
  const { y, m } = dateOf(day);
  const root = worldRng(world).fork(`dev/${y}/${m}`);
  resetStaffCache(world);
  // Primera pasada: minutos del mes, encaje y entorno medio.
  let sum = 0;
  let fitSum = 0;
  const inputs = new Map<string, EnvInputs>();
  for (const p of players) {
    const dev = p.development;
    dev.recentMinutes = Math.round(dev.recentMinutes * 0.5 + dev.monthMinutes);
    dev.monthMinutes = 0;
    const input = { minutes: minutesFactor(dev, exactAge(p.birthDay, day)), training: trainingOf(world, p), fit: fitFor(world, p) };
    inputs.set(p.id, input);
    sum += baseEnv(input.minutes, input.training, input.fit);
    fitSum += input.fit;
  }
  const ctx: MonthCtx = { day, rngFor: (id) => root.fork(id), meanEnv: sum / players.length, meanFit: fitSum / players.length, inputs };
  for (const p of players) {
    developPlayer(world, p, ctx);
    // Sus atributos han cambiado: su CA por posición en caché ya no vale.
    invalidatePlayerAbility(p);
  }
}

/** Tick mensual de todo el mundo de una vez (tests y herramientas). */
export function monthlyDevelopment(world: World, day: GameDay): void {
  developBatch(world, day, Object.values(world.players).filter((p) => !p.retired));
}

/** Índice en memoria día del mes → ids (se rehace si cambia el número de jugadores). */
const buckets = new WeakMap<World, { count: number; byDay: string[][] }>();

function dayBucket(world: World, d: number): string[] {
  // Los jugadores nuevos (canteranos) suben el contador de ids: basta con mirarlo.
  const count = world.idCounters.pl ?? 0;
  let b = buckets.get(world);
  if (!b || b.count !== count) {
    const ids = Object.keys(world.players);
    const byDay: string[][] = Array.from({ length: DEV_SPREAD_DAYS + 1 }, () => []);
    for (const id of ids) byDay[devDayOf(id)]!.push(id);
    buckets.set(world, (b = { count, byDay }));
  }
  return b.byDay[d]!;
}

/** Tick diario: se desarrollan los jugadores a los que hoy les toca su tick mensual. */
export function dailyDevelopment(world: World, day: GameDay): void {
  const d = dateOf(day).d;
  if (d > DEV_SPREAD_DAYS) return;
  const players = dayBucket(world, d).map((id) => world.players[id]!).filter((p) => p && !p.retired);
  developBatch(world, day, players);
}
