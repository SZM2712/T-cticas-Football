// Comandos del usuario: la UI nunca muta el mundo; envía un Command que el núcleo valida
// y aplica. (En la Fase 4 se validan también contra los permisos del cargo, DISEÑO §11.2.)

import { FORMATIONS } from "../match/tactics";
import type { World } from "../types/domain";
import { exactAge } from "../time/calendar";
import { DIETS, EXERCISES, INTENSITIES, SLEEP_PLANS, TRAINING_FOCUSES, type DevelopmentPlan } from "../types/development";
import { isNationalTeamId, type PlayerId, type TeamId } from "../types/ids";
import { MENTOR_MIN_AGE } from "../config/development";
import { INSTRUCTION_KEYS, type TacticsPlan } from "../types/tactics";

export type Command =
  | { type: "setTactics"; team: TeamId; plan: TacticsPlan }
  | { type: "clearTactics"; team: TeamId }
  /** Plan individual de desarrollo (entrenamiento, dieta, ejercicio, sueño, mentor). */
  | { type: "setPlan"; player: PlayerId; plan: DevelopmentPlan }
  | { type: "clearPlan"; player: PlayerId };

export type CommandResult = { ok: true } | { ok: false; error: string };

const SET_PIECE_VALUES: Record<string, readonly string[]> = {
  corners: ["nearPost", "farPost", "short", "edgeOfBox"],
  cornerCrowd: ["stay", "some", "all"],
  freeKicks: ["shoot", "cross", "short"],
  throwIns: ["short", "long"],
  kickoff: ["buildUp", "long"],
};

function squadOf(world: World, team: TeamId): readonly string[] | undefined {
  return isNationalTeamId(team) ? world.nationalTeams[team]?.squad : world.clubs[team]?.squad;
}

/** Comprueba un plan táctico; devuelve la clave del error (para traducir en la UI) o null. */
export function validatePlan(world: World, team: TeamId, plan: TacticsPlan): string | null {
  const squad = squadOf(world, team);
  if (!squad) return "error.unknownTeam";
  const inSquad = new Set(squad);
  if (plan.formation && !FORMATIONS[plan.formation]) return "error.formation";
  if (plan.lineup && (plan.lineup.length !== 11 || plan.lineup.some((id) => !inSquad.has(id)) || new Set(plan.lineup).size !== 11)) {
    return "error.lineup";
  }
  for (const k of ["mentality", "pressing", "tempo", "width", "directness"] as const) {
    const v = plan[k];
    if (v === undefined) continue;
    const [lo, hi] = k === "mentality" ? [-1, 1] : [0, 1];
    if (!Number.isFinite(v) || v < lo || v > hi) return "error.range";
  }
  const sp = plan.setPieces;
  if (sp) {
    for (const [k, allowed] of Object.entries(SET_PIECE_VALUES)) {
      const v = (sp as Record<string, unknown>)[k];
      if (v !== undefined && !allowed.includes(v as string)) return "error.setPiece";
    }
    const takers = [...(sp.penaltyTakers ?? []), sp.freeKickTaker, sp.cornerTaker, sp.throwInTaker];
    if (takers.some((id) => id && !inSquad.has(id))) return "error.taker";
  }
  for (const i of plan.instructions ?? []) {
    if (!inSquad.has(i.player) || !INSTRUCTION_KEYS.includes(i.key)) return "error.instruction";
  }
  return null;
}

/** Comprueba un plan individual; devuelve la clave del error o null. */
export function validateDevPlan(world: World, playerId: PlayerId, plan: DevelopmentPlan): string | null {
  const p = world.players[playerId];
  if (!p || p.retired) return "error.unknownPlayer";
  if (
    !TRAINING_FOCUSES.includes(plan.focus) || !INTENSITIES.includes(plan.intensity) || !DIETS.includes(plan.diet) ||
    !EXERCISES.includes(plan.exercise) || !SLEEP_PLANS.includes(plan.sleep)
  ) return "error.plan";
  if (plan.mentor !== undefined) {
    const m = world.players[plan.mentor];
    if (!m || m.retired || m.id === p.id || m.clubId !== p.clubId || exactAge(m.birthDay, world.meta.today) < MENTOR_MIN_AGE) return "error.mentor";
  }
  return null;
}

export function applyCommand(world: World, cmd: Command): CommandResult {
  switch (cmd.type) {
    case "setTactics": {
      const error = validatePlan(world, cmd.team, cmd.plan);
      if (error) return { ok: false, error };
      world.tactics[cmd.team] = JSON.parse(JSON.stringify(cmd.plan)) as TacticsPlan;
      return { ok: true };
    }
    case "clearTactics":
      delete world.tactics[cmd.team];
      return { ok: true };
    case "setPlan": {
      const error = validateDevPlan(world, cmd.player, cmd.plan);
      if (error) return { ok: false, error };
      const plan: DevelopmentPlan = {
        focus: cmd.plan.focus, intensity: cmd.plan.intensity, diet: cmd.plan.diet, exercise: cmd.plan.exercise, sleep: cmd.plan.sleep,
      };
      if (cmd.plan.mentor) plan.mentor = cmd.plan.mentor;
      world.plans[cmd.player] = plan;
      return { ok: true };
    }
    case "clearPlan":
      delete world.plans[cmd.player];
      return { ok: true };
  }
}
