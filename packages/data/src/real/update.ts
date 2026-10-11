// Actualización de las ligas reales con datos recientes (p. ej. importados de una API).
// Solo se puede conocer con certeza la composición de las divisiones importadas; el
// resto se deduce manteniendo los tamaños de cada liga.

import { NATION_LEAGUES } from "../leagues";
import { REAL_LEAGUES, type RealClub, type RealLeaguePack } from "./clubs";

export interface RealLeagueUpdate {
  nation: string;
  tier: 1 | 2;
  /** Composición completa y actual de esa división. */
  clubs: RealClub[];
}

export interface RealDataUpdate {
  source: string;
  /** Fecha de la importación (ISO). */
  importedAt: string;
  season: string;
  leagues: RealLeagueUpdate[];
  /** Procedencia de cada parte de los datos. */
  notes?: string[];
}

/**
 * Aplica una actualización sobre el pack base. Si solo se conoce la 1.ª división, la
 * 2.ª se deduce: los que subieron salen, los que bajaron entran, y los tamaños se
 * ajustan con el tercer nivel. Devuelve también avisos legibles.
 */
export function mergeLeagues(update: RealDataUpdate | undefined): { leagues: Record<string, RealLeaguePack>; warnings: string[] } {
  const leagues: Record<string, RealLeaguePack> = {};
  const warnings: string[] = [];
  for (const data of NATION_LEAGUES) {
    const base = REAL_LEAGUES[data.nation]!;
    const t1Update = update?.leagues.find((l) => l.nation === data.nation && l.tier === 1);
    const t2Update = update?.leagues.find((l) => l.nation === data.nation && l.tier === 2);
    const all = new Map<string, RealClub>();
    for (const c of [...base.tier1, ...base.tier2, ...base.tier3]) all.set(c.n, c);
    for (const l of [t1Update, t2Update]) for (const c of l?.clubs ?? []) all.set(c.n, c);

    const tier1 = t1Update ? t1Update.clubs.slice() : base.tier1.slice();
    const inT1 = new Set(tier1.map((c) => c.n));
    let tier2: RealClub[];
    if (t2Update) tier2 = t2Update.clubs.filter((c) => !inT1.has(c.n));
    else {
      // Deducción: la 2.ª anterior sin los que subieron, más los que bajaron de la 1.ª.
      tier2 = [...base.tier2, ...base.tier1].filter((c) => !inT1.has(c.n)).map((c) => all.get(c.n) ?? c);
      if (t1Update) warnings.push(`${data.nation}: 2.ª división deducida (la fuente no la incluye); revísala`);
    }
    const inTop = new Set([...tier1, ...tier2].map((c) => c.n));
    let tier3 = [...base.tier3, ...base.tier2, ...base.tier1].filter((c) => !inTop.has(c.n)).map((c) => all.get(c.n) ?? c);
    tier3 = [...new Map(tier3.map((c) => [c.n, c])).values()];

    const [want1, want2] = [data.tiers[0].teams, data.tiers[1].teams];
    if (tier1.length !== want1) warnings.push(`${data.nation}: la 1.ª tiene ${tier1.length} clubes y se esperaban ${want1}`);
    // Ajuste de la 2.ª al tamaño de la liga.
    tier2.sort((a, b) => b.q - a.q);
    while (tier2.length > want2) tier3.push(tier2.pop()!);
    tier3.sort((a, b) => b.q - a.q);
    while (tier2.length < want2 && tier3.length) tier2.push(tier3.shift()!);
    leagues[data.nation] = { tier1, tier2, tier3: tier3.slice(0, Math.max(data.shadowTierClubs, base.tier3.length)) };
  }
  return { leagues, warnings };
}
