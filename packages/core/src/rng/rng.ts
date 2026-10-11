// Generador pseudoaleatorio determinista: xoshiro128** sembrado con splitmix32.
// Cada subsistema usa su propio stream derivado por nombre (`fork`), de modo que
// añadir tiradas en un subsistema nunca desplaza las de otro.

import { fnv1a32 } from "./hash";

export type RngState = readonly [number, number, number, number];

/** splitmix32: expande una semilla de 32 bits en una secuencia bien mezclada. */
export function splitmix32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/** Convierte una semilla textual o numérica en un entero de 32 bits estable. */
export function seedToInt(seed: string | number): number {
  return typeof seed === "number" ? seed >>> 0 : fnv1a32(seed);
}

export class Rng {
  private s0: number;
  private s1: number;
  private s2: number;
  private s3: number;
  /** Ruta del stream; documenta su origen y sirve para derivar hijos. */
  readonly path: string;
  private readonly rootSeed: number;

  private constructor(rootSeed: number, path: string, state: RngState) {
    this.rootSeed = rootSeed;
    this.path = path;
    [this.s0, this.s1, this.s2, this.s3] = state;
  }

  /** Stream raíz de un mundo. */
  static create(seed: string | number): Rng {
    const root = seedToInt(seed);
    return new Rng(root, "", Rng.stateFor(root, ""));
  }

  /** Restaura un stream guardado. */
  static restore(rootSeed: number, path: string, state: RngState): Rng {
    return new Rng(rootSeed, path, state);
  }

  private static stateFor(root: number, path: string): RngState {
    const sm = splitmix32((root ^ fnv1a32(path)) >>> 0);
    let st: [number, number, number, number] = [sm(), sm(), sm(), sm()];
    if ((st[0] | st[1] | st[2] | st[3]) === 0) st = [1, 0, 0, 0];
    return st;
  }

  /**
   * Deriva un stream independiente por nombre. Depende solo de la semilla raíz y
   * de la ruta completa, NO del estado actual: `fork("a")` da lo mismo antes o
   * después de consumir números del padre.
   */
  fork(name: string): Rng {
    const path = this.path === "" ? name : `${this.path}/${name}`;
    return new Rng(this.rootSeed, path, Rng.stateFor(this.rootSeed, path));
  }

  get seed(): number {
    return this.rootSeed;
  }

  state(): RngState {
    return [this.s0, this.s1, this.s2, this.s3];
  }

  /** Siguiente entero sin signo de 32 bits (xoshiro128**). */
  nextU32(): number {
    const result = Math.imul(rotl(Math.imul(this.s1, 5) >>> 0, 7), 9) >>> 0;
    const t = (this.s1 << 9) >>> 0;
    this.s2 = (this.s2 ^ this.s0) >>> 0;
    this.s3 = (this.s3 ^ this.s1) >>> 0;
    this.s1 = (this.s1 ^ this.s2) >>> 0;
    this.s0 = (this.s0 ^ this.s3) >>> 0;
    this.s2 = (this.s2 ^ t) >>> 0;
    this.s3 = rotl(this.s3, 11);
    return result;
  }

  /** Flotante uniforme en [0, 1) con 53 bits de precisión. */
  float(): number {
    const hi = this.nextU32() >>> 5; // 27 bits
    const lo = this.nextU32() >>> 6; // 26 bits
    return (hi * 67108864 + lo) / 9007199254740992;
  }

  /** Uniforme en [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.float();
  }

  /** Entero uniforme en [min, max] (ambos incluidos), sin sesgo de módulo. */
  int(min: number, max: number): number {
    const span = max - min + 1;
    if (span <= 0 || !Number.isFinite(span)) throw new RangeError(`Rango inválido ${min}..${max}`);
    if (span > 0x100000000) return min + Math.floor(this.float() * span);
    const limit = 0x100000000 - (0x100000000 % span);
    let x: number;
    do x = this.nextU32();
    while (x >= limit);
    return min + (x % span);
  }

  chance(p: number): boolean {
    return this.float() < p;
  }

  /**
   * Normal (Box-Muller). No guarda el segundo valor de reserva para que el estado
   * del stream sean solo los 4 enteros de xoshiro y se pueda restaurar exacto.
   */
  normal(mean = 0, sd = 1): number {
    let u = 0;
    while (u === 0) u = this.float();
    const v = this.float();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Normal truncada por rechazo (con caída a clamp tras 32 intentos). */
  truncNormal(mean: number, sd: number, min: number, max: number): number {
    for (let i = 0; i < 32; i++) {
      const x = this.normal(mean, sd);
      if (x >= min && x <= max) return x;
    }
    return Math.min(max, Math.max(min, mean));
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError("pick sobre lista vacía");
    return items[this.int(0, items.length - 1)] as T;
  }

  /** Elección ponderada. Los pesos negativos cuentan como 0. */
  weighted<T>(items: readonly T[], weight: (item: T, index: number) => number): T {
    let total = 0;
    for (let i = 0; i < items.length; i++) total += Math.max(0, weight(items[i] as T, i));
    if (total <= 0) return this.pick(items);
    let r = this.float() * total;
    for (let i = 0; i < items.length; i++) {
      r -= Math.max(0, weight(items[i] as T, i));
      if (r < 0) return items[i] as T;
    }
    return items[items.length - 1] as T;
  }

  /** Fisher-Yates sobre una copia. */
  shuffle<T>(items: readonly T[]): T[] {
    const a = items.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      const tmp = a[i] as T;
      a[i] = a[j] as T;
      a[j] = tmp;
    }
    return a;
  }

  /** Poisson (Knuth; adecuado para lambdas pequeñas como goles). */
  poisson(lambda: number): number {
    const l = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= this.float();
    } while (p > l);
    return k - 1;
  }

  /** Beta por el método de las gammas (Marsaglia-Tsang). */
  beta(a: number, b: number): number {
    const x = this.gamma(a);
    const y = this.gamma(b);
    return x / (x + y);
  }

  gamma(shape: number): number {
    if (shape < 1) return this.gamma(shape + 1) * Math.pow(this.float() || Number.MIN_VALUE, 1 / shape);
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x: number;
      let v: number;
      do {
        x = this.normal();
        v = 1 + c * x;
      } while (v <= 0);
      v = v * v * v;
      const u = this.float();
      if (u < 1 - 0.0331 * x * x * x * x) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  }
}
