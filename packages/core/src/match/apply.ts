// Consecuencias de un partido en el mundo: resultado, estadísticas por competición,
// forma física, lesiones, sanciones, internacionalidades y eventos que se recuerdan.

import type { Match, MatchCard, MatchGoal, MatchResult, PlayerCompStats, World } from "../types/domain";
import { isNationalTeamId, type GameDay, type PlayerId, type TeamId } from "../types/ids";
import type { MatchReport } from "./types";

/** Amarillas acumuladas en una competición que suponen un partido de sanción. */
export const YELLOWS_FOR_BAN = 5;
/** Partidos de sanción por roja directa y por doble amarilla. */
export const BAN_DIRECT_RED = 2;
export const BAN_SECOND_YELLOW = 1;
/** Lesiones de al menos estos días quedan en el registro de eventos del mundo. */
export const NOTABLE_INJURY_DAYS = 21;

export function resultFromReport(report: MatchReport, engine: "full" | "quick"): MatchResult {
  const goals: MatchGoal[] = [];
  const cards: MatchCard[] = [];
  for (const e of report.events) {
    if ((e.type === "goal" || e.type === "ownGoal") && e.player) {
      const g: MatchGoal = { minute: e.minute, side: e.side, scorer: e.player, kind: e.detail ?? "open" };
      if (e.other) g.assist = e.other;
      goals.push(g);
    } else if ((e.type === "yellow" || e.type === "red") && e.player) {
      cards.push({ minute: e.minute, side: e.side, player: e.player, red: e.type === "red" });
    }
  }
  const result: MatchResult = { home: report.score[0], away: report.score[1], engine, goals, cards };
  if (report.pens) result.pens = report.pens;
  if (report.extraTime) result.extraTime = true;
  if (engine === "full") {
    const [h, a] = report.stats;
    const total = h.possession + a.possession;
    result.stats = {
      shots: [h.shots, a.shots],
      onTarget: [h.onTarget, a.onTarget],
      xg: [Math.round(h.xg * 100), Math.round(a.xg * 100)],
      possession: total ? Math.round((100 * h.possession) / total) : 50,
    };
    let best: { id: PlayerId; r: number } | undefined;
    for (const l of report.players) if (!best || l.rating > best.r) best = { id: l.id, r: l.rating };
    if (best) result.motm = best.id;
  }
  return result;
}

function statLine(world: World, competitionId: string, player: PlayerId, team: TeamId): PlayerCompStats {
  const comp = (world.stats[competitionId] ??= {});
  return (comp[player] ??= { team, apps: 0, starts: 0, minutes: 0, goals: 0, assists: 0, yellow: 0, red: 0, ratingSum: 0 });
}

export function applyReport(world: World, m: Match, report: MatchReport, engine: "full" | "quick"): void {
  m.result = resultFromReport(report, engine);
  if (report.interventions?.length) m.interventions = report.interventions;
  const day = m.day as GameDay;
  // Instrucciones ignoradas: el técnico (y en la Fase 4 el vestuario) lo recuerda.
  for (const o of report.instructions) {
    if (!o.followed) world.events.push({ day, type: "player.ignoredInstruction", data: { player: o.player, instruction: o.key, match: m.id } });
  }
  const teams: [TeamId, TeamId] = [m.home, m.away];
  const friendly = world.competitions[m.competitionId]?.kind === "friendly";

  // Sanciones cumplidas: quien las tenía en esta competición no ha jugado este partido.
  for (const team of teams) {
    const squad = isNationalTeamId(team) ? world.nationalTeams[team]?.squad : world.clubs[team]?.squad;
    for (const id of squad ?? []) {
      const p = world.players[id];
      if (!p || !p.suspensions.length) continue;
      for (const s of p.suspensions) if (s.competitionId === m.competitionId) s.matches--;
      p.suspensions = p.suspensions.filter((s) => s.matches > 0);
      if (p.injury && p.injury.until <= day) p.injury = null;
    }
  }

  const redDetail = new Map<string, string>();
  for (const e of report.events) if (e.type === "red" && e.player) redDetail.set(e.player, e.detail ?? "direct");

  for (const line of report.players) {
    const p = world.players[line.id];
    if (!p) continue;
    const team = teams[line.side];
    p.development.monthMinutes += line.minutes;
    if (engine === "full") {
      p.fitness = line.condition;
      p.fitnessDay = day;
    }
    if (!friendly) {
      const st = statLine(world, m.competitionId, line.id, team);
      st.apps++;
      if (line.started) st.starts++;
      st.minutes += line.minutes;
      st.goals += line.goals;
      st.assists += line.assists;
      st.ratingSum = Math.round((st.ratingSum + line.rating) * 10) / 10;
      if (line.red) {
        st.red++;
        const ban = redDetail.get(line.id) === "secondYellow" ? BAN_SECOND_YELLOW : BAN_DIRECT_RED;
        p.suspensions.push({ competitionId: m.competitionId, matches: ban });
        world.events.push({ day, type: "match.redCard", data: { player: line.id, match: m.id, matches: ban } });
      } else if (line.yellow) {
        st.yellow += line.yellow;
        if (st.yellow % YELLOWS_FOR_BAN === 0) p.suspensions.push({ competitionId: m.competitionId, matches: 1 });
      }
    }
    if (isNationalTeamId(team)) {
      p.caps++;
      p.internationalGoals += line.goals;
    }
    if (line.injuryDays) {
      p.injury = { kind: "match", since: day, until: (day + line.injuryDays) as GameDay };
      if (line.injuryDays >= NOTABLE_INJURY_DAYS) {
        world.events.push({ day, type: "player.injured", data: { player: line.id, match: m.id, days: line.injuryDays } });
      }
    }
  }
}
