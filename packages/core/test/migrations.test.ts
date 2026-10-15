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
  delete w.plans;
  delete w.scouting;
  for (const k of ["managers", "relationships", "trust", "memories", "commitments", "inbox", "dressing", "salts"]) delete w[k];
  for (const p of Object.values(w.players) as Record<string, any>[]) {
    delete p.fitnessDay;
    delete p.suspensions;
    delete p.career;
    for (const k of ["caMonthly", "caYearly", "monthMinutes", "recentMinutes", "recoveryMult", "injuryRiskDelta"]) delete p.development[k];
  }
  for (const s of Object.values(w.staff) as Record<string, any>[]) {
    delete s.attributes.nutrition;
    delete s.attributes.conditioning;
  }
  // Un resultado con el formato antiguo.
  const m = Object.values(w.matches)[0] as Record<string, any> | undefined;
  if (m) m.result = { home: 1, away: 0, quick: true };
  return w;
}

describe("migraciones", () => {
  it("v3 → v4: el vestuario empieza vacío", () => {
    const w = JSON.parse(JSON.stringify(newGame({ seed: 22 }, "quick").world)) as Record<string, any>;
    w.meta.saveVersion = 3;
    for (const k of ["managers", "relationships", "trust", "memories", "commitments", "inbox", "dressing", "salts"]) delete w[k];
    const world = migrateWorld(w);
    expect(world.meta.saveVersion).toBe(SAVE_VERSION);
    expect(world.relationships).toEqual({});
    expect(world.commitments).toEqual({});
    expect(world.memories).toEqual({});
  });

  it("v1 → actual: añade los campos nuevos y el mundo se puede seguir jugando", () => {
    const world = migrateWorld(asV1());
    expect(world.meta.saveVersion).toBe(SAVE_VERSION);
    expect(world.stats).toEqual({});
    expect(world.tactics).toEqual({});
    const p = Object.values(world.players)[0]!;
    expect(p.suspensions).toEqual([]);
    expect(p.career).toEqual([]);
    expect(p.fitnessDay).toBe(world.meta.today);
    expect(world.plans).toEqual({});
    expect(world.scouting).toEqual({});
    expect(p.development.recoveryMult).toBe(1);
    expect(p.development.caMonthly).toEqual([]);
    expect(Object.values(world.staff)[0]!.attributes.nutrition).toBe(8);
    expect(world.managers).toEqual({});
    expect(world.inbox).toEqual([]);
    expect(world.dressing).toEqual({});
    expect(world.salts).toEqual({});
    const game = openGame(world, "quick");
    expect(() => advanceDays(game, 35)).not.toThrow();
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
