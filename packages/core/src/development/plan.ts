// Plan individual: el jugador decide cada mes cuánto lo sigue y el plan produce efectos
// según esa adherencia y la calidad del staff que lo prepara.

import {
  ADHERENCE, ADHERENCE_VALUE, DIET_EFFECTS, EXERCISE_EFFECTS, INTENSITY, OVERLOAD_INJURY, SLEEP_RECOVERY,
} from "../config/development";
import type { Rng } from "../rng/rng";
import type { Club, Player, World } from "../types/domain";
import type { Adherence, DevelopmentPlan, PlanAdherence } from "../types/development";
import { clamp01 } from "../util/math";

/** Calidad (0..1) del staff de un club en cada área del plan. */
export interface StaffQuality {
  coaching: number;
  nutrition: number;
  conditioning: number;
  medical: number;
}

const staffCache = new WeakMap<World, Map<string, StaffQuality>>();

/** Calidad media del staff de un club (se recalcula cada mes: el staff puede cambiar). */
export function staffQuality(world: World, club: Club | undefined): StaffQuality {
  if (!club) return { coaching: 0.35, nutrition: 0.3, conditioning: 0.3, medical: 0.3 };
  let cache = staffCache.get(world);
  if (!cache) staffCache.set(world, (cache = new Map()));
  const hit = cache.get(club.id);
  if (hit) return hit;
  const avg = (pick: (s: NonNullable<World["staff"][string]>) => number | null) => {
    let sum = 0;
    let n = 0;
    for (const id of club.staff) {
      const s = world.staff[id];
      if (!s) continue;
      const v = pick(s);
      if (v === null) continue;
      sum += v;
      n++;
    }
    return n ? sum / n / 20 : 0.3;
  };
  const q: StaffQuality = {
    coaching: avg((s) => (s.role === "coach" || s.role === "assistant" || s.role === "headCoach" ? s.attributes.coaching : null)),
    nutrition: avg((s) => (s.role === "nutritionist" ? s.attributes.nutrition : null)),
    conditioning: avg((s) => (s.role === "fitnessCoach" ? s.attributes.conditioning : null)),
    medical: avg((s) => (s.role === "physio" ? s.attributes.physiotherapy : null)),
  };
  cache.set(club.id, q);
  return q;
}

/** Vacía la caché de staff (al cambiar de mes). */
export function resetStaffCache(world: World): void {
  staffCache.delete(world);
}

type Part = keyof PlanAdherence;

/** ¿Qué partes del plan piden algo al jugador? */
export function activeParts(plan: DevelopmentPlan): Part[] {
  const parts: Part[] = ["training"];
  if (plan.diet !== "standard") parts.push("diet");
  if (plan.exercise !== "none") parts.push("exercise");
  if (plan.sleep === "routine") parts.push("sleep");
  return parts;
}

/**
 * Cuánto sigue el jugador cada parte del plan este mes. Pesa su profesionalidad y su
 * mentalidad de crecimiento, la autoridad del técnico y la calidad del staff; resta su vida
 * fuera del campo (sobre todo en sueño y dieta) y el ego cuando el plan es exigente.
 */
export function rollAdherence(p: Player, plan: DevelopmentPlan, authority: number, q: StaffQuality, age: number, rng: Rng): PlanAdherence {
  const ps = p.psych;
  const demanding = plan.intensity === "high" || plan.exercise !== "none";
  const staffFor: Record<Part, number> = { training: q.coaching, diet: q.nutrition, exercise: q.conditioning, sleep: q.medical };
  const out: PlanAdherence = { training: "full", diet: "full", exercise: "full", sleep: "full" };
  for (const part of activeParts(plan)) {
    const score = clamp01(
      ADHERENCE.base +
        ADHERENCE.professionalism * (ps.professionalism - 0.5) +
        ADHERENCE.growthMindset * (ps.growthMindset - 0.5) +
        ADHERENCE.authority * (authority - 0.5) +
        ADHERENCE.staff * (staffFor[part] - 0.5) -
        ADHERENCE.offPitch[part] * ps.offPitchLife -
        (demanding && part !== "sleep" ? ADHERENCE.egoDemanding * ps.ego : 0) +
        (age < 21 ? 0.05 : 0),
    );
    const r = rng.float();
    out[part] = r < score ? "full" : r < score + (1 - score) * 0.45 ? "partial" : "none";
  }
  return out;
}

export interface PlanEffects {
  /** Multiplicador del crecimiento mensual. */
  growth: number;
  /** Peso extra de los atributos del foco (0 = sin foco). */
  focus: number;
  /** Cambios directos de atributos este mes. */
  attrs: Partial<Record<keyof Player["technical"] | keyof Player["mental"] | keyof Player["physical"], number>>;
  weightKg: number;
  recoveryMult: number;
  injuryRiskDelta: number;
  /** Protección frente al declive físico (0..0.35). */
  declineProtection: number;
  /** Calidad global del plan cumplido (0..1, 0.5 = sin plan): empuja el techo latente. */
  score: number;
  /** Contribución de cada parte para el informe «¿por qué?». */
  factors: { key: string; value: number }[];
}

const NO_PLAN: PlanEffects = {
  growth: 1, focus: 0, attrs: {}, weightKg: 0, recoveryMult: 1, injuryRiskDelta: 0, declineProtection: 0, score: 0.5, factors: [],
};

export function planEffects(plan: DevelopmentPlan | undefined, adh: PlanAdherence | undefined, q: StaffQuality): PlanEffects {
  if (!plan || !adh) return NO_PLAN;
  const a = (part: keyof PlanAdherence) => ADHERENCE_VALUE[adh[part] as Adherence];
  const fx: PlanEffects = { ...NO_PLAN, attrs: {}, factors: [] };
  const add = (attrs: Partial<Record<string, number>>, k: number) => {
    for (const [key, v] of Object.entries(attrs)) {
      const cur = (fx.attrs as Record<string, number>)[key] ?? 0;
      (fx.attrs as Record<string, number>)[key] = cur + (v ?? 0) * k;
    }
  };
  // Entrenamiento: intensidad y foco.
  const at = a("training");
  const intensity = INTENSITY[plan.intensity];
  fx.growth = 1 + (intensity.growth - 1) * at - (1 - at) * 0.08;
  fx.focus = plan.focus === "balanced" ? 0 : at;
  fx.injuryRiskDelta += intensity.injury * at;
  fx.recoveryMult *= 1 + (intensity.recovery - 1) * at;
  fx.factors.push({ key: "plan.training", value: (at - 0.5) * (0.6 + q.coaching) });
  // Dieta.
  if (plan.diet !== "standard") {
    const ad = a("diet") * (0.4 + 0.8 * q.nutrition);
    const d = DIET_EFFECTS[plan.diet];
    add(d.attrs, ad);
    fx.weightKg += d.weightKg * ad;
    fx.recoveryMult *= 1 + (d.recovery - 1) * ad;
    fx.injuryRiskDelta += d.injury * ad;
    fx.declineProtection += 0.1 * ad;
    fx.factors.push({ key: "plan.diet", value: a("diet") - 0.5 });
  }
  // Rutina de ejercicio.
  if (plan.exercise !== "none") {
    const ae = a("exercise") * (0.4 + 0.8 * q.conditioning);
    const e = EXERCISE_EFFECTS[plan.exercise];
    add(e.attrs, ae);
    fx.injuryRiskDelta += e.injury * a("exercise") * (1.2 - q.conditioning) + (plan.intensity === "high" ? OVERLOAD_INJURY * a("exercise") : 0);
    fx.declineProtection += 0.15 * ae;
    fx.factors.push({ key: "plan.exercise", value: a("exercise") - 0.5 });
  }
  // Sueño.
  if (plan.sleep === "routine") {
    const as = a("sleep");
    fx.recoveryMult *= 1 + (SLEEP_RECOVERY - 1) * as;
    fx.declineProtection += 0.05 * as;
    fx.factors.push({ key: "plan.sleep", value: as - 0.5 });
  }
  const parts = activeParts(plan);
  fx.score = 0.5 + 0.5 * (parts.reduce((s, p) => s + a(p), 0) / parts.length - 0.5) + 0.15 * q.coaching;
  return fx;
}
