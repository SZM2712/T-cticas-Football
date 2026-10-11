import type { World } from "../types/domain";

/** IDs deterministas: prefijo + contador por prefijo guardado en el mundo. */
export function nextId<T extends string>(world: Pick<World, "idCounters">, prefix: string, width = 6): T {
  const n = (world.idCounters[prefix] ?? 0) + 1;
  world.idCounters[prefix] = n;
  return `${prefix}_${String(n).padStart(width, "0")}` as T;
}
