// Calendario y competiciones a lo largo de 4 temporadas (2026/27 → 2029/30, que incluye
// Eurocopa 2028, Copa de las Américas 2028 y Mundial 2030). Aquí se prueba el calendario,
// no el motor: los resultados salen del modelo rápido (el motor completo tiene su test).

import { NATION_LEAGUES } from "@tf/data";
import { beforeAll, describe, expect, it } from "vitest";
import {
  advanceDays, advanceSeasons, hashValue, isInWindow, newGame, weekday, windowsOf, type Competition, type Game, type World,
} from "../src";

let game: Game;
let world: World;
beforeAll(() => {
  game = newGame({ seed: 123 }, "quick");
  advanceSeasons(game, 4);
  advanceDays(game, 45); // termina el Mundial de 2030
  world = game.world;
});

const comps = (pred: (c: Competition) => boolean) => Object.values(world.competitions).filter(pred);

describe("calendario", () => {
  it("ningún choque y descanso mínimo de 3 días para todo equipo", () => {
    expect(game.ctx.clashes).toBe(0);
    const days = new Map<string, number[]>();
    for (const m of Object.values(world.matches)) {
      for (const t of [m.home, m.away]) (days.get(t) ?? days.set(t, []).get(t)!).push(m.day);
    }
    for (const [team, list] of days) {
      list.sort((a, b) => a - b);
      for (let i = 1; i < list.length; i++) expect(list[i]! - list[i - 1]!, team).toBeGreaterThanOrEqual(3);
    }
  });

  it("ningún partido de liga o copa nacional cae en una ventana FIFA", () => {
    for (const c of comps((c) => c.kind === "league" || c.kind === "cup")) {
      const windows = windowsOf(c.season);
      for (const stage of c.stages) for (const round of stage.rounds) for (const id of round.matchIds) {
        expect(isInWindow(world.matches[id]!.day, windows), c.nameKey).toBe(false);
      }
    }
  });

  it("las selecciones solo juegan en ventanas FIFA o en torneos de verano", () => {
    for (const m of Object.values(world.matches)) {
      const comp = world.competitions[m.competitionId]!;
      if (comp.teamType !== "national" || comp.kind === "worldCup" || comp.kind === "continentalCup") continue;
      const season = comp.season;
      expect(isInWindow(m.day, [...windowsOf(season), ...windowsOf(season + 1)]), comp.nameKey).toBe(true);
    }
  });

  it("las ligas son a doble vuelta completa y casi siempre en fin de semana", () => {
    for (const c of comps((c) => c.kind === "league" && c.season <= 2029)) {
      const n = c.participants.length;
      const ids = c.stages[0]!.rounds.flatMap((r) => r.matchIds);
      expect(ids.length).toBe(n * (n - 1));
      expect(ids.every((id) => world.matches[id]!.result)).toBe(true);
      const weekend = ids.filter((id) => [4, 5, 6, 0].includes(weekday(world.matches[id]!.day))).length;
      expect(weekend / ids.length, c.nameKey).toBeGreaterThan(c.participants.length > 20 ? 0.7 : 0.85);
    }
  });
});

describe("competiciones", () => {
  it("todas las competiciones de las 4 temporadas terminan con ganador", () => {
    const pending = comps((c) => c.season <= 2029 && c.status !== "finished").map((c) => `${c.nameKey}@${c.season}`);
    expect(pending).toEqual([]);
    for (const c of comps((c) => c.season <= 2029 && c.kind !== "friendly" && c.kind !== "qualifier" && c.kind !== "nationsLeague")) {
      expect(c.winner, `${c.nameKey}@${c.season}`).toBeTruthy();
    }
  });

  it("ascensos y descensos mantienen el tamaño de cada liga", () => {
    for (const data of NATION_LEAGUES) {
      const leagues = Object.values(world.leagues).filter((l) => l.nation === data.nation).sort((a, b) => a.tier - b.tier);
      expect(leagues.map((l) => l.clubs.length)).toEqual(data.tiers.map((t) => t.teams));
    }
    expect(world.history.length).toBe(4);
    for (const record of world.history) {
      for (const data of NATION_LEAGUES) {
        expect(record.promoted[data.nation]!.length).toBe(record.relegated[data.nation]!.length);
      }
    }
  });

  it("competiciones europeas de 36 clubes", () => {
    for (const c of comps((c) => c.kind === "continentalClub")) {
      expect(c.participants.length).toBe(36);
      expect(c.stages[1]!.rounds.length).toBe(5);
      for (const id of c.stages[0]!.rounds.flatMap((r) => r.matchIds)) {
        const m = world.matches[id]!;
        expect(world.clubs[m.home]!.nation, c.nameKey).not.toBe(world.clubs[m.away]!.nation);
      }
    }
  });

  it("Mundial 2030 con 48 selecciones, Eurocopa 2028 con 24 y clasificatorias con sus plazas", () => {
    const wc = comps((c) => c.kind === "worldCup");
    expect(wc.map((c) => c.participants.length)).toEqual([48]);
    const euro = comps((c) => c.nameKey === "comp.euro");
    expect(euro.map((c) => c.participants.length)).toEqual([24]);
    const quals = comps((c) => c.kind === "qualifier" && c.meta.year === 2030);
    expect(quals.length).toBe(6);
    const total = quals.reduce((s, c) => s + (c.ranking?.length ?? 0), 0);
    const hosts = (world.hosts["worldCup-2030"] ?? []).length;
    expect(total + hosts).toBe(48);
  });

  it("Liga de Naciones: divisiones de 16/16/16/7 y finales cada dos años", () => {
    const tiers: Record<number, number> = {};
    for (const t of Object.values(world.nationalTeams)) {
      if (world.nations[t.nation]!.confed === "EUR") tiers[t.nationsLeagueTier!] = (tiers[t.nationsLeagueTier!] ?? 0) + 1;
    }
    expect(tiers).toEqual({ 0: 16, 1: 16, 2: 16, 3: 7 });
    const finals = comps((c) => c.nameKey === "comp.nationsLeagueFinals.EUR" && c.status === "finished");
    expect(finals.map((c) => c.season)).toEqual([2026, 2028]);
  });
});

describe("determinismo de la simulación", () => {
  it("misma semilla y mismos días → mismo mundo (motor completo)", () => {
    const a = newGame({ seed: 777 });
    const b = newGame({ seed: 777 });
    advanceDays(a, 75);
    advanceDays(b, 75);
    expect(hashValue(a.world)).toBe(hashValue(b.world));
  });
});
