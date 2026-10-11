// Calendarios de liga por el método del círculo (tablas de Berger).

export type Pairing<T> = [home: T, away: T];

/**
 * Jornadas de una liga todos contra todos. Con número impar de equipos, cada
 * jornada un equipo descansa. `double` añade la segunda vuelta con los campos
 * invertidos. Alterna local/visitante para que nadie encadene muchos partidos en casa.
 */
export function roundRobin<T>(teams: readonly T[], double: boolean): Pairing<T>[][] {
  const list: (T | null)[] = teams.slice();
  if (list.length % 2 === 1) list.push(null);
  const n = list.length;
  const rounds: Pairing<T>[][] = [];
  const fixed = list[0];
  let rotating = list.slice(1);
  for (let r = 0; r < n - 1; r++) {
    const current = [fixed, ...rotating];
    const pairs: Pairing<T>[] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = current[i];
      const b = current[n - 1 - i];
      if (a == null || b == null) continue;
      // El fijo alterna campo cada jornada; el resto según paridad de la posición.
      const swap = i === 0 ? r % 2 === 1 : i % 2 === 1;
      pairs.push(swap ? [b, a] : [a, b]);
    }
    rounds.push(pairs);
    rotating = [rotating[rotating.length - 1]!, ...rotating.slice(0, -1)];
  }
  if (!double) return rounds;
  return [...rounds, ...rounds.map((pairs) => pairs.map(([h, a]) => [a, h] as Pairing<T>))];
}
