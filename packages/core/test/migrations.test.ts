// Migraciones del estado guardado (CLAUDE.md: todo cambio de formato tiene migración con test).
/* eslint-disable @typescript-eslint/no-explicit-any -- se manipula JSON de un formato antiguo */

import { describe, expect, it } from "vitest";
import { SAVE_VERSION, advanceDays, migrateWorld, newGame, openGame } from "../src";

/** Convierte un mundo actual en uno con el formato v1 (Fase 1). */
function asV1(): Record<string, unknown> {
  const w = JSON.parse(JSON.stringify(newGame({ seed: 21 }, "quick").world)) as Record<string, any>;
  w.meta.saveVersion = 1;
  delete w.stats;
  delete w.tactics;
  for (const p of Object.values(w.players) as Record<string, unknown>[]) {
    delete p.fitnessDay;
    delete p.suspensions;
    delete p.career;
  }
  // Un resultado con el formato antiguo.
  const m = Object.values(w.matches)[0] as Record<string, any> | undefined;
  if (m) m.result = { home: 1, away: 0, quick: true };
  return w;
}

describe("migraciones", () => {
  it("v1 → actual: añade los campos nuevos y el mundo se puede seguir jugando", () => {
    const world = migrateWorld(asV1());
    expect(world.meta.saveVersion).toBe(SAVE_VERSION);
    expect(world.stats).toEqual({});
    expect(world.tactics).toEqual({});
    const p = Object.values(world.players)[0]!;
    expect(p.suspensions).toEqual([]);
    expect(p.career).toEqual([]);
    expect(p.fitnessDay).toBe(world.meta.today);
    const game = openGame(world, "quick");
    expect(() => advanceDays(game, 3)).not.toThrow();
  });

  it("un resultado antiguo pasa a tener motor, goles y tarjetas", () => {
    const raw = asV1();
    const m = Object.values(raw.matches as Record<string, any>)[0];
    if (!m) return;
    const world = migrateWorld(raw);
    const r = world.matches[m.id]!.result!;
    expect(r.engine).toBe("quick");
    expect(r.goals).toEqual([]);
    expect(r.cards).toEqual([]);
    expect("quick" in r).toBe(false);
  });

  it("rechaza guardados de una versión futura", () => {
    const raw = asV1();
    (raw.meta as { saveVersion: number }).saveVersion = SAVE_VERSION + 1;
    expect(() => migrateWorld(raw)).toThrow();
  });
});
