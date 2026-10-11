// Sorteos: grupos por bombos con restricciones, cruces de eliminatorias y fase de
// liga "suiza" de 36 equipos (8 rivales distintos, 4 en casa y 4 fuera).

import type { Rng } from "../rng/rng";
import type { TeamId } from "../types/ids";
import { roundRobin, type Pairing } from "./roundRobin";

/**
 * Reparte equipos (ordenados por siembra) en `groupCount` grupos: un equipo de cada
 * bombo por grupo. `canJoin` permite restricciones (p. ej. máximo de una confederación).
 */
export function drawGroups(
  rng: Rng,
  seeded: readonly TeamId[],
  groupCount: number,
  canJoin: (group: readonly TeamId[], team: TeamId) => boolean = () => true,
): TeamId[][] {
  for (let attempt = 0; attempt < 60; attempt++) {
    const groups: TeamId[][] = Array.from({ length: groupCount }, () => []);
    let failed = false;
    for (let p = 0; p * groupCount < seeded.length && !failed; p++) {
      const pot = rng.shuffle(seeded.slice(p * groupCount, (p + 1) * groupCount));
      // Los grupos más pequeños reciben primero; los equipos con menos opciones van antes.
      const order = rng.shuffle(groups.map((_, i) => i)).sort((a, b) => groups[a]!.length - groups[b]!.length);
      for (const team of pot) {
        const target = order.find((g) => groups[g]!.length === p && canJoin(groups[g]!, team));
        if (target === undefined) {
          failed = attempt < 59; // en el último intento se relaja la restricción
          if (failed) break;
          const fallback = order.find((g) => groups[g]!.length === p)!;
          groups[fallback]!.push(team);
          continue;
        }
        groups[target]!.push(team);
      }
    }
    if (!failed) return groups;
  }
  throw new Error("drawGroups: inalcanzable");
}

/**
 * Empareja equipos de una ronda eliminatoria. `seeded`: el mejor contra el peor.
 * `random`: sorteo libre. Devuelve [local en la ida, visitante en la ida].
 */
export function pairKnockout(
  rng: Rng,
  seeded: readonly TeamId[],
  pairing: "seeded" | "random",
  lowerHosts: boolean,
  strength: (t: TeamId) => number,
): Pairing<TeamId>[] {
  const teams = pairing === "random" ? rng.shuffle(seeded) : seeded.slice();
  const pairs: Pairing<TeamId>[] = [];
  const n = teams.length;
  for (let i = 0; i < n / 2; i++) {
    const a = pairing === "random" ? teams[2 * i]! : teams[i]!;
    const b = pairing === "random" ? teams[2 * i + 1]! : teams[n - 1 - i]!;
    if (lowerHosts) pairs.push(strength(a) <= strength(b) ? [a, b] : [b, a]);
    // En eliminatorias sembradas a doble partido, el mejor juega la vuelta en casa.
    else pairs.push(pairing === "seeded" ? [b, a] : [a, b]);
  }
  return pairs;
}

/** Número de equipos que juegan la primera ronda para dejar una potencia de 2. */
export function firstRoundPlayers(n: number): number {
  let p = 1;
  while (p * 2 <= n) p *= 2;
  return p === n ? n : 2 * (n - p);
}

export function knockoutRoundsFor(n: number): number {
  let r = 0;
  let p = 1;
  while (p < n) {
    p *= 2;
    r++;
  }
  return r;
}

/** Orienta las aristas de un multigrafo de grado par para que cada nodo tenga tantas entradas como salidas. */
function eulerOrient(edges: readonly [number, number][], nodes: number): boolean[] {
  const adj: { to: number; edge: number }[][] = Array.from({ length: nodes }, () => []);
  edges.forEach(([a, b], i) => {
    adj[a]!.push({ to: b, edge: i });
    adj[b]!.push({ to: a, edge: i });
  });
  const used = new Array<boolean>(edges.length).fill(false);
  const forward = new Array<boolean>(edges.length).fill(true);
  const ptr = new Array<number>(nodes).fill(0);
  for (let start = 0; start < nodes; start++) {
    // Hierholzer iterativo: cada arista se recorre una vez; su sentido de recorrido es su orientación.
    const stack = [start];
    while (stack.length) {
      const v = stack[stack.length - 1]!;
      const list = adj[v]!;
      while (ptr[v]! < list.length && used[list[ptr[v]!]!.edge]) ptr[v]!++;
      if (ptr[v]! === list.length) {
        stack.pop();
        continue;
      }
      const { to, edge } = list[ptr[v]!]!;
      used[edge] = true;
      forward[edge] = edges[edge]![0] === v;
      stack.push(to);
    }
  }
  return forward;
}

/**
 * Elimina cruces entre clubes del mismo país intercambiando rivales dentro de una
 * jornada (a-b, c-d → a-d, c-b) sin repetir enfrentamientos.
 */
function repairSameNation(rng: Rng, rounds: Pairing<TeamId>[][], nationOf: (t: TeamId) => string): void {
  const key = (a: TeamId, b: TeamId) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const met = new Set<string>();
  for (const round of rounds) for (const [a, b] of round) met.add(key(a, b));
  for (let pass = 0; pass < 20; pass++) {
    let fixed = true;
    for (const round of rounds) {
      for (let i = 0; i < round.length; i++) {
        const [a, b] = round[i]!;
        if (nationOf(a) !== nationOf(b)) continue;
        fixed = false;
        for (const j of rng.shuffle(round.map((_, k) => k))) {
          if (j === i) continue;
          const [c, d] = round[j]!;
          if (nationOf(a) === nationOf(d) || nationOf(c) === nationOf(b)) continue;
          if (met.has(key(a, d)) || met.has(key(c, b))) continue;
          met.delete(key(a, b));
          met.delete(key(c, d));
          met.add(key(a, d));
          met.add(key(c, b));
          round[i] = [a, d];
          round[j] = [c, b];
          break;
        }
      }
    }
    if (fixed) return;
  }
}

/**
 * Fase de liga: 8 jornadas de un todos-contra-todos virtual, elegidas para que cada
 * equipo se enfrente a ~2 rivales de cada bombo y nunca a uno de su país.
 * `seeded` va ordenado por coeficiente (bombos de 9).
 */
export function leaguePhaseDraw(
  rng: Rng,
  seeded: readonly TeamId[],
  nationOf: (t: TeamId) => string,
  matchdays = 8,
  tries = 250,
): Pairing<TeamId>[][] {
  const n = seeded.length;
  const potOf = new Map<TeamId, number>(seeded.map((t, i) => [t, Math.floor((i * 4) / n)]));
  let best: { score: number; rounds: Pairing<TeamId>[][] } | null = null;
  for (let attempt = 0; attempt < tries; attempt++) {
    const order = rng.shuffle(seeded);
    const all = roundRobin(order, false);
    const chosen = rng.shuffle(all.map((_, i) => i)).slice(0, matchdays).map((i) => all[i]!);
    let score = 0;
    const potCount = new Map<TeamId, number[]>(seeded.map((t) => [t, [0, 0, 0, 0]]));
    for (const round of chosen) {
      for (const [a, b] of round) {
        if (nationOf(a) === nationOf(b)) score += 100;
        potCount.get(a)![potOf.get(b)!]!++;
        potCount.get(b)![potOf.get(a)!]!++;
      }
    }
    for (const counts of potCount.values()) for (const c of counts) score += Math.abs(c - matchdays / 4);
    if (!best || score < best.score) best = { score, rounds: chosen };
    if (score === 0) break;
  }
  const rounds = best!.rounds.map((r) => r.map(([a, b]) => [a, b] as Pairing<TeamId>));
  repairSameNation(rng, rounds, nationOf);
  // Orientación local/visitante equilibrada (4 y 4) por circuito euleriano.
  const index = new Map<TeamId, number>(seeded.map((t, i) => [t, i]));
  const edges: [number, number][] = [];
  for (const round of rounds) for (const [a, b] of round) edges.push([index.get(a)!, index.get(b)!]);
  const forward = eulerOrient(edges, n);
  let e = 0;
  return rounds.map((round) =>
    round.map(([a, b]) => {
      const keep = forward[e++]!;
      // forward = la arista se recorrió de a hacia b: a juega en casa.
      return (edges[e - 1]![0] === index.get(a) ? keep : !keep) ? ([a, b] as Pairing<TeamId>) : ([b, a] as Pairing<TeamId>);
    }),
  );
}
