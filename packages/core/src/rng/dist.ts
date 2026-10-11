// Utilidades estadísticas sin azar propio (el azar llega siempre por un Rng).

import type { Rng } from "./rng";

/** Descomposición de Cholesky de una matriz simétrica definida positiva. */
export function cholesky(m: readonly (readonly number[])[]): number[][] {
  const n = m.length;
  const l: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) sum += l[i]![k]! * l[j]![k]!;
      if (i === j) {
        const d = m[i]![i]! - sum;
        if (d <= 0) throw new Error(`Matriz no definida positiva (pivote ${i}: ${d})`);
        l[i]![j] = Math.sqrt(d);
      } else {
        l[i]![j] = (m[i]![j]! - sum) / l[j]![j]!;
      }
    }
  }
  return l;
}

/** Muestra de una normal multivariante estándar con correlación dada por su factor de Cholesky. */
export function correlatedNormals(rng: Rng, choleskyFactor: readonly (readonly number[])[]): number[] {
  const n = choleskyFactor.length;
  const z = new Array<number>(n);
  for (let i = 0; i < n; i++) z[i] = rng.normal();
  const out = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    let s = 0;
    const row = choleskyFactor[i]!;
    for (let k = 0; k <= i; k++) s += row[k]! * z[k]!;
    out[i] = s;
  }
  return out;
}

/** CDF de la normal estándar (aproximación de Abramowitz-Stegun 7.1.26, error < 1.5e-7). */
export function normalCdf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-(x * x) / 2);
  return x >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

export function mean(xs: readonly number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return xs.length ? s / xs.length : 0;
}

export function stdev(xs: readonly number[]): number {
  const m = mean(xs);
  let s = 0;
  for (const x of xs) s += (x - m) * (x - m);
  return xs.length > 1 ? Math.sqrt(s / (xs.length - 1)) : 0;
}

export function pearson(xs: readonly number[], ys: readonly number[]): number {
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i]! - mx;
    const dy = ys[i]! - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  return sxy / Math.sqrt(sxx * syy);
}

export function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}
