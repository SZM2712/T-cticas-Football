// Estado y utilidades comunes de los medios (Fase 5).

import { POSTS_KEPT, REACH_MEDIUM, REACH_VIRAL } from "../config/media";
import type { World } from "../types/domain";
import type { GameDay } from "../types/ids";
import type { MediaState, MediaSubject, Post, Reach } from "../types/media";
import { clamp, round } from "../util/math";
import { nextId } from "../world/ids";

export function emptyMedia(): MediaState {
  return {
    journalists: {}, relations: {}, narratives: {}, conferences: {}, asked: {}, posts: [], statements: [], directives: {},
    referees: {}, controversies: {}, cases: {}, touchlineBans: {}, stadiumClosures: {}, form: {}, scoring: {}, cursor: 0,
  };
}

/** Clave estable de un sujeto ("player:pl_000012"). */
export function subjectKey(s: MediaSubject): string {
  return `${s.kind}:${s.id}`;
}

/** Referencia a un evento del mundo como hecho enlazable. */
export function eventRef(index: number): string {
  return `ev:${index}`;
}

/** Empuja un evento del mundo y devuelve su referencia. */
export function pushEvent(world: World, day: GameDay, type: string, data: World["events"][number]["data"]): string {
  world.events.push({ day, type, data });
  return eventRef(world.events.length - 1);
}

/** Relación periodista–mánager (−1..1). */
export function relationOf(world: World, journalist: string, manager: string): number {
  return world.media.relations[`${journalist}|${manager}`] ?? 0;
}

export function addRelation(world: World, journalist: string, manager: string, delta: number): void {
  const key = `${journalist}|${manager}`;
  world.media.relations[key] = round(clamp((world.media.relations[key] ?? 0) + delta, -1, 1), 3);
}

/** Alcance cualitativo a partir de una puntuación 0..1. */
export function reachOf(score: number): Reach {
  return score >= REACH_VIRAL ? "viral" : score >= REACH_MEDIUM ? "medium" : "low";
}

/** Publica algo (las publicaciones más antiguas se olvidan). */
export function publish(world: World, post: Omit<Post, "id">): Post {
  const p: Post = { id: nextId<string>(world, "ps", 7), ...post };
  world.media.posts.push(p);
  if (world.media.posts.length > POSTS_KEPT) world.media.posts.splice(0, world.media.posts.length - POSTS_KEPT);
  return p;
}
