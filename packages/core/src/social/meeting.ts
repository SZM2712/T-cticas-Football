// Reuniones del mánager con la plantilla (la primera es su presentación) y apoyo a la táctica.
// Cada jugador reacciona según su carácter, si el estilo anunciado le va, si el objetivo le
// parece a la altura del club y cuánto confía en el mánager; los líderes arrastran a su grupo.
// Todo deja huella: confianza, moral y un recuerdo por jugador.

import { MEETING, MEETING_AGREE, MEETING_EFFECT, MEETING_HISTORY } from "../config/social";
import { skillsOf } from "../match/lineup";
import type { Rng } from "../rng/rng";
import { ageOn } from "../time/calendar";
import type { Player, World } from "../types/domain";
import type { ClubId, GameDay } from "../types/ids";
import type {
  Manager, MeetingApproach, MeetingObjective, MeetingReason, MeetingStance, MeetingStyle, TeamMeeting,
} from "../types/social";
import { clamp, round } from "../util/math";
import { managerAuthority } from "./talk";
import { addTrust, managerRef, remember, trustOf } from "./store";

type Skills = ReturnType<typeof skillsOf>;

/** Habilidades que pide cada estilo (se comparan con la media del propio jugador). */
const STYLE_SKILLS: Record<MeetingStyle, (keyof Skills)[]> = {
  possession: ["passing", "technique", "firstTouch", "vision"],
  counter: ["pace", "dribbling", "finishing"],
  pressing: ["stamina", "workRate", "aggression", "pace"],
  direct: ["aerial", "strength", "crossing"],
  defensive: ["positioning", "marking", "tackling", "anticipation"],
};

/** Ambición de cada objetivo (0..1) para compararla con el nivel real del club en su liga. */
const OBJECTIVE_AMBITION: Record<MeetingObjective, number> = { title: 1, europe: 0.75, topHalf: 0.5, survival: 0.15, youth: 0.35 };

const STATUS_RANK = { prospect: 0, backup: 1, rotation: 2, firstTeam: 3, keyPlayer: 4 } as const;

/** Cuánto le va un estilo a un jugador (−1..1): sus habilidades de ese estilo frente a su media. */
export function styleSuit(p: Player, style: MeetingStyle): number {
  const sk = skillsOf(p);
  const keys = (Object.keys(sk) as (keyof Skills)[]).filter((k) => k !== "keeping" && k !== "oneOnOnes");
  const mean = keys.reduce((s, k) => s + sk[k], 0) / keys.length;
  const own = STYLE_SKILLS[style].reduce((s, k) => s + sk[k], 0) / STYLE_SKILLS[style].length;
  return clamp((own - mean) / 3, -1, 1);
}

/** Lo que se espera del club en su liga (0 = el peor, 1 = el mejor), por su calidad. */
export function clubStanding(world: World, clubId: ClubId): number {
  const club = world.clubs[clubId]!;
  const league = club.leagueId ? world.leagues[club.leagueId] : undefined;
  if (!league || league.clubs.length < 2) return 0.5;
  const better = league.clubs.filter((id) => (world.clubs[id]?.quality ?? 0) > club.quality).length;
  return 1 - better / (league.clubs.length - 1);
}

interface Terms {
  style: number;
  objective: number;
  approach: number;
  trust: number;
}

function reactionTerms(world: World, mgr: Manager, p: Player, m: Pick<TeamMeeting, "style" | "objective" | "approach">, standing: number, day: GameDay): Terms {
  const ps = p.psych;
  const age = ageOn(p.birthDay, day);
  // Objetivo: el ambicioso quiere apuntar alto; nadie se cree un objetivo muy por encima del
  // club, y al competitivo le molesta uno muy por debajo.
  const gap = OBJECTIVE_AMBITION[m.objective] - standing;
  let objective = 0.3 * (ps.ambition - 0.5) * OBJECTIVE_AMBITION[m.objective] * 2 - 0.5 * Math.max(0, gap - 0.25) - 0.4 * Math.max(0, -gap - 0.25) * ps.competitiveness;
  if (m.objective === "youth") objective += age <= 23 ? 0.2 : age >= 30 ? -0.2 : 0;
  // Forma de gestionar el grupo.
  const status = STATUS_RANK[p.state.expectedStatus];
  let approach: number;
  if (m.approach === "discipline") approach = 0.4 * (ps.professionalism - 0.5) - 0.4 * (ps.ego - 0.5);
  else if (m.approach === "freedom") approach = 0.3 * (ps.ego - 0.5) - 0.25 * (ps.professionalism - 0.5);
  else if (m.approach === "meritocracy") approach = status <= 1 ? 0.2 : status === 4 ? -0.3 * ps.ego : 0.05;
  else approach = (age >= 29 || status >= 3 ? 0.2 : 0) - (age <= 22 || status <= 1 ? 0.2 : 0);
  return {
    style: MEETING.style * styleSuit(p, m.style),
    objective: MEETING.objective * objective,
    approach: MEETING.approach * approach,
    trust: MEETING.trust * trustOf(world, p.id, mgr.id) + MEETING.authority * (managerAuthority(world, mgr, p) - 0.5),
  };
}

export interface MeetingArgs {
  style: MeetingStyle;
  objective: MeetingObjective;
  approach: MeetingApproach;
}

/**
 * Reunión con la plantilla. Cada jugador reacciona; el líder más influyente habla por el grupo
 * y arrastra a los de su camarilla. Deja confianza, moral y un recuerdo en cada uno.
 */
export function teamMeeting(world: World, clubId: ClubId, mgr: Manager, args: MeetingArgs, day: GameDay, rng: Rng): TeamMeeting {
  const dr = world.dressing[clubId]!;
  const first = dr.meetings.length === 0;
  const standing = clubStanding(world, clubId);
  const squad = [...world.clubs[clubId]!.squad].sort().map((id) => world.players[id]!).filter((p) => p && !p.retired);
  // Primera pasada: lo que piensa cada uno por su cuenta.
  const scores = new Map<string, { score: number; reason: MeetingReason }>();
  for (const p of squad) {
    const t = reactionTerms(world, mgr, p, args, standing, day);
    const score = t.style + t.objective + t.approach + t.trust + (first ? MEETING.firstBonus : 0) + rng.normal(0, MEETING.noise);
    const main = (Object.entries(t) as [keyof Terms, number][]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]) || a[0].localeCompare(b[0]))[0]![0];
    scores.set(p.id, { score, reason: main });
  }
  // Los líderes arrastran a su grupo hacia su postura.
  const leaders = squad.filter((p) => dr.levels[p.id] === "leader")
    .sort((a, b) => (dr.influence[b.id] ?? 0) - (dr.influence[a.id] ?? 0) || a.id.localeCompare(b.id));
  for (const leader of leaders) {
    const lead = scores.get(leader.id)!.score;
    for (const c of dr.cliques) {
      if (!c.members.includes(leader.id)) continue;
      for (const id of c.members) {
        const s = scores.get(id);
        if (!s || id === leader.id) continue;
        const pull = MEETING.leader * Math.sign(lead);
        if (Math.abs(pull) > Math.abs(s.score)) s.reason = "leader";
        s.score += pull;
      }
    }
  }
  const me = [managerRef(mgr.id)];
  const reactions: TeamMeeting["reactions"] = {};
  for (const p of squad) {
    const { score, reason } = scores.get(p.id)!;
    const stance: MeetingStance = score > MEETING_AGREE ? "agree" : score < -MEETING_AGREE ? "disagree" : "doubt";
    reactions[p.id] = { stance, reason };
    const fx = MEETING_EFFECT[stance];
    if (fx.trust) addTrust(world, p.id, mgr.id, fx.trust, day);
    p.state.morale = round(clamp(p.state.morale + fx.morale, -1, 1), 3);
    if (stance !== "doubt") {
      remember(world, day, {
        owner: p.id, about: me, kind: "teamMeeting", valence: stance === "agree" ? 0.3 : -0.3, intensity: first ? 0.45 : 0.3,
        publicness: "squad", source: `meeting:${day}`,
      });
    }
  }
  const meeting: TeamMeeting = { day, first, ...args, reactions };
  if (leaders[0]) meeting.spokesman = leaders[0].id;
  dr.meetings.push(meeting);
  if (dr.meetings.length > MEETING_HISTORY) dr.meetings.splice(0, dr.meetings.length - MEETING_HISTORY);
  const count = (s: MeetingStance) => Object.values(reactions).filter((r) => r.stance === s).length;
  world.events.push({
    day, type: first ? "manager.presentation" : "manager.teamMeeting",
    data: { club: clubId, style: args.style, objective: args.objective, approach: args.approach, agree: count("agree"), doubt: count("doubt"), disagree: count("disagree") },
  });
  return meeting;
}

/** Postura del jugador en la última reunión, si estuvo. */
export function lastStance(world: World, clubId: ClubId, playerId: string): MeetingStance | undefined {
  const m = world.dressing[clubId]?.meetings.at(-1);
  return m?.reactions[playerId]?.stance;
}

