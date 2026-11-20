// Promesas del mánager (`Commitment`, DISEÑO §3): se crean en conversaciones (y en la prensa,
// Fase 5), se miden cada semana con una consulta pura sobre el mundo y, al vencer, se cumplen o
// se rompen. Romper una promesa deja recuerdos en el afectado y en los testigos y baja la
// confianza del vestuario en el mánager.

import {
  AT_RISK_MARGIN, TRUST_PROMISE_BROKEN, TRUST_PROMISE_KEPT, TRUST_RENEGOTIATED, TRUST_WITNESS_BROKEN,
} from "../config/social";
import type { World } from "../types/domain";
import type { ClubId, GameDay, PlayerId } from "../types/ids";
import type { Commitment, CommitmentType, ManagerId, Publicness } from "../types/social";
import { round } from "../util/math";
import { nextId } from "../world/ids";
import { squadPlayers } from "./graph";
import { addTrust, managerRef, notify, playerRef, remember } from "./store";

export interface NewCommitment {
  madeBy: ManagerId;
  clubId: ClubId;
  madeTo: PlayerId;
  type: CommitmentType;
  params: Record<string, string | number>;
  days: number;
  witnesses: Publicness;
  origin: Commitment["origin"];
}

/** Acciones de la UI que cumplen la promesa. */
function linkedActions(c: Pick<Commitment, "type" | "madeTo" | "params">): string[] {
  switch (c.type) {
    case "playingTime": return [`lineup:${c.madeTo}`];
    case "role": return [`setRoleTaker:${String(c.params.role)}:${c.madeTo}`];
    case "captaincy": return [`setCaptain:${c.madeTo}`];
    case "newContract": return [`renew:${c.madeTo}`];
    case "mentor": return [`assignMentor:${c.madeTo}:${String(c.params.menteeId)}`];
  }
}

export function makeCommitment(world: World, day: GameDay, input: NewCommitment): Commitment {
  const c: Commitment = {
    id: nextId<string>(world, "cm", 5), madeBy: input.madeBy, clubId: input.clubId, madeTo: input.madeTo,
    witnesses: input.witnesses, origin: input.origin, type: input.type, params: { ...input.params },
    createdDay: day, deadline: (day + input.days) as GameDay, progress: 0, status: "active", linkedActions: [],
  };
  c.linkedActions = linkedActions(c);
  world.commitments[c.id] = c;
  remember(world, day, {
    owner: input.madeTo, about: [managerRef(input.madeBy)], kind: "promiseMade", valence: 0.3, intensity: 0.4,
    publicness: input.witnesses, source: c.id,
  });
  return c;
}

/** Promesas vivas (activas o en riesgo) de un jugador, en orden estable. */
export function liveCommitments(world: World, player?: string, type?: CommitmentType): Commitment[] {
  return Object.keys(world.commitments).sort().map((id) => world.commitments[id]!)
    .filter((c) => (c.status === "active" || c.status === "atRisk") && (!player || c.madeTo === player) && (!type || c.type === type));
}

/** Cuenta un partido oficial para las promesas de minutos de los jugadores del club. */
export function countMatchForCommitments(world: World, clubId: ClubId, started: ReadonlySet<string>): void {
  for (const c of liveCommitments(world, undefined, "playingTime")) {
    if (c.clubId !== clubId) continue;
    c.params.matches = Number(c.params.matches ?? 0) + 1;
    if (started.has(c.madeTo)) c.params.starts = Number(c.params.starts ?? 0) + 1;
  }
}

/** ¿Se cumple ahora? Devuelve el progreso 0..1 (consulta pura). */
export function measure(world: World, c: Commitment): number {
  const p = world.players[c.madeTo];
  if (!p || p.clubId !== c.clubId) return 0;
  switch (c.type) {
    case "playingTime": {
      const matches = Number(c.params.matches ?? 0);
      if (matches === 0) return 1;
      return Math.min(1, Number(c.params.starts ?? 0) / matches / Number(c.params.minStartsPct));
    }
    case "role": {
      const dr = world.dressing[c.clubId];
      const role = String(c.params.role) as "penalties" | "freeKicks";
      return dr?.roles[role] === c.madeTo ? 1 : 0;
    }
    case "captaincy":
      return world.dressing[c.clubId]?.captain === c.madeTo ? 1 : 0;
    case "newContract":
      return p.contract && p.contract.wage >= Number(c.params.minWage) && p.contract.signed >= c.createdDay ? 1 : 0;
    case "mentor":
      return world.plans[String(c.params.menteeId)]?.mentor === c.madeTo ? 1 : 0;
  }
}

/**
 * Las que se cumplen con una acción puntual (renovar, nombrar capitán) se dan por cumplidas en
 * cuanto se hacen; las de minutos se juzgan al vencer.
 */
const KEEPS_EARLY: readonly CommitmentType[] = ["newContract", "captaincy", "role", "mentor"];

function resolve(world: World, c: Commitment, kept: boolean, day: GameDay): void {
  c.status = kept ? "kept" : "broken";
  const mgr = managerRef(c.madeBy);
  if (kept) {
    addTrust(world, c.madeTo, c.madeBy, TRUST_PROMISE_KEPT, day);
    remember(world, day, { owner: c.madeTo, about: [mgr], kind: "promiseKept", valence: 0.6, intensity: 0.6, publicness: c.witnesses, source: c.id });
    notify(world, day, c.clubId, "commitmentKept", { player: c.madeTo, commitment: c.id });
    return;
  }
  addTrust(world, c.madeTo, c.madeBy, TRUST_PROMISE_BROKEN, day);
  remember(world, day, { owner: c.madeTo, about: [mgr], kind: "promiseBroken", valence: -0.8, intensity: 0.85, publicness: c.witnesses, source: c.id });
  world.events.push({ day, type: "manager.promiseBroken", data: { commitment: c.id, player: c.madeTo, type: c.type } });
  notify(world, day, c.clubId, "commitmentBroken", { player: c.madeTo, commitment: c.id });
  if (c.witnesses === "private") return;
  // Los testigos lo recuerdan y confían menos en tu palabra.
  for (const w of squadPlayers(world, c.clubId)) {
    if (w.id === c.madeTo) continue;
    addTrust(world, w.id, c.madeBy, TRUST_WITNESS_BROKEN, day);
    remember(world, day, {
      owner: w.id, about: [mgr, playerRef(c.madeTo)], kind: "witnessedBrokenPromise", valence: -0.4, intensity: 0.35,
      publicness: c.witnesses, source: c.id,
    });
  }
}

/** Revisión semanal: progreso, avisos de riesgo y vencimientos. */
export function reviewCommitments(world: World, day: GameDay): void {
  for (const c of liveCommitments(world)) {
    const progress = measure(world, c);
    c.progress = round(progress, 3);
    const p = world.players[c.madeTo];
    if (!p || p.retired || p.clubId !== c.clubId) {
      c.status = "void";
      continue;
    }
    if (progress >= 1 && KEEPS_EARLY.includes(c.type)) {
      resolve(world, c, true, day);
      continue;
    }
    if (day >= c.deadline) {
      resolve(world, c, progress >= 1, day);
      continue;
    }
    const atRisk = progress < 1 - AT_RISK_MARGIN;
    if (atRisk && c.status === "active") notify(world, day, c.clubId, "commitmentAtRisk", { player: c.madeTo, commitment: c.id });
    c.status = atRisk ? "atRisk" : "active";
  }
}

/** Renegociar una promesa: cuesta algo de confianza, menos que romperla. */
export function renegotiate(world: World, c: Commitment, day: GameDay): void {
  c.status = "renegotiated";
  addTrust(world, c.madeTo, c.madeBy, TRUST_RENEGOTIATED, day);
  remember(world, day, {
    owner: c.madeTo, about: [managerRef(c.madeBy)], kind: "promiseRenegotiated", valence: -0.3, intensity: 0.4, publicness: "private", source: c.id,
  });
}
