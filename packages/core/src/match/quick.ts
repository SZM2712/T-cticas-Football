// Modelo rápido de resultado (Poisson por fuerza de equipo). PROVISIONAL en la Fase 1:
// existe solo para que las competiciones avancen y se puedan probar ascensos,
// clasificatorias y calendarios de varias temporadas. En la Fase 2 lo sustituye el
// motor de partido y queda como "motor ligero" calibrado para clubes en sombra.

import { POSITION_LINE, type Position } from "../config/attributes";
import { currentAbility } from "../player/ability";
import type { Rng } from "../rng/rng";
import type { Match, MatchResult, World } from "../types/domain";
import { isNationalTeamId, type TeamId } from "../types/ids";

/** Goles esperados de referencia y peso de la diferencia de nivel (puntos de CA del once). */
const BASE_HOME = 1.45;
const BASE_AWAY = 1.15;
const CLUB_K = 0.3;
const NEUTRAL_HOME = 1.3;

const XI: Record<string, number> = { GK: 1, DEF: 4, MID: 3, FWD: 3 };

/** Media de CA del mejor once (1-4-3-3 por líneas) de una lista de jugadores. */
export function squadRating(world: World, squad: readonly string[]): number {
  const byLine: Record<string, number[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  for (const id of squad) {
    const p = world.players[id];
    if (!p || p.injury) continue;
    byLine[POSITION_LINE[p.position as Position]]!.push(currentAbility(p));
  }
  let sum = 0;
  let n = 0;
  for (const [line, count] of Object.entries(XI)) {
    const best = byLine[line]!.sort((a, b) => b - a).slice(0, count);
    sum += best.reduce((a, b) => a + b, 0);
    n += best.length;
  }
  return n ? sum / n : 8;
}

/** Nivel de un equipo: su mejor once (club: plantilla; selección: última convocatoria). */
export function teamRating(world: World, team: TeamId): number {
  const squad = isNationalTeamId(team) ? world.nationalTeams[team]?.squad : world.clubs[team]?.squad;
  return squad ? squadRating(world, squad) : 8;
}

/**
 * Diferencia de nivel en escala de goles. Las selecciones también se miden por la calidad
 * de su convocatoria (no por su Elo): si no, Elo y resultados se alimentarían entre sí
 * y el Elo sería un paseo aleatorio sin ancla.
 */
function strengthDiff(world: World, home: TeamId, away: TeamId, ratings: Map<string, number>): number {
  const r = (id: TeamId) => {
    let v = ratings.get(id);
    if (v === undefined) ratings.set(id, (v = teamRating(world, id)));
    return v;
  };
  return (r(home) - r(away)) * CLUB_K;
}

/** Marcador de un partido. `aggregate`: goles previos de la eliminatoria [local de este partido, visitante]. */
export function quickResult(world: World, m: Match, rng: Rng, ratings: Map<string, number>, aggregate?: [number, number]): MatchResult {
  const d = strengthDiff(world, m.home, m.away, ratings);
  const lh = (m.neutral ? NEUTRAL_HOME : BASE_HOME) * Math.exp(d / 2);
  const la = (m.neutral ? NEUTRAL_HOME : BASE_AWAY) * Math.exp(-d / 2);
  const home = rng.poisson(lh);
  const away = rng.poisson(la);
  const result: MatchResult = { home, away, quick: true };
  if (m.decisive) {
    const [ph, pa] = aggregate ?? [0, 0];
    if (home + ph === away + pa) {
      // Prórroga simplificada y, si persiste, penaltis con ligera ventaja del mejor.
      const extraH = rng.poisson(lh / 3);
      const extraA = rng.poisson(la / 3);
      result.home += extraH;
      result.away += extraA;
      if (extraH === extraA) {
        const homeWins = rng.chance(0.5 + Math.max(-0.1, Math.min(0.1, d * 0.1)));
        const loser = rng.int(2, 4);
        result.pens = homeWins ? [loser + 1, loser] : [loser, loser + 1];
      }
    }
  }
  return result;
}

/** Actualización Elo de selecciones (fórmula World Football Elo simplificada). */
export function updateElo(world: World, m: Match): void {
  if (!m.result || !isNationalTeamId(m.home)) return;
  const h = world.nationalTeams[m.home];
  const a = world.nationalTeams[m.away];
  if (!h || !a) return;
  const comp = world.competitions[m.competitionId];
  const k = comp?.kind === "friendly" ? 20 : comp?.kind === "worldCup" ? 60 : comp?.kind === "continentalCup" ? 50 : 40;
  const adv = m.neutral ? 0 : 100;
  const expected = 1 / (1 + Math.pow(10, -(h.elo + adv - a.elo) / 400));
  const diff = m.result.home - m.result.away;
  const score = diff > 0 ? 1 : diff < 0 ? 0 : 0.5;
  const g = Math.abs(diff) <= 1 ? 1 : Math.abs(diff) === 2 ? 1.5 : (11 + Math.abs(diff)) / 8;
  const delta = Math.round(k * g * (score - expected) * 10) / 10;
  h.elo = Math.round((h.elo + delta) * 10) / 10;
  a.elo = Math.round((a.elo - delta) * 10) / 10;
}
