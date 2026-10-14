// Migraciones encadenadas del estado: v(n) → v(n+1). Cada una tiene su test con un
// estado de la versión anterior (packages/core/test/migrations.test.ts).

import { SAVE_VERSION } from "../config/generation";
import type { World } from "../types/domain";
import type { GameDay } from "../types/ids";

type AnyWorld = Record<string, unknown> & { meta: { saveVersion: number; today: number } };
type Migration = (w: AnyWorld) => void;

const MIGRATIONS: Record<number, Migration> = {
  // v1 → v2 (Fase 2): motor de partido. Forma física con fecha, sanciones, trayectoria,
  // planes tácticos, estadísticas por competición y resultados con goleadores y tarjetas.
  1: (w) => {
    w.stats ??= {};
    w.tactics ??= {};
    for (const p of Object.values(w.players as Record<string, Record<string, unknown>>)) {
      p.fitnessDay ??= w.meta.today as GameDay;
      p.suspensions ??= [];
      p.career ??= [];
    }
    for (const m of Object.values(w.matches as Record<string, { result?: Record<string, unknown> }>)) {
      if (!m.result) continue;
      const r = m.result;
      r.engine = "quick";
      delete r.quick;
      r.goals ??= [];
      r.cards ??= [];
    }
  },
};

/** Lleva un estado guardado de cualquier versión anterior a la actual. */
export function migrateWorld(raw: unknown): World {
  const w = raw as AnyWorld;
  if (w.meta.saveVersion > SAVE_VERSION) throw new Error(`Guardado de una versión más nueva (${w.meta.saveVersion})`);
  while (w.meta.saveVersion < SAVE_VERSION) {
    const step = MIGRATIONS[w.meta.saveVersion];
    if (!step) throw new Error(`Falta la migración desde la versión ${w.meta.saveVersion}`);
    step(w);
    w.meta.saveVersion++;
  }
  return w as unknown as World;
}
