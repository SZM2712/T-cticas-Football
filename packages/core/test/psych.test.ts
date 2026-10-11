import { describe, expect, it } from "vitest";
import { ARCHETYPES, PSYCH_CORRELATION, PSYCH_TRAITS, Rng, cholesky, classifyArchetype, generatePsych, pearson } from "../src";

describe("perfil psicológico", () => {
  it("la matriz de correlación es simétrica y definida positiva", () => {
    const n = PSYCH_TRAITS.length;
    expect(PSYCH_CORRELATION.length).toBe(n);
    for (let i = 0; i < n; i++) {
      expect(PSYCH_CORRELATION[i]!.length).toBe(n);
      expect(PSYCH_CORRELATION[i]![i]).toBe(1);
      for (let j = 0; j < n; j++) expect(PSYCH_CORRELATION[i]![j]).toBe(PSYCH_CORRELATION[j]![i]);
    }
    expect(() => cholesky(PSYCH_CORRELATION)).not.toThrow();
  });

  it("las correlaciones empíricas coinciden con la matriz objetivo (±0.05)", () => {
    const rng = Rng.create("psych");
    const samples = Array.from({ length: 30_000 }, () => generatePsych(rng, 24, false).psych);
    PSYCH_TRAITS.forEach((a, i) => {
      PSYCH_TRAITS.forEach((b, j) => {
        if (j <= i) return;
        const r = pearson(samples.map((s) => s[a]), samples.map((s) => s[b]));
        expect(Math.abs(r - PSYCH_CORRELATION[i]![j]!), `${a}~${b}`).toBeLessThan(0.05);
      });
    });
  });

  it("los rasgos están en 0..1 y los jóvenes son más inseguros que los veteranos", () => {
    const rng = Rng.create("age");
    const young = Array.from({ length: 4000 }, () => generatePsych(rng, 18, false).psych);
    const old = Array.from({ length: 4000 }, () => generatePsych(rng, 33, false).psych);
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    for (const p of [...young, ...old]) {
      for (const t of PSYCH_TRAITS) {
        expect(p[t]).toBeGreaterThanOrEqual(0);
        expect(p[t]).toBeLessThanOrEqual(1);
      }
    }
    expect(avg(young.map((p) => p.insecurity))).toBeGreaterThan(avg(old.map((p) => p.insecurity)) + 0.1);
    expect(avg(old.map((p) => p.influence))).toBeGreaterThan(avg(young.map((p) => p.influence)) + 0.1);
  });

  it("un jugador sembrado hacia un arquetipo se clasifica como ese arquetipo casi siempre", () => {
    const rng = Rng.create("seed-archetypes");
    let seeded = 0;
    let matched = 0;
    for (let i = 0; i < 20_000; i++) {
      const age = rng.int(18, 34);
      const g = generatePsych(rng, age);
      if (!g.seeded) continue;
      seeded++;
      const { primary, secondary } = classifyArchetype(g.psych, age);
      if (primary === g.seeded || secondary === g.seeded) matched++;
    }
    expect(seeded / 20_000).toBeCloseTo(0.15, 1);
    expect(matched / seeded).toBeGreaterThan(0.7);
  });

  it("todos los arquetipos aparecen", () => {
    const rng = Rng.create("all");
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) {
      const age = rng.int(17, 36);
      seen.add(classifyArchetype(generatePsych(rng, age).psych, age).primary);
    }
    expect([...seen].sort()).toEqual([...ARCHETYPES].sort());
  });
});
