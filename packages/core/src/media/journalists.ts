// Periodistas ficticios con línea editorial (Fase 5). Se crean por nación la primera vez que un
// humano dirige un club de ella: así el mundo de referencia no cambia y solo hay prensa donde
// alguien la va a leer. Nombres generados con las listas de bloqueo (regla 7).

import { JOURNALISTS_PER_NATION } from "../config/media";
import { generateName, pickCulture } from "../gen/names";
import type { World } from "../types/domain";
import type { ClubId } from "../types/ids";
import type { Journalist, OutletKind } from "../types/media";
import { round } from "../util/math";
import { nextId } from "../world/ids";
import { worldRng } from "../world/rng";

/** Reparto de medios en cada nación (se repite si hay más periodistas). */
const OUTLETS: readonly OutletKind[] = ["newspaper", "radio", "newspaper", "forum", "tv", "newspaper", "radio", "forum"];

/** Periodistas de una nación, en orden estable. */
export function journalistsOf(world: World, nation: string): Journalist[] {
  return Object.keys(world.media.journalists).sort().map((id) => world.media.journalists[id]!).filter((j) => j.nation === nation);
}

/** Crea los periodistas de la nación de un club si aún no existen. */
export function ensureJournalistsFor(world: World, clubId: ClubId | string): void {
  const club = world.clubs[clubId as ClubId];
  if (!club) return;
  const nation = world.nations[club.nation];
  if (!nation || journalistsOf(world, club.nation).length) return;
  const rng = worldRng(world).fork(`media/journalists/${club.nation}`);
  // Ciudades con club en las ligas de la nación; el medio es afín al club más grande de su ciudad.
  const clubs = Object.values(world.clubs).filter((c) => c.nation === club.nation && c.leagueId)
    .sort((a, b) => b.reputation - a.reputation || a.id.localeCompare(b.id));
  const cities = [...new Set(clubs.map((c) => c.city))];
  for (let i = 0; i < JOURNALISTS_PER_NATION; i++) {
    const name = generateName(rng, pickCulture(rng, nation.cultures));
    const outlet = OUTLETS[i % OUTLETS.length]!;
    // Los medios nacionales (tv y la mitad de la radio) no son de ninguna ciudad.
    const local = outlet === "newspaper" || outlet === "forum" || (outlet === "radio" && rng.chance(0.5));
    const city = local && cities.length ? rng.pick(cities.slice(0, Math.max(1, Math.min(cities.length, 8)))) : "";
    const j: Journalist = {
      id: nextId<string>(world, "jr", 5),
      firstName: name.firstName, lastName: name.lastName, nation: club.nation, outlet, city,
      sensationalism: round(outlet === "forum" ? rng.range(0.5, 1) : rng.range(0.1, 0.8), 3),
      rigor: round(outlet === "forum" ? rng.range(0, 0.4) : rng.range(0.3, 0.95), 3),
      aggression: round(rng.range(0.1, 0.9), 3),
      reach: round(outlet === "tv" ? rng.range(0.7, 1) : outlet === "forum" ? rng.range(0.1, 0.4) : rng.range(0.35, 0.8), 3),
    };
    const fav = city ? clubs.find((c) => c.city === city) : undefined;
    if (fav && rng.chance(0.6)) j.favours = fav.id;
    world.media.journalists[j.id] = j;
  }
}
