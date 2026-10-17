import { isFamousPersonName, isRealClubName, NATION_LEAGUES } from "@tf/data";
import { beforeAll, describe, expect, it } from "vitest";
import {
  ageOn, classifyArchetype, clubSummary, currentAbility, generateWorld, hashValue, playerView, quantile, type World,
} from "../src";

/**
 * Hash del mundo de referencia (seed=123). Si un cambio lo altera, debe ser intencional:
 * actualízalo en el mismo commit explicando por qué (CLAUDE.md).
 */
// Fase 2: cambia por el formato del estado (SAVE_VERSION 2: fitnessDay, suspensions,
// career, tactics, stats). La generación no cambia: no hay tiradas nuevas de RNG.
// Fase 3: cambia la generación. Hay staff nuevo (nutricionista y preparador físico, con los
// atributos nutrition y conditioning), una brecha inicial techo–CA recalibrada, un cupo de
// techos de élite al generar (ELITE_PIPELINE_START) y campos nuevos de desarrollo, plans y
// scouting (SAVE_VERSION 3).
// Fase 4: cambia solo por el formato del estado (SAVE_VERSION 4: managers, relationships,
// trust, memories, commitments, inbox, dressing y salts, todos vacíos al generar) y por la
// generación: niños prodigio del mundo inicial (techo de estrella y marca `prodigy`).
// Revisión de la Fase 4: cambia solo por SAVE_VERSION 5 (reuniones y apoyo a la táctica en el
// vestuario); con saveVersion 4 el mismo mundo da el hash anterior, d12680c82673c4c4.
const GOLDEN_HASH_123 = "b137367e7d3e7187";

let world: World;
beforeAll(() => {
  world = generateWorld({ seed: 123 });
});

describe("determinismo", () => {
  it("misma semilla → mismo mundo (hash idéntico)", () => {
    expect(hashValue(generateWorld({ seed: 123 }))).toBe(hashValue(world));
  });

  it("hash del mundo de referencia", () => {
    expect(hashValue(world)).toBe(GOLDEN_HASH_123);
  });

  it("semillas distintas → mundos distintos", () => {
    const hashes = new Set(Array.from({ length: 6 }, (_, i) => hashValue(generateWorld({ seed: `s${i}` }))));
    expect(hashes.size).toBe(6);
  });
});

describe("estructura", () => {
  it("ligas con los tamaños reales y plantillas completas", () => {
    for (const data of NATION_LEAGUES) {
      const leagues = Object.values(world.leagues).filter((l) => l.nation === data.nation).sort((a, b) => a.tier - b.tier);
      expect(leagues.map((l) => l.clubs.length)).toEqual(data.tiers.map((t) => t.teams));
      for (const l of leagues) {
        for (const id of l.clubs) {
          const club = world.clubs[id]!;
          expect(club.squad.length).toBeGreaterThanOrEqual(25);
          expect(club.squad.filter((p) => world.players[p]!.position === "GK").length).toBeGreaterThanOrEqual(3);
          expect(club.staff.length).toBeGreaterThanOrEqual(5);
        }
      }
    }
  });

  it("todas las naciones tienen selección con convocatoria y clubes en sombra", () => {
    for (const nation of Object.values(world.nations)) {
      const team = world.nationalTeams[`nt_${nation.id}`]!;
      expect(team.squad.length, nation.id).toBeGreaterThanOrEqual(15);
      expect(team.coachId).not.toBeNull();
    }
  });

  it("los jugadores apuntan a clubes que los contienen", () => {
    for (const club of Object.values(world.clubs)) for (const id of club.squad) expect(world.players[id]!.clubId).toBe(club.id);
  });
});

describe("sin datos reales (regla 7)", () => {
  it("ningún club tiene nombre de club real y todos son únicos", () => {
    const names = Object.values(world.clubs).map((c) => c.name);
    expect(names.filter(isRealClubName)).toEqual([]);
    expect(new Set(names).size).toBe(names.length);
  });

  it("ningún jugador se llama como un futbolista famoso", () => {
    const famous = Object.values(world.players).filter(
      (p) => isFamousPersonName(`${p.firstName} ${p.lastName}`) || (p.knownAs && isFamousPersonName(p.knownAs)),
    );
    expect(famous).toEqual([]);
  });
});

describe("distribuciones", () => {
  it("edades y calidad en rangos objetivo", () => {
    const players = Object.values(world.players);
    const ages = players.map((p) => ageOn(p.birthDay, world.meta.today));
    const meanAge = ages.reduce((a, b) => a + b, 0) / ages.length;
    expect(meanAge).toBeGreaterThan(24.5);
    expect(meanAge).toBeLessThan(27);
    expect(Math.min(...ages)).toBeGreaterThanOrEqual(16);
    expect(Math.max(...ages)).toBeLessThanOrEqual(38);
    const cas = players.map(currentAbility).sort((a, b) => a - b);
    expect(quantile(cas, 0.5)).toBeGreaterThan(9.5);
    expect(quantile(cas, 0.5)).toBeLessThan(12.5);
    expect(quantile(cas, 0.99)).toBeGreaterThan(14.5);
    expect(cas.at(-1)!).toBeLessThanOrEqual(20);
  });

  it("la primera división es mejor que la segunda en cada nación", () => {
    for (const data of NATION_LEAGUES) {
      const [t1, t2] = Object.values(world.leagues).filter((l) => l.nation === data.nation).sort((a, b) => a.tier - b.tier);
      const avg = (ids: string[]) => ids.reduce((s, id) => s + clubSummary(world, id as never).stars, 0) / ids.length;
      expect(avg(t1!.clubs)).toBeGreaterThan(avg(t2!.clubs));
    }
  });

  it("proporción de extranjeros cercana a la objetivo en la Premier ficticia", () => {
    const league = Object.values(world.leagues).find((l) => l.nation === "GB-ENG" && l.tier === 1)!;
    const players = league.clubs.flatMap((id) => world.clubs[id]!.squad.map((p) => world.players[p]!));
    const foreign = players.filter((p) => p.nationality !== "GB-ENG").length / players.length;
    expect(foreign).toBeGreaterThan(0.4);
    expect(foreign).toBeLessThan(0.75);
  });

  it("todos los arquetipos tienen representación (≥ 1.5 %)", () => {
    const players = Object.values(world.players);
    const counts = new Map<string, number>();
    for (const p of players) {
      const a = classifyArchetype(p.psych, ageOn(p.birthDay, world.meta.today)).primary;
      counts.set(a, (counts.get(a) ?? 0) + 1);
    }
    expect(counts.size).toBe(10);
    for (const [, n] of counts) expect(n / players.length).toBeGreaterThan(0.015);
  });
});

describe("vistas (regla 6)", () => {
  it("la vista de jugador no expone ocultos, perfil psicológico ni techo latente", () => {
    const id = Object.keys(world.players)[0]!;
    const view = playerView(world, id as never) as unknown as Record<string, unknown>;
    for (const forbidden of ["hidden", "psych", "development", "latentCeiling", "state", "seededArchetype"]) {
      expect(JSON.stringify(view)).not.toContain(forbidden);
    }
    expect(Object.values(view.attributes as Record<string, number>).every(Number.isInteger)).toBe(true);
  });
});
