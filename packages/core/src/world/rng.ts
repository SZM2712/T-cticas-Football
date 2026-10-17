import { Rng } from "../rng/rng";
import type { World } from "../types/domain";

const cache = new WeakMap<World, Rng>();

/** RNG raíz del mundo. Nadie lo consume directamente: cada sistema hace `fork(ruta)`. */
export function worldRng(world: World): Rng {
  let rng = cache.get(world);
  if (!rng) cache.set(world, (rng = Rng.create(world.meta.seed)));
  return rng;
}

/**
 * Ruta del stream de un partido. En multijugador entra la sal del día (secreta hasta cerrarlo,
 * DISEÑO §11.3) para que nadie pueda ensayar su partido en casa; sin sal, la ruta de siempre.
 */
export function matchSeedPath(world: World, m: { id: string; day: number }): string {
  const salt = world.salts[String(m.day)];
  return salt ? `match/${salt}/${m.id}` : `match/${m.id}`;
}
