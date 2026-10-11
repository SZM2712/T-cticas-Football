import { describe, expect, it } from "vitest";
import { Rng, cholesky, correlatedNormals, mean, normalCdf, pearson, stdev } from "../src";

describe("Rng", () => {
  it("es determinista: misma semilla, misma secuencia", () => {
    const a = Rng.create("semilla");
    const b = Rng.create("semilla");
    for (let i = 0; i < 1000; i++) expect(a.nextU32()).toBe(b.nextU32());
  });

  it("semillas distintas dan secuencias distintas", () => {
    const a = Rng.create(1);
    const b = Rng.create(2);
    const same = Array.from({ length: 100 }, () => a.nextU32() === b.nextU32()).filter(Boolean).length;
    expect(same).toBeLessThan(2);
  });

  it("fork depende solo de la ruta, no del consumo del padre", () => {
    const root = Rng.create(42);
    const before = root.fork("match/1").float();
    for (let i = 0; i < 500; i++) root.float();
    const after = root.fork("match/1").float();
    expect(after).toBe(before);
    expect(root.fork("match/2").float()).not.toBe(before);
  });

  it("consumir un stream no altera otro (independencia de subsistemas)", () => {
    const root = Rng.create(7);
    const dev = root.fork("dev");
    const media = root.fork("media");
    const ref = Rng.create(7).fork("media");
    for (let i = 0; i < 100; i++) dev.float();
    for (let i = 0; i < 100; i++) expect(media.float()).toBe(ref.float());
  });

  it("restaura el estado exacto", () => {
    const r = Rng.create("x").fork("a");
    for (let i = 0; i < 37; i++) r.normal();
    const saved = r.state();
    const expected = [r.float(), r.normal(), r.int(0, 99)];
    const restored = Rng.restore(r.seed, r.path, saved);
    expect([restored.float(), restored.normal(), restored.int(0, 99)]).toEqual(expected);
  });

  it("uniforme, enteros y normal tienen los momentos esperados", () => {
    const r = Rng.create(99);
    const u = Array.from({ length: 200_000 }, () => r.float());
    expect(mean(u)).toBeCloseTo(0.5, 2);
    expect(u.every((x) => x >= 0 && x < 1)).toBe(true);
    const ints = Array.from({ length: 60_000 }, () => r.int(1, 6));
    for (let k = 1; k <= 6; k++) expect(ints.filter((x) => x === k).length / ints.length).toBeCloseTo(1 / 6, 2);
    const n = Array.from({ length: 200_000 }, () => r.normal(3, 2));
    expect(mean(n)).toBeCloseTo(3, 1);
    expect(stdev(n)).toBeCloseTo(2, 1);
    const p = Array.from({ length: 100_000 }, () => r.poisson(1.4));
    expect(mean(p)).toBeCloseTo(1.4, 1);
  });

  it("shuffle produce una permutación", () => {
    const r = Rng.create(3);
    const xs = Array.from({ length: 50 }, (_, i) => i);
    expect(r.shuffle(xs).sort((a, b) => a - b)).toEqual(xs);
  });

  it("weighted respeta los pesos", () => {
    const r = Rng.create(5);
    const picks = Array.from({ length: 30_000 }, () => r.weighted(["a", "b"], (x) => (x === "a" ? 3 : 1)));
    expect(picks.filter((x) => x === "a").length / picks.length).toBeCloseTo(0.75, 1);
  });
});

describe("distribuciones", () => {
  it("normales correlacionadas reproducen la correlación", () => {
    const r = Rng.create(11);
    const L = cholesky([
      [1, 0.6],
      [0.6, 1],
    ]);
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < 50_000; i++) {
      const [x, y] = correlatedNormals(r, L);
      xs.push(x!);
      ys.push(y!);
    }
    expect(pearson(xs, ys)).toBeCloseTo(0.6, 1);
  });

  it("CDF normal", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 3);
  });
});
