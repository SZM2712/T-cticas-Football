// Conversaciones del mánager con un jugador (comando `talk`). El resultado lo decide el
// jugador según su carácter, la autoridad del mánager y la confianza que le tiene; toda
// promesa hecha en una conversación crea un `Commitment` con su acción enlazada.

import { AUTHORITY_TRUST, PROMISE_DAYS, TALK, TALK_TENSION_RELIEF } from "../config/social";
import type { Rng } from "../rng/rng";
import type { Player, World } from "../types/domain";
import type { ClubId, GameDay, PlayerId } from "../types/ids";
import type { Manager, SymbolicRole, TalkTopic } from "../types/social";
import { clamp, round } from "../util/math";
import { makeCommitment } from "./commitments";
import { relieve } from "./ego";
import { statusFromParticipation } from "./graph";
import { addTrust, managerRef, remember, trustOf } from "./store";

/** Autoridad de un mánager humano sobre un jugador (0..1): reputación relativa y confianza. */
export function managerAuthority(world: World, mgr: Manager, p: Player): number {
  return clamp(0.5 + (mgr.reputation - p.reputation) * 0.6 + AUTHORITY_TRUST * trustOf(world, p.id, mgr.id), 0, 1);
}

export interface TalkArgs {
  topic: TalkTopic;
  /** promisePlayingTime: cuota de titularidades (0..1). */
  minStartsPct?: number;
  /** promiseRole: papel prometido. agreeRoles: papel de este jugador. */
  role?: SymbolicRole;
  /** agreeRoles: el otro gallo y su papel. */
  other?: PlayerId;
  otherRole?: SymbolicRole;
  /** promiseContract: salario semanal prometido. */
  wage?: number;
  /** Plazo de la promesa en días. */
  days?: number;
}

export interface TalkResult {
  success: boolean;
  /** Clave de texto de la reacción (la UI la traduce). */
  reaction: string;
  commitments: string[];
}

/** Probabilidad de que la conversación salga bien (pura; no consume azar). */
export function talkChance(world: World, mgr: Manager, p: Player, topic: TalkTopic): number {
  const ps = p.psych;
  const maxTension = Math.max(0, ...Object.values(p.state.tensions));
  let c = TALK.base + TALK.authority * (managerAuthority(world, mgr, p) - 0.5) + TALK.trust * trustOf(world, p.id, mgr.id) +
    TALK.ego * (ps.ego - 0.5) + TALK.insecurity * (ps.insecurity - 0.5) + TALK.tension * maxTension;
  if (topic === "criticize") c += 0.3 * (ps.professionalism - 0.5) + 0.3 * (ps.growthMindset - 0.5) - 0.3 * (ps.temperament - 0.5);
  if (topic === "praise") c += 0.15 + 0.2 * (ps.recognitionNeed - 0.5);
  return clamp(c, 0.05, 0.95);
}

export function talk(world: World, clubId: ClubId, mgr: Manager, p: Player, args: TalkArgs, day: GameDay, rng: Rng): TalkResult {
  const success = rng.chance(talkChance(world, mgr, p, args.topic));
  const me = [managerRef(mgr.id)];
  const commitments: string[] = [];
  const s = p.state;
  const promise = (type: Parameters<typeof makeCommitment>[2]["type"], params: Record<string, string | number>, to: PlayerId = p.id): void => {
    const c = makeCommitment(world, day, {
      madeBy: mgr.id, clubId, madeTo: to, type, params, days: args.days ?? PROMISE_DAYS,
      witnesses: "private", origin: { kind: "conversation", refId: `talk:${day}:${p.id}` },
    });
    commitments.push(c.id);
  };
  const mood = (d: number): void => {
    s.morale = round(clamp(s.morale + d, -1, 1), 3);
  };
  switch (args.topic) {
    case "praise":
      mood(success ? 0.08 : 0.02);
      remember(world, day, { owner: p.id, about: me, kind: "privatePraise", valence: success ? 0.5 : 0.15, intensity: 0.3, publicness: "private", source: `talk:${day}` });
      break;
    case "criticize":
      if (success) {
        mood(-0.03);
        addTrust(world, p.id, mgr.id, 0.03, day);
        remember(world, day, { owner: p.id, about: me, kind: "privateCriticism", valence: -0.1, intensity: 0.25, publicness: "private", source: `talk:${day}` });
      } else {
        mood(-0.12);
        addTrust(world, p.id, mgr.id, -0.06, day);
        remember(world, day, { owner: p.id, about: me, kind: "badTalk", valence: -0.5, intensity: 0.45, publicness: "private", source: `talk:${day}` });
      }
      break;
    case "rolePlans": {
      if (success) {
        for (const key of Object.keys(s.tensions).sort()) relieve(p, key, TALK_TENSION_RELIEF);
        mood(0.05);
        // Si había celos salariales, la charla termina en una promesa de renovación (§5.4.1).
        if ((s.tensions.salaryEnvy ?? 0) > 0.2 && p.contract) promise("newContract", { minWage: Math.round(p.contract.wage * 1.25) });
      }
      remember(world, day, {
        owner: p.id, about: me, kind: success ? "goodTalk" : "badTalk", valence: success ? 0.4 : -0.3, intensity: 0.35, publicness: "private", source: `talk:${day}`,
      });
      break;
    }
    case "promisePlayingTime": {
      const pct = clamp(args.minStartsPct ?? 0.5, 0.1, 1);
      promise("playingTime", { minStartsPct: pct, matches: 0, starts: 0 });
      s.expectedStatus = statusFromParticipation(pct);
      relieve(p, "statusGap", success ? TALK_TENSION_RELIEF * 1.5 : TALK_TENSION_RELIEF * 0.5);
      break;
    }
    case "promiseRole": {
      const role = args.role ?? "penalties";
      promise(role === "captain" ? "captaincy" : "role", { role });
      for (const key of Object.keys(s.tensions).sort()) if (key.startsWith("roosters:")) relieve(p, key, success ? 0.25 : 0.1);
      break;
    }
    case "promiseContract": {
      const wage = Math.max(args.wage ?? Math.round((p.contract?.wage ?? 1000) * 1.2), 1);
      promise("newContract", { minWage: wage });
      relieve(p, "salaryEnvy", success ? TALK_TENSION_RELIEF * 1.5 : TALK_TENSION_RELIEF * 0.5);
      break;
    }
    case "agreeRoles": {
      // Roles pactados entre dos gallos: un papel para cada uno, prometido a ambos.
      const other = args.other ? world.players[args.other] : undefined;
      if (!other) break;
      promise(args.role === "captain" ? "captaincy" : "role", { role: args.role ?? "penalties" });
      promise(args.otherRole === "captain" ? "captaincy" : "role", { role: args.otherRole ?? "freeKicks" }, other.id);
      const relief = success ? 0.5 : 0.15;
      relieve(p, `roosters:${other.id}`, relief);
      relieve(other, `roosters:${p.id}`, relief);
      break;
    }
  }
  world.events.push({ day, type: "manager.talk", data: { player: p.id, topic: args.topic, success } });
  return { success, reaction: `talk.${args.topic}.${success ? "ok" : "bad"}`, commitments };
}
