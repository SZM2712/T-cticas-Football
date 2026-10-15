// Comandos del usuario: la UI nunca muta el mundo; envía un Command que el núcleo valida
// y aplica. Cada comando lleva su autor (`by`, el mánager humano): con varios humanos en la
// partida (DISEÑO §11.3) solo puede actuar sobre su propio club.

import { FORMATIONS, defaultSetPieces as defaultSetPiecesFor } from "../match/tactics";
import type { World } from "../types/domain";
import { exactAge } from "../time/calendar";
import {
  DIETS, EXERCISES, INTENSITIES, PERSUASION_APPROACHES, SLEEP_PLANS, TRAINING_FOCUSES, type DevelopmentPlan, type PersuasionApproach,
} from "../types/development";
import { isNationalTeamId, type PlayerId, type TeamId } from "../types/ids";
import { MENTOR_MIN_AGE } from "../config/development";
import { INSTRUCTION_KEYS, type TacticsPlan } from "../types/tactics";
import { ENVY_RENEW_SHARE, ROOSTER_ROLE_IMPULSE, TALK_COOLDOWN } from "../config/social";
import { renegotiate } from "../social/commitments";
import { relieve } from "../social/ego";
import { takeCharge } from "../social";
import { managerRef, remember } from "../social/store";
import { talk, type TalkArgs } from "../social/talk";
import { SYMBOLIC_ROLES, TALK_TOPICS, type ManagerId, type Manager } from "../types/social";
import type { ClubId, GameDay } from "../types/ids";
import { worldRng } from "../world/rng";

export type Command =
  | { type: "setTactics"; team: TeamId; plan: TacticsPlan }
  | { type: "clearTactics"; team: TeamId }
  /** Plan individual de desarrollo (entrenamiento, dieta, ejercicio, sueño, mentor). */
  | { type: "setPlan"; player: PlayerId; plan: DevelopmentPlan }
  | { type: "clearPlan"; player: PlayerId }
  /** Intentar convencer a un jugador que se plantea retirarse (una vez; él decide). */
  | { type: "persuadeRetirement"; player: PlayerId; approach: PersuasionApproach }
  // ── Vestuario (Fase 4) ──
  /** Un humano toma el mando de un club (se crea su mánager si no existe). */
  | { type: "takeCharge"; club: ClubId; name: string }
  /** Conversación con un jugador (una por semana); las promesas crean `Commitment`s. */
  | ({ type: "talk"; player: PlayerId } & TalkArgs)
  | { type: "setCaptain"; player: PlayerId }
  /** Lanzador designado de penaltis o faltas (también fija el plan táctico). */
  | { type: "setRoleTaker"; role: "penalties" | "freeKicks"; player: PlayerId }
  /** Renovación con nuevo salario semanal (la negociación completa llega en la Fase 6). */
  | { type: "renewContract"; player: PlayerId; wage: number; years: number }
  /** Renegociar una promesa (cuesta confianza, menos que romperla). */
  | { type: "renegotiateCommitment"; commitment: string }
  | { type: "markInboxRead"; ids: string[] };

export type CommandResult = { ok: true; talk?: { success: boolean; reaction: string; commitments: string[] } } | { ok: false; error: string };

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

/**
 * Mánager que actúa: el autor si se indica; si no, el único humano de la partida. Con varios
 * humanos el autor es obligatorio.
 */
function actor(world: World, by: ManagerId | undefined): Manager | undefined {
  if (by) return world.managers[by];
  const ids = Object.keys(world.managers);
  return ids.length === 1 ? world.managers[ids[0]!] : undefined;
}

/** El mánager dirige el club de este jugador. */
function ownPlayer(world: World, by: ManagerId | undefined, player: string): { mgr: Manager; clubId: ClubId } | string {
  const mgr = actor(world, by);
  if (!mgr || !mgr.clubId) return "error.noManager";
  const p = world.players[player];
  if (!p || p.retired) return "error.unknownPlayer";
  if (p.clubId !== mgr.clubId || !world.dressing[mgr.clubId]) return "error.notYourPlayer";
  return { mgr, clubId: mgr.clubId };
}

export function applyCommand(world: World, cmd: Command, by?: ManagerId): CommandResult {
  // Con humanos en la partida, la táctica de un club solo la cambia quien lo dirige.
  if ((cmd.type === "setTactics" || cmd.type === "clearTactics") && Object.keys(world.managers).length && world.clubs[cmd.team]) {
    const mgr = actor(world, by);
    const owner = Object.values(world.managers).find((m) => m.clubId === cmd.team);
    if (owner && mgr?.id !== owner.id) return { ok: false, error: "error.notYourTeam" };
  }
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
    case "persuadeRetirement": {
      const intent = world.players[cmd.player]?.retirementIntent;
      if (!intent) return { ok: false, error: "error.noRetirement" };
      if (intent.persuasion) return { ok: false, error: "error.alreadyTalked" };
      if (!PERSUASION_APPROACHES.includes(cmd.approach)) return { ok: false, error: "error.plan" };
      intent.persuasion = cmd.approach;
      world.events.push({ day: world.meta.today, type: "manager.persuadedRetirement", data: { player: cmd.player, approach: cmd.approach } });
      return { ok: true };
    }
    case "takeCharge": {
      if (!world.clubs[cmd.club]) return { ok: false, error: "error.unknownTeam" };
      const other = Object.values(world.managers).find((m) => m.clubId === cmd.club && m.id !== by);
      if (other) return { ok: false, error: "error.clubTaken" };
      takeCharge(world, cmd.club, cmd.name.trim().slice(0, 40) || "Manager", by);
      return { ok: true };
    }
    case "talk": {
      const own = ownPlayer(world, by, cmd.player);
      if (typeof own === "string") return { ok: false, error: own };
      if (!TALK_TOPICS.includes(cmd.topic)) return { ok: false, error: "error.topic" };
      const dr = world.dressing[own.clubId]!;
      const day = world.meta.today;
      const last = dr.talks[cmd.player];
      if (last !== undefined && day - last < TALK_COOLDOWN) return { ok: false, error: "error.talkedRecently" };
      if (cmd.topic === "agreeRoles") {
        const o = cmd.other ? world.players[cmd.other] : undefined;
        if (!o || o.clubId !== own.clubId || o.id === cmd.player) return { ok: false, error: "error.unknownPlayer" };
        if (!cmd.role || !cmd.otherRole || cmd.role === cmd.otherRole) return { ok: false, error: "error.roles" };
      }
      for (const r of [cmd.role, cmd.otherRole]) if (r !== undefined && !SYMBOLIC_ROLES.includes(r)) return { ok: false, error: "error.roles" };
      if (cmd.minStartsPct !== undefined && !(cmd.minStartsPct > 0 && cmd.minStartsPct <= 1)) return { ok: false, error: "error.range" };
      dr.talks[cmd.player] = day;
      const args: TalkArgs = { topic: cmd.topic };
      if (cmd.minStartsPct !== undefined) args.minStartsPct = cmd.minStartsPct;
      if (cmd.role !== undefined) args.role = cmd.role;
      if (cmd.other !== undefined) args.other = cmd.other;
      if (cmd.otherRole !== undefined) args.otherRole = cmd.otherRole;
      if (cmd.wage !== undefined) args.wage = cmd.wage;
      if (cmd.days !== undefined) args.days = cmd.days;
      const res = talk(world, own.clubId, own.mgr, world.players[cmd.player]!, args, day, worldRng(world).fork(`talk/${day}/${cmd.player}`));
      return { ok: true, talk: res };
    }
    case "setCaptain": {
      const own = ownPlayer(world, by, cmd.player);
      if (typeof own === "string") return { ok: false, error: own };
      const dr = world.dressing[own.clubId]!;
      const day = world.meta.today;
      const me = [managerRef(own.mgr.id)];
      if (dr.captain && dr.captain !== cmd.player) {
        remember(world, day, { owner: dr.captain, about: me, kind: "captaincyRemoved", valence: -0.7, intensity: 0.7, publicness: "public", source: "setCaptain" });
      }
      dr.captain = cmd.player;
      remember(world, day, { owner: cmd.player, about: me, kind: "captaincyGiven", valence: 0.7, intensity: 0.6, publicness: "public", source: "setCaptain" });
      return { ok: true };
    }
    case "setRoleTaker": {
      const own = ownPlayer(world, by, cmd.player);
      if (typeof own === "string") return { ok: false, error: own };
      if (cmd.role !== "penalties" && cmd.role !== "freeKicks") return { ok: false, error: "error.roles" };
      setRoleTaker(world, own.clubId, own.mgr.id, cmd.role, cmd.player, world.meta.today);
      return { ok: true };
    }
    case "renewContract": {
      const own = ownPlayer(world, by, cmd.player);
      if (typeof own === "string") return { ok: false, error: own };
      const p = world.players[cmd.player]!;
      if (!p.contract || !Number.isFinite(cmd.wage) || !Number.isInteger(cmd.years) || cmd.years < 1 || cmd.years > 5) return { ok: false, error: "error.range" };
      if (cmd.wage < p.contract.wage) return { ok: false, error: "error.wageTooLow" };
      const day = world.meta.today;
      p.contract = { ...p.contract, wage: Math.round(cmd.wage), signed: day, expires: (day + cmd.years * 365) as GameDay };
      remember(world, day, { owner: p.id, about: [managerRef(own.mgr.id)], kind: "renewed", valence: 0.6, intensity: 0.5, publicness: "public", source: "renew" });
      // Celos salariales: se apagan si ya cobra al menos el 90 % de lo que cobra el que más.
      const top = Math.max(0, ...world.clubs[own.clubId]!.squad.filter((id) => id !== p.id).map((id) => world.players[id]?.contract?.wage ?? 0));
      if (p.contract.wage >= ENVY_RENEW_SHARE * top) relieve(p, "salaryEnvy", 1);
      else relieve(p, "salaryEnvy", 0.3);
      world.events.push({ day, type: "manager.renewed", data: { player: p.id, wage: p.contract.wage, years: cmd.years } });
      return { ok: true };
    }
    case "renegotiateCommitment": {
      const c = world.commitments[cmd.commitment];
      const mgr = actor(world, by);
      if (!c || !mgr || c.madeBy !== mgr.id) return { ok: false, error: "error.unknownCommitment" };
      if (c.status !== "active" && c.status !== "atRisk") return { ok: false, error: "error.commitmentClosed" };
      renegotiate(world, c, world.meta.today);
      return { ok: true };
    }
    case "markInboxRead": {
      const mgr = actor(world, by);
      const ids = new Set(cmd.ids);
      for (const item of world.inbox) if (ids.has(item.id) && (!mgr || item.clubId === mgr.clubId)) item.read = true;
      return { ok: true };
    }
  }
}

/** Lanzador designado: quitárselo a otro deja recuerdo y, entre gallos, enciende la tensión. */
function setRoleTaker(world: World, clubId: ClubId, mgr: ManagerId, role: "penalties" | "freeKicks", player: PlayerId, day: GameDay): void {
  const dr = world.dressing[clubId]!;
  const prev = dr.roles[role];
  const me = [managerRef(mgr)];
  if (prev && prev !== player) {
    remember(world, day, { owner: prev, about: me, kind: "roleTaken", valence: -0.5, intensity: 0.5, publicness: "squad", source: `role:${role}` });
    const a = world.players[prev];
    const b = world.players[player];
    for (const [x, y] of [[a, b], [b, a]] as const) {
      if (!x || !y) continue;
      const key = `roosters:${y.id}`;
      if (x.state.tensions[key] !== undefined) x.state.tensions[key] = Math.min(1, x.state.tensions[key]! + ROOSTER_ROLE_IMPULSE);
    }
  }
  dr.roles[role] = player;
  remember(world, day, { owner: player, about: me, kind: "roleGiven", valence: 0.4, intensity: 0.4, publicness: "squad", source: `role:${role}` });
  const plan = (world.tactics[clubId] ??= {});
  const sp = { ...defaultSetPiecesFor(clubId), ...(plan.setPieces ?? {}) };
  if (role === "penalties") sp.penaltyTakers = [player, ...sp.penaltyTakers.filter((id) => id !== player)].slice(0, 5);
  else sp.freeKickTaker = player;
  plan.setPieces = sp;
}
