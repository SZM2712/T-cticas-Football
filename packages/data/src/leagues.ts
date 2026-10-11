// Estructura de las ligas jugables (tamaños y reglas inspirados en la realidad;
// nombres genéricos en i18n). Cada nación tiene además un "tercer nivel en sombra":
// clubes sin calendario propio que intercambian plazas con la segunda división.

import type { PlayableNation } from "./nations";

export interface PromotionRules {
  /** Plazas de ascenso directo (desde el principio de la tabla). */
  auto: number;
  /** Eliminatoria de ascenso entre posiciones [desde, hasta] por una plaza extra. */
  playoff?: { from: number; to: number };
}

export interface RelegationRules {
  /** Plazas de descenso directo (desde el final de la tabla). */
  auto: number;
  /**
   * Posición que juega una promoción a ida y vuelta contra el ganador del playoff de
   * la división inferior (o contra un club del nivel en sombra si es la última división).
   */
  relegationPlayoffPosition?: number;
}

export interface LeagueTierData {
  tier: 1 | 2;
  teams: number;
  /** Calidad media objetivo de un titular (CA en escala 1–20). */
  quality: number;
  /** Dispersión de calidad entre el mejor y el peor club de la liga. */
  spread: number;
  /** Proporción de jugadores extranjeros en plantilla. */
  foreignShare: number;
  promotion?: PromotionRules;
  relegation: RelegationRules;
  /** Ingresos medios por club (millones €/temporada), para finanzas iniciales. */
  revenue: number;
}

export interface NationLeagueData {
  nation: PlayableNation;
  tiers: [LeagueTierData, LeagueTierData];
  /** Clubes del tercer nivel en sombra. */
  shadowTierClubs: number;
  /** Primer fin de semana de liga (mes, día aproximado) y parón invernal (días desde 1 de julio). */
  seasonStart: { month: number; day: number };
  seasonEnd: { month: number; day: number };
  winterBreak?: { from: { month: number; day: number }; to: { month: number; day: number } };
  cup: { semisTwoLegs: boolean; seededTopEntersAtRound?: { topN: number; round: number } };
  /** Plazas continentales por posición final (1.ª división) y para el campeón de copa. */
  continental: { c1: number; c2: number; c3: number; cupWinner: "c2" | "c3" };
}

export const NATION_LEAGUES: readonly NationLeagueData[] = [
  {
    nation: "GB-ENG",
    tiers: [
      { tier: 1, teams: 20, quality: 13.9, spread: 2.6, foreignShare: 0.62, relegation: { auto: 3 }, revenue: 280 },
      {
        tier: 2, teams: 24, quality: 11.2, spread: 1.8, foreignShare: 0.32,
        promotion: { auto: 2, playoff: { from: 3, to: 6 } }, relegation: { auto: 3 }, revenue: 32,
      },
    ],
    shadowTierClubs: 10,
    seasonStart: { month: 8, day: 9 },
    seasonEnd: { month: 5, day: 24 },
    cup: { semisTwoLegs: false },
    continental: { c1: 4, c2: 1, c3: 1, cupWinner: "c2" },
  },
  {
    nation: "ES",
    tiers: [
      { tier: 1, teams: 20, quality: 13.5, spread: 2.8, foreignShare: 0.4, relegation: { auto: 3 }, revenue: 160 },
      {
        tier: 2, teams: 22, quality: 10.9, spread: 1.6, foreignShare: 0.22,
        promotion: { auto: 2, playoff: { from: 3, to: 6 } }, relegation: { auto: 4 }, revenue: 14,
      },
    ],
    shadowTierClubs: 12,
    seasonStart: { month: 8, day: 15 },
    seasonEnd: { month: 5, day: 24 },
    winterBreak: { from: { month: 12, day: 23 }, to: { month: 1, day: 2 } },
    cup: { semisTwoLegs: true, seededTopEntersAtRound: { topN: 4, round: 3 } },
    continental: { c1: 4, c2: 1, c3: 1, cupWinner: "c2" },
  },
  {
    nation: "IT",
    tiers: [
      { tier: 1, teams: 20, quality: 13.2, spread: 2.5, foreignShare: 0.6, relegation: { auto: 3 }, revenue: 130 },
      {
        tier: 2, teams: 20, quality: 10.8, spread: 1.6, foreignShare: 0.25,
        promotion: { auto: 2, playoff: { from: 3, to: 6 } }, relegation: { auto: 3, relegationPlayoffPosition: 17 }, revenue: 10,
      },
    ],
    shadowTierClubs: 10,
    seasonStart: { month: 8, day: 22 },
    seasonEnd: { month: 5, day: 24 },
    winterBreak: { from: { month: 12, day: 31 }, to: { month: 1, day: 3 } },
    cup: { semisTwoLegs: true, seededTopEntersAtRound: { topN: 8, round: 3 } },
    continental: { c1: 4, c2: 1, c3: 1, cupWinner: "c2" },
  },
  {
    nation: "DE",
    tiers: [
      { tier: 1, teams: 18, quality: 13.3, spread: 2.6, foreignShare: 0.5, relegation: { auto: 2, relegationPlayoffPosition: 16 }, revenue: 170 },
      {
        tier: 2, teams: 18, quality: 11.0, spread: 1.6, foreignShare: 0.28,
        promotion: { auto: 2, playoff: { from: 3, to: 3 } }, relegation: { auto: 2, relegationPlayoffPosition: 16 }, revenue: 25,
      },
    ],
    shadowTierClubs: 10,
    seasonStart: { month: 8, day: 22 },
    seasonEnd: { month: 5, day: 17 },
    winterBreak: { from: { month: 12, day: 22 }, to: { month: 1, day: 9 } },
    cup: { semisTwoLegs: false },
    continental: { c1: 4, c2: 1, c3: 1, cupWinner: "c2" },
  },
  {
    nation: "FR",
    tiers: [
      { tier: 1, teams: 18, quality: 12.9, spread: 2.7, foreignShare: 0.45, relegation: { auto: 2, relegationPlayoffPosition: 16 }, revenue: 90 },
      {
        tier: 2, teams: 18, quality: 10.6, spread: 1.5, foreignShare: 0.2,
        promotion: { auto: 2, playoff: { from: 3, to: 5 } }, relegation: { auto: 2, relegationPlayoffPosition: 16 }, revenue: 9,
      },
    ],
    shadowTierClubs: 10,
    seasonStart: { month: 8, day: 15 },
    seasonEnd: { month: 5, day: 17 },
    winterBreak: { from: { month: 12, day: 21 }, to: { month: 1, day: 3 } },
    cup: { semisTwoLegs: false },
    continental: { c1: 3, c2: 2, c3: 1, cupWinner: "c2" },
  },
];
