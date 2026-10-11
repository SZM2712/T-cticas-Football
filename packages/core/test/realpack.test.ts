import { NATION_LEAGUES, REAL_LEAGUES } from "@tf/data";
import { describe, expect, it } from "vitest";
import { generateWorld, hashValue, teamRating } from "../src";

describe("paquete opcional de clubes reales", () => {
  const world = generateWorld({ seed: 123, dataPack: "real" });

  it("las ligas tienen exactamente los clubes reales de cada división", () => {
    for (const data of NATION_LEAGUES) {
      const pack = REAL_LEAGUES[data.nation]!;
      const [t1, t2] = Object.values(world.leagues).filter((l) => l.nation === data.nation).sort((a, b) => a.tier - b.tier);
      expect(t1!.clubs.map((id) => world.clubs[id]!.name).sort()).toEqual(pack.tier1.map((c) => c.n).sort());
      expect(t2!.clubs.map((id) => world.clubs[id]!.name).sort()).toEqual(pack.tier2.map((c) => c.n).sort());
    }
  });

  it("los grandes son los más fuertes de su liga", () => {
    const best = (nation: string) => {
      const league = Object.values(world.leagues).find((l) => l.nation === nation && l.tier === 1)!;
      return league.clubs.map((id) => ({ name: world.clubs[id]!.name, r: teamRating(world, id) })).sort((a, b) => b.r - a.r).slice(0, 4).map((x) => x.name);
    };
    expect(best("ES")).toContain("Real Madrid");
    expect(best("DE")).toContain("Bayern München");
    expect(best("FR")).toContain("Paris Saint-Germain");
    expect(best("GB-ENG").some((n) => ["Liverpool", "Arsenal", "Manchester City"].includes(n))).toBe(true);
  });

  it("es determinista y no altera el mundo ficticio por defecto", () => {
    expect(hashValue(generateWorld({ seed: 123, dataPack: "real" }))).toBe(hashValue(world));
    expect(world.meta.dataPack).toBe("real");
    expect(generateWorld({ seed: 123 }).meta.dataPack).toBeUndefined();
  });
});
