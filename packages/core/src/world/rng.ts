import { Rng } from "../rng/rng";
import type { World } from "../types/domain";

const cache = new WeakMap<World, Rng>();

/** RNG raíz del mundo. Nadie lo consume directamente: cada sistema hace `fork(ruta)`. */
export function worldRng(world: World): Rng {
  let rng = cache.get(world);
  if (!rng) cache.set(world, (rng = Rng.create(world.meta.seed)));
  return rng;
}
