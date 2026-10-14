// Modelo rápido de resultado (Poisson por fuerza del once). Es el motor del LOD ligero
// (partidos entre clubes en sombra) y está calibrado contra el motor completo: mismas
// medias de goles, victorias locales y empates (ver tools/sim y docs/balance/fase2.md).

import { POSITION_LINE, type Position } from "../config/attributes";
import { QUICK } from "../config/match";
import { currentAbility } from "../player/ability";
import type { Rng } from "../rng/rng";
import type { Match, World } from "../types/domain";
import { isNationalTeamId, type TeamId } from "../types/ids";
import { isInjured, pickLineup, type Lineup } from "./lineup";
import { aiTactics } from "./tactics";
import type { MatchEvent, MatchReport, PlayerLine, Side, TeamStats } from "./types";

const XI: Record<string, number> = { GK: 1, DEF: 4, MID: 3, FWD: 3 };

/** Media de CA del mejor once (1-4-3-3 por líneas) de una lista de jugadores. */
export function squadRating(world: World, squad: readonly string[]): number {
  const byLine: Record<string, number[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  for (const id of squad) {
    const p = world.players[id];
    if (!p || p.retired || isInjured(p, world.meta.today)) continue;
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
  return (r(home) - r(away)) * QUICK.k;
}

/** Peso de cada puesto para marcar (el resto de goles los reparte la finalización). */
const SCORE_WEIGHT: Record<string, number> = { ST: 5, LW: 3.2, RW: 3.2, AM: 2.6, LM: 1.5, RM: 1.5, CM: 1.1, DM: 0.5, CB: 0.55, LB: 0.4, RB: 0.4, GK: 0 };

function emptyStats(): TeamStats {
  return { shots: 0, onTarget: 0, xg: 0, possession: 0, passes: 0, passesCompleted: 0, tackles: 0, fouls: 0, corners: 0, yellow: 0, red: 0 };
}

/**
 * Partido con el modelo rápido. Devuelve un informe con la misma forma que el del motor
 * completo (marcador, goleadores, asistentes y once), sin estadísticas de juego ni fotogramas.
 * `aggregate`: goles previos de la eliminatoria [local de este partido, visitante].
 */
export function quickMatch(world: World, m: Match, rng: Rng, ratings: Map<string, number>, aggregate?: [number, number]): MatchReport {
  const d = strengthDiff(world, m.home, m.away, ratings);
  const lh = (m.neutral ? QUICK.neutral : QUICK.baseHome) * Math.exp(d / 2);
  const la = (m.neutral ? QUICK.neutral : QUICK.baseAway) * Math.exp(-d / 2);
  const score: [number, number] = [rng.poisson(lh), rng.poisson(la)];
  let extraTime = false;
  let pens: [number, number] | undefined;
  if (m.decisive) {
    const [ph, pa] = aggregate ?? [0, 0];
    if (score[0] + ph === score[1] + pa) {
      // Prórroga y, si persiste el empate, penaltis con ligera ventaja del mejor.
      extraTime = true;
      const extraH = rng.poisson(lh / 3);
      const extraA = rng.poisson(la / 3);
      score[0] += extraH;
      score[1] += extraA;
      if (extraH === extraA) {
        const homeWins = rng.chance(0.5 + Math.max(-0.1, Math.min(0.1, d * 0.1)));
        const loser = rng.int(2, 4);
        pens = homeWins ? [loser + 1, loser] : [loser, loser + 1];
      }
    }
  }
  const lineups = [
    pickLineup(world, m.home, m.day, m.competitionId, world.tactics[m.home]),
    pickLineup(world, m.away, m.day, m.competitionId, world.tactics[m.away]),
  ] as const;
  const events: MatchEvent[] = [];
  const goals: Map<string, number>[] = [new Map(), new Map()];
  const assists: Map<string, number>[] = [new Map(), new Map()];
  for (const side of [0, 1] as Side[]) {
    const xi = lineups[side].xi;
    if (!xi.length) continue;
    for (let g = 0; g < score[side]; g++) {
      const minute = rng.int(1, extraTime ? 120 : 90);
      const scorer = rng.weighted(xi, (p) => (SCORE_WEIGHT[p.position] ?? 1) * (p.technical.finishing / 10) ** 1.5);
      const ev: MatchEvent = { t: (minute - 1) * 60 + 30, minute, added: 0, side, type: "goal", player: scorer.id, detail: "open" };
      goals[side]!.set(scorer.id, (goals[side]!.get(scorer.id) ?? 0) + 1);
      if (rng.chance(0.72)) {
        const assist = rng.weighted(xi, (p) => (p === scorer || p.position === "GK" ? 0 : (p.technical.shortPassing + p.mental.vision + p.technical.crossing) / 30));
        if (assist !== scorer) {
          ev.other = assist.id;
          assists[side]!.set(assist.id, (assists[side]!.get(assist.id) ?? 0) + 1);
        }
      }
      events.push(ev);
    }
  }
  events.sort((a, b) => a.t - b.t || a.side - b.side);
  const players: PlayerLine[] = [];
  lineups.forEach((l: Lineup, side) => {
    for (const p of l.xi) {
      const gl = goals[side]!.get(p.id) ?? 0;
      const as = assists[side]!.get(p.id) ?? 0;
      const diff = score[side]! - score[1 - side]!;
      players.push({
        id: p.id, side: side as Side, started: true, minutes: extraTime ? 120 : 90,
        rating: Math.round(Math.min(10, 6.5 + gl + 0.5 * as + (diff > 0 ? 0.3 : diff < 0 ? -0.3 : 0)) * 10) / 10,
        goals: gl, assists: as, yellow: 0, red: false, condition: 0.75,
      });
    }
  });
  const report: MatchReport = {
    seedPath: `match/${m.id}`,
    score,
    extraTime,
    events,
    stats: [emptyStats(), emptyStats()],
    players,
    lineups: [lineups[0].xi.map((p) => p.id), lineups[1].xi.map((p) => p.id)],
    tactics: [
      aiTactics(m.home, lineups[0].formation, lineups[0].level, lineups[1].level, !m.neutral),
      aiTactics(m.away, lineups[1].formation, lineups[1].level, lineups[0].level, false),
    ],
    instructions: [],
  };
  if (pens) report.pens = pens;
  return report;
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
