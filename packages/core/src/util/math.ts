export const clamp = (x: number, min: number, max: number): number => (x < min ? min : x > max ? max : x);
export const clamp01 = (x: number): number => clamp(x, 0, 1);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Redondeo a n decimales; los atributos se guardan con 2 decimales para que el hash sea estable. */
export const round = (x: number, decimals = 2): number => {
  const f = 10 ** decimals;
  return Math.round(x * f) / f;
};
