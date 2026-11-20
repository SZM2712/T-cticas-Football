// Utilidades del vestuario: claves de relaciones, valencia, confianza en el mánager,
// memoria episódica y buzón. Todo determinista (claves ordenadas, sin iterar Map/Set).

import {
  MEMORY_HALF_LIFE, MEMORY_MAX_PER_PLAYER, MEMORY_PRUNE, PUBLICNESS_MULT, TRUST_START, VALENCE_WEIGHTS,
} from "../config/social";
import type { Player, World } from "../types/domain";
import type { ClubId, GameDay, PlayerId } from "../types/ids";
import type {
  ActorRef, InboxItem, InboxKind, Manager, ManagerId, Memory, MemoryKind, Publicness, Relationship,
} from "../types/social";
import { clamp, round } from "../util/math";
import { nextId } from "../world/ids";

// ── Mánagers ───────────────────────────────────────────────────────────────

/** Mánager humano que dirige un club (o undefined si lo lleva la IA). */
export function managerOf(world: World, clubId: ClubId | string | null | undefined): Manager | undefined {
  if (!clubId) return undefined;
  for (const id of Object.keys(world.managers).sort()) {
    const m = world.managers[id]!;
    if (m.clubId === clubId) return m;
  }
  return undefined;
}

/** Clubes con vestuario simulado (dirigidos por humanos), en orden estable. */
export function managedClubs(world: World): ClubId[] {
  return Object.keys(world.dressing).sort() as ClubId[];
}

// ── Relaciones ─────────────────────────────────────────────────────────────

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function relation(world: World, a: string, b: string): Relationship | undefined {
  return world.relationships[pairKey(a, b)];
}

/** Respeto y envidia de `from` hacia `to`. */
export function directed(rel: Relationship, from: string, to: string): { respect: number; envy: number } {
  return from < to ? { respect: rel.respectAB, envy: rel.envyAB } : { respect: rel.respectBA, envy: rel.envyBA };
}

/** Valencia de `from` hacia `to` (−1..1), la que se usa para camarillas y para la UI (§3). */
export function valence(rel: Relationship, from: string, to: string): number {
  const { respect, envy } = directed(rel, from, to);
  const w = VALENCE_WEIGHTS;
  return clamp(w.affinity * rel.affinity + w.respect * respect - w.envy * envy - w.rivalryOverRespect * Math.max(0, rel.rivalry - respect), -1, 1);
}

// ── Confianza en el mánager ────────────────────────────────────────────────

export function trustKey(player: string, manager: ManagerId): string {
  return `${player}|${manager}`;
}

export function trustOf(world: World, player: string, manager: ManagerId): number {
  return world.trust[trustKey(player, manager)]?.trust ?? TRUST_START;
}

export function addTrust(world: World, player: string, manager: ManagerId, delta: number, day: GameDay): void {
  const key = trustKey(player, manager);
  const t = (world.trust[key] ??= { trust: TRUST_START, sinceDay: day });
  t.trust = round(clamp(t.trust + delta, -1, 1), 4);
}

// ── Memoria episódica ──────────────────────────────────────────────────────

/** Semivida según el tipo, los rasgos del dueño y lo público que fue (§3). */
export function halfLife(p: Player, kind: MemoryKind, valence: number, publicness: Publicness): number {
  const ps = p.psych;
  // Lo negativo pesa más en quien tiene ego, necesita reconocimiento o es volátil; lo positivo, en los leales.
  const f = valence < 0
    ? 0.6 + 0.8 * ps.ego + 0.5 * ps.recognitionNeed + 0.4 * ps.temperament
    : 0.7 + 0.6 * ps.loyalty + 0.3 * ps.recognitionNeed;
  return Math.round(MEMORY_HALF_LIFE[kind] * f * PUBLICNESS_MULT[publicness]);
}

export function salience(m: Memory, day: number): number {
  return m.intensity * 0.5 ** ((day - m.day) / m.halfLifeDays);
}

export interface MemoryInput {
  owner: PlayerId;
  about: ActorRef[];
  kind: MemoryKind;
  valence: number;
  intensity: number;
  publicness: Publicness;
  source: string;
}

export function remember(world: World, day: GameDay, input: MemoryInput): Memory | undefined {
  const p = world.players[input.owner];
  if (!p || p.retired) return undefined;
  const id = nextId<string>(world, "mem", 7);
  const m: Memory = {
    id, owner: input.owner, about: input.about, kind: input.kind, day,
    valence: round(clamp(input.valence, -1, 1), 3), intensity: round(clamp(input.intensity, 0, 1), 3),
    publicness: input.publicness, halfLifeDays: halfLife(p, input.kind, input.valence, input.publicness), source: input.source,
  };
  world.memories[id] = m;
  p.memoryIds.push(id);
  if (p.memoryIds.length > MEMORY_MAX_PER_PLAYER) pruneMemories(world, p, day, MEMORY_MAX_PER_PLAYER);
  return m;
}

/** Quita los recuerdos que ya no pesan (y, si sobran, los menos prominentes). */
export function pruneMemories(world: World, p: Player, day: number, max = MEMORY_MAX_PER_PLAYER): void {
  const live = p.memoryIds
    .map((id) => world.memories[id])
    .filter((m): m is Memory => !!m && salience(m, day) >= MEMORY_PRUNE);
  live.sort((a, b) => salience(b, day) - salience(a, day) || (a.id < b.id ? -1 : 1));
  const keep = live.slice(0, max);
  const keepIds = new Set(keep.map((m) => m.id));
  for (const id of p.memoryIds) if (!keepIds.has(id)) delete world.memories[id];
  p.memoryIds = p.memoryIds.filter((id) => keepIds.has(id));
}

/** Suma de prominencia·valencia de los recuerdos de `owner` sobre un actor (para el ánimo y la UI). */
export function feelingAbout(world: World, owner: Player, about: (a: ActorRef) => boolean, day: number): number {
  let sum = 0;
  for (const id of owner.memoryIds) {
    const m = world.memories[id];
    if (m && m.about.some(about)) sum += salience(m, day) * m.valence;
  }
  return sum;
}

// ── Buzón ──────────────────────────────────────────────────────────────────

export function notify(
  world: World, day: GameDay, clubId: ClubId, kind: InboxKind,
  extra: Partial<Pick<InboxItem, "dynamic" | "player" | "other" | "commitment" | "channel">> = {},
): InboxItem {
  const item: InboxItem = { id: nextId<string>(world, "inb", 6), day, clubId, kind, read: false, ...extra };
  world.inbox.push(item);
  return item;
}

export const playerRef = (id: PlayerId): ActorRef => ({ kind: "player", id });
export const managerRef = (id: ManagerId): ActorRef => ({ kind: "manager", id });
