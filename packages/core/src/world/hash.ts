// Huella estable del mundo: serialización con claves ordenadas y números
// normalizados, procesada en streaming para no construir un string gigante.

import { StreamHasher } from "../rng/hash";

function feed(h: StreamHasher, value: unknown): void {
  if (value === null || value === undefined) {
    h.update(value === null ? "n" : "u");
    return;
  }
  switch (typeof value) {
    case "number":
      // 10 decimales significativos: inmune a diferencias de redondeo en el último bit.
      h.update(Number.isInteger(value) ? `i${value}` : `f${value.toPrecision(10)}`);
      return;
    case "string":
      h.update(`s${value.length}:${value}`);
      return;
    case "boolean":
      h.update(value ? "T" : "F");
      return;
    case "object": {
      if (Array.isArray(value)) {
        h.update(`[${value.length}`);
        for (const v of value) feed(h, v);
        h.update("]");
        return;
      }
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
      h.update(`{${keys.length}`);
      for (const k of keys) {
        h.update(k);
        feed(h, obj[k]);
      }
      h.update("}");
      return;
    }
    default:
      throw new TypeError(`Valor no serializable en el mundo: ${typeof value}`);
  }
}

export function hashValue(value: unknown): string {
  const h = new StreamHasher();
  feed(h, value);
  return h.digest();
}
