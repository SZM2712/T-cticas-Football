// Vista de desarrollo de un jugador para la UI: evolución, informe «¿por qué?»,
// plan individual con lo que de verdad hace, staff que lo prepara e informes de ojeadores.
// Regla 6: nunca el techo latente ni rasgos ocultos; los factores se muestran como texto.

import { scoutReportsView, type ScoutReportView } from "../development/scouting";
import { fitnessOn, isInjured } from "../match/lineup";
import { marketValue } from "../player/value";
import { currentAbility } from "../player/ability";
import type { World } from "../types/domain";
import type { DevelopmentPlan, PlanAdherence, RetirementIntent } from "../types/development";
import type { PlayerId } from "../types/ids";
import { playerView, type PlayerView } from "./player";

export interface PlayerDevelopmentView extends PlayerView {
  /** Nivel actual (1 decimal) y su evolución: últimos 24 meses y cierres de temporada. */
  level: number;
  monthly: number[];
  yearly: number[];
  weightKg: number;
  fitness: number;
  injuredDays: number;
  /** Factores del último mes: clave y sentido/intensidad (−2..2), nunca valores ocultos. */
  factors: { key: string; trend: -2 | -1 | 1 | 2 }[];
  plan: DevelopmentPlan | null;
  adherence: PlanAdherence | null;
  /** Staff del club que prepara cada parte del plan. */
  staff: { role: string; name: string }[];
  scouts: ScoutReportView[];
  /** Se está planteando retirarse (y lo que ya le dijo el técnico) o ya lo anunció. */
  retirement: RetirementIntent | null;
  retiring: boolean;
  /** Posibles mentores: compañeros veteranos. */
  mentors: { id: PlayerId; name: string }[];
  /** Contrato visible: salario semanal (€) y día en que vence (null si no tiene club). */
  contract: { wage: number; expires: number } | null;
  /** Valor de mercado estimado (€), solo con datos visibles. */
  value: number;
}

export function playerDevelopmentView(world: World, id: PlayerId): PlayerDevelopmentView {
  const p = world.players[id];
  if (!p) throw new Error(`Jugador desconocido: ${id}`);
  const base = playerView(world, id);
  const day = world.meta.today;
  const club = p.clubId ? world.clubs[p.clubId] : undefined;
  const staff = (club?.staff ?? [])
    .map((sid) => world.staff[sid]!)
    .filter((s) => s && ["coach", "physio", "nutritionist", "fitnessCoach"].includes(s.role))
    .map((s) => ({ role: s.role, name: `${s.firstName} ${s.lastName}` }));
  const mentors = (club?.squad ?? [])
    .map((pid) => world.players[pid]!)
    .filter((m) => m && m.id !== p.id && day - m.birthDay >= 26 * 365.2425)
    .map((m) => ({ id: m.id, name: m.knownAs ?? `${m.firstName} ${m.lastName}` }));
  return {
    ...base,
    contract: p.contract ? { wage: p.contract.wage, expires: p.contract.expires } : null,
    value: marketValue(p, day),
    level: Math.round(currentAbility(p) * 10) / 10,
    monthly: p.development.caMonthly.map((x) => x / 10),
    yearly: p.development.caYearly.map((x) => x / 10),
    weightKg: Math.round(p.weightKg * 10) / 10,
    fitness: Math.round(fitnessOn(p, day) * 100),
    injuredDays: isInjured(p, day) ? p.injury!.until - day : 0,
    factors: p.development.recentFactors.map((f) => ({
      key: f.key,
      trend: (f.value >= 0.3 ? 2 : f.value > 0 ? 1 : f.value <= -0.3 ? -2 : -1) as -2 | -1 | 1 | 2,
    })),
    plan: world.plans[id] ?? null,
    adherence: world.plans[id] ? (p.development.adherence ?? null) : null,
    staff,
    scouts: scoutReportsView(world, id),
    retirement: p.retirementIntent ?? null,
    retiring: p.retiring ?? false,
    mentors,
  };
}
