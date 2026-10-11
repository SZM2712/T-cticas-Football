import { describe, expect, it } from "vitest";
import {
  CLUB_PATTERNS, CULTURES, NATIONS, NATION_LEAGUES, PLAYABLE_CITIES, isFamousPersonName, isRealClubName, normalizeClubName,
} from "../src";

describe("naciones", () => {
  it("códigos únicos y culturas existentes", () => {
    const codes = NATIONS.map((n) => n.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const n of NATIONS) {
      for (const c of Object.keys(n.cultures)) expect(CULTURES[c], `${n.code}:${c}`).toBeDefined();
      const total = Object.values(n.cultures).reduce((a, b) => a + b, 0);
      expect(total, n.code).toBeCloseTo(1, 5);
      expect(n.strength).toBeGreaterThanOrEqual(0);
      expect(n.strength).toBeLessThanOrEqual(1);
    }
  });

  it("55 naciones europeas (Liga de Naciones A–D)", () => {
    expect(NATIONS.filter((n) => n.confed === "EUR").length).toBe(55);
    expect(NATIONS.filter((n) => n.confed === "SAM").length).toBe(10);
  });

  it("ciudades suficientes para todos los clubes de cada nación jugable", () => {
    for (const data of NATION_LEAGUES) {
      const cities = PLAYABLE_CITIES[data.nation]!;
      const capacity = cities.reduce((s, c) => s + Math.min(1 + (c.districts?.length ?? 0), 1 + Math.floor(c.pop / 600)), 0);
      expect(capacity).toBeGreaterThan(data.tiers[0].teams + data.tiers[1].teams + data.shadowTierClubs);
    }
  });

  it("listas de nombres no vacías y sin duplicados", () => {
    for (const [key, c] of Object.entries(CULTURES)) {
      expect(c.first.length, key).toBeGreaterThanOrEqual(15);
      expect(c.last.length, key).toBeGreaterThanOrEqual(15);
      expect(new Set(c.first).size, key).toBe(c.first.length);
    }
  });
});

describe("listas de bloqueo", () => {
  it("detecta clubes reales con variaciones de formato", () => {
    expect(isRealClubName("Real Madrid")).toBe(true);
    expect(isRealClubName("FC Köln")).toBe(true);
    expect(isRealClubName("Manchester United")).toBe(true);
    expect(isRealClubName("Stade de Reims")).toBe(true);
    expect(isRealClubName("Atlético Sevilla")).toBe(false);
    expect(normalizeClubName("1. FC Köln")).toBe("koln");
  });

  it("detecta futbolistas famosos", () => {
    expect(isFamousPersonName("Luka Modric")).toBe(true);
    expect(isFamousPersonName("lionel messi")).toBe(true);
    expect(isFamousPersonName("Daniel Okafor")).toBe(false);
  });

  it("todos los patrones contienen {city}", () => {
    for (const list of Object.values(CLUB_PATTERNS)) for (const p of list) expect(p).toContain("{city}");
  });
});
