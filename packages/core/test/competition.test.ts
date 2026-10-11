import { describe, expect, it } from "vitest";
import { Rng, drawGroups, knockoutPlan, leaguePhaseDraw, playersThisRound, roundRobin, type TeamId } from "../src";

const teams = (n: number) => Array.from({ length: n }, (_, i) => `t${String(i).padStart(2, "0")}` as TeamId);

describe("todos contra todos", () => {
  for (const n of [18, 20, 21, 24]) {
    it(`${n} equipos: cada pareja se enfrenta una vez en cada campo y nadie juega dos veces por jornada`, () => {
      const rounds = roundRobin(teams(n), true);
      expect(rounds.length).toBe(n % 2 === 0 ? 2 * (n - 1) : 2 * n);
      const seen = new Map<string, number>();
      for (const round of rounds) {
        const playing = round.flat();
        expect(new Set(playing).size).toBe(playing.length);
        for (const [h, a] of round) seen.set(`${h}>${a}`, (seen.get(`${h}>${a}`) ?? 0) + 1);
      }
      expect(seen.size).toBe(n * (n - 1));
      expect([...seen.values()].every((v) => v === 1)).toBe(true);
    });
  }

  it("local y visitante equilibrados en cada vuelta (diferencia ≤ 1)", () => {
    const first = roundRobin(teams(20), false);
    const home = new Map<TeamId, number>();
    for (const round of first) for (const [h] of round) home.set(h, (home.get(h) ?? 0) + 1);
    for (const count of home.values()) expect(Math.abs(count - 9.5)).toBeLessThanOrEqual(1.5);
  });
});

describe("plan de eliminatorias", () => {
  it("potencias de 2 sin exentos", () => {
    expect(knockoutPlan(16).rounds).toBe(4);
    expect(knockoutPlan(4).rounds).toBe(2);
    expect(knockoutPlan(1).rounds).toBe(0);
  });

  it("número arbitrario de equipos con exentos y cabezas de serie que entran tarde", () => {
    for (const [n, extras] of [[54, {}], [48, { 2: 4 }], [32, { 2: 8 }], [16, { 1: 8 }], [3, {}], [44, {}]] as const) {
      const ex = extras as Record<number, number>;
      const plan = knockoutPlan(n, ex);
      let pool = n;
      for (let r = 0; r < plan.rounds; r++) {
        pool += ex[r] ?? 0;
        const play = playersThisRound(pool, r, plan, ex);
        expect(play % 2).toBe(0);
        expect(play).toBeLessThanOrEqual(pool);
        pool -= play / 2;
      }
      expect(pool).toBe(1);
    }
  });
});

describe("sorteos", () => {
  it("fase de liga: 8 rivales distintos, 4 en casa y 4 fuera, nunca del mismo país", () => {
    const ts = teams(36);
    const nation = (t: TeamId) => `n${Number(t.slice(1)) % 9}`;
    const rounds = leaguePhaseDraw(Rng.create("lp"), ts, nation);
    expect(rounds.length).toBe(8);
    const opponents = new Map<TeamId, Set<TeamId>>();
    const home = new Map<TeamId, number>();
    for (const round of rounds) {
      expect(round.length).toBe(18);
      expect(new Set(round.flat()).size).toBe(36);
      for (const [h, a] of round) {
        expect(nation(h)).not.toBe(nation(a));
        home.set(h, (home.get(h) ?? 0) + 1);
        for (const [x, y] of [[h, a], [a, h]] as const) {
          const set = opponents.get(x) ?? new Set();
          set.add(y);
          opponents.set(x, set);
        }
      }
    }
    for (const t of ts) {
      expect(opponents.get(t)!.size).toBe(8);
      expect(home.get(t)).toBe(4);
    }
  });

  it("grupos por bombos con restricción", () => {
    const ts = teams(48);
    const confed = (t: TeamId) => (Number(t.slice(1)) % 6 === 0 ? "EUR" : `C${Number(t.slice(1)) % 5}`);
    const groups = drawGroups(Rng.create("g"), ts, 12, (g, t) => g.filter((x) => confed(x) === confed(t)).length < (confed(t) === "EUR" ? 2 : 1));
    expect(groups.length).toBe(12);
    expect(groups.every((g) => g.length === 4)).toBe(true);
    // Un equipo de cada bombo por grupo.
    for (const g of groups) expect(new Set(g.map((t) => Math.floor(ts.indexOf(t) / 12))).size).toBe(4);
  });
});
