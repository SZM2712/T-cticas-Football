// Proyecciones de solo lectura para la UI de depuración (Fase 2): clasificaciones,
// plantillas, goleadores, calendario y táctica. Regla 6: nada de rasgos ocultos.
// Los textos se traducen en la UI: aquí solo hay nombres propios, claves y números visibles.

import type { Position } from "../config/attributes";
import { groupTable } from "../competition/standings";
import { fitnessOn, isInjured, isSuspended } from "../match/lineup";
import { defaultSetPieces, teamStyle } from "../match/tactics";
import { currentAbility } from "../player/ability";
import { ageOn } from "../time/calendar";
import type { Match, World } from "../types/domain";
import { isNationalTeamId, nationOfTeam, type CompetitionId, type MatchId, type PlayerId, type TeamId } from "../types/ids";
import type { TacticsPlan } from "../types/tactics";
import { displayName } from "./player";

export interface TeamRef {
  id: TeamId;
  name: string;
  /** Selección: código de nación (la UI lo traduce). */
  nation?: string;
}

export function teamRef(world: World, id: TeamId): TeamRef {
  if (isNationalTeamId(id)) return { id, name: "", nation: nationOfTeam(id) };
  return { id, name: world.clubs[id]?.name ?? id };
}

export interface LeagueOption {
  leagueId: string;
  competitionId: CompetitionId | null;
  nameKey: string;
  nation: string;
  tier: number;
}

export function leagueOptions(world: World): LeagueOption[] {
  return Object.values(world.leagues)
    .sort((a, b) => a.nation.localeCompare(b.nation) || a.tier - b.tier)
    .map((l) => ({
      leagueId: l.id,
      competitionId: l.currentCompetition,
      nameKey: l.currentCompetition ? world.competitions[l.currentCompetition]!.nameKey : `comp.league.${l.nation}.${l.tier}`,
      nation: l.nation,
      tier: l.tier,
    }));
}

export interface TableRowView {
  team: TeamRef;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  points: number;
}

export function leagueTableView(world: World, competitionId: CompetitionId): TableRowView[] {
  const comp = world.competitions[competitionId];
  if (!comp) return [];
  return groupTable(world, competitionId, 0, comp.participants).map((r) => ({
    team: teamRef(world, r.team), played: r.played, won: r.won, drawn: r.drawn, lost: r.lost, gf: r.gf, ga: r.ga, points: r.points,
  }));
}

export interface SquadRowView {
  id: PlayerId;
  name: string;
  position: Position;
  age: number;
  nationality: string;
  /** Nivel visible (CA en su posición, de atributos visibles), 1 decimal. */
  level: number;
  /** Forma física 0–100. */
  fitness: number;
  injuredDays: number;
  suspended: boolean;
  apps: number;
  goals: number;
  assists: number;
  avgRating: number | null;
}

export function squadView(world: World, team: TeamId, competitionId?: CompetitionId): SquadRowView[] {
  const ids = isNationalTeamId(team) ? world.nationalTeams[team]?.squad : world.clubs[team]?.squad;
  const day = world.meta.today;
  const order: Record<string, number> = { GK: 0, CB: 1, LB: 2, RB: 3, DM: 4, CM: 5, LM: 6, RM: 7, AM: 8, LW: 9, RW: 10, ST: 11 };
  return (ids ?? [])
    .map((id) => world.players[id]!)
    .filter(Boolean)
    .map((p) => {
      let apps = 0;
      let goals = 0;
      let assists = 0;
      let ratingSum = 0;
      for (const [compId, lines] of Object.entries(world.stats)) {
        if (competitionId && compId !== competitionId) continue;
        const st = lines[p.id];
        if (!st || st.team !== team) continue;
        apps += st.apps;
        goals += st.goals;
        assists += st.assists;
        ratingSum += st.ratingSum;
      }
      return {
        id: p.id,
        name: displayName(p),
        position: p.position,
        age: ageOn(p.birthDay, day),
        nationality: p.nationality,
        level: Math.round(currentAbility(p) * 10) / 10,
        fitness: Math.round(fitnessOn(p, day) * 100),
        injuredDays: isInjured(p, day) ? p.injury!.until - day : 0,
        suspended: competitionId ? isSuspended(p, competitionId) : p.suspensions.length > 0,
        apps,
        goals,
        assists,
        avgRating: apps ? Math.round((ratingSum / apps) * 100) / 100 : null,
      };
    })
    .sort((a, b) => order[a.position]! - order[b.position]! || b.level - a.level);
}

export interface ScorerView {
  id: PlayerId;
  name: string;
  team: TeamRef;
  goals: number;
  assists: number;
  apps: number;
}

export function topScorersView(world: World, competitionId: CompetitionId, limit = 25): ScorerView[] {
  const lines = world.stats[competitionId] ?? {};
  return Object.entries(lines)
    .filter(([, s]) => s.goals > 0)
    .sort((a, b) => b[1].goals - a[1].goals || b[1].assists - a[1].assists || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([id, s]) => ({ id: id as PlayerId, name: displayName(world.players[id]!), team: teamRef(world, s.team), goals: s.goals, assists: s.assists, apps: s.apps }));
}

export interface FixtureView {
  id: MatchId;
  day: number;
  competitionKey: string;
  home: TeamRef;
  away: TeamRef;
  score?: [number, number];
  pens?: [number, number];
  engine?: "full" | "quick";
}

function fixtureOf(world: World, m: Match): FixtureView {
  const f: FixtureView = {
    id: m.id, day: m.day, competitionKey: world.competitions[m.competitionId]?.nameKey ?? "",
    home: teamRef(world, m.home), away: teamRef(world, m.away),
  };
  if (m.result) {
    f.score = [m.result.home, m.result.away];
    if (m.result.pens) f.pens = m.result.pens;
    f.engine = m.result.engine;
  }
  return f;
}

/** Partidos de un equipo: los `past` últimos jugados y los `next` siguientes. */
export function teamFixturesView(world: World, team: TeamId, past = 5, next = 5): { past: FixtureView[]; next: FixtureView[] } {
  const all = Object.values(world.matches)
    .filter((m) => m.home === team || m.away === team)
    .sort((a, b) => a.day - b.day || a.id.localeCompare(b.id));
  return {
    past: all.filter((m) => m.result).slice(-past).reverse().map((m) => fixtureOf(world, m)),
    next: all.filter((m) => !m.result).slice(0, next).map((m) => fixtureOf(world, m)),
  };
}

/** Resultados de una competición, de los más recientes a los más antiguos. */
export function competitionResultsView(world: World, competitionId: CompetitionId, limit = 40): FixtureView[] {
  const comp = world.competitions[competitionId];
  if (!comp) return [];
  return comp.stages
    .flatMap((s) => s.rounds.flatMap((r) => r.matchIds))
    .map((id) => world.matches[id]!)
    .filter((m) => m?.result)
    .sort((a, b) => b.day - a.day || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map((m) => fixtureOf(world, m));
}

export interface TacticsView {
  team: TeamId;
  /** Plan del usuario, o null si la táctica la decide la IA. */
  plan: TacticsPlan | null;
  /** Valores por defecto de la IA para rellenar el formulario. */
  defaults: Required<Omit<TacticsPlan, "lineup" | "instructions">>;
  squad: { id: PlayerId; name: string; position: Position }[];
}

export function tacticsView(world: World, team: TeamId): TacticsView {
  const style = teamStyle(team);
  const ids = isNationalTeamId(team) ? world.nationalTeams[team]?.squad : world.clubs[team]?.squad;
  return {
    team,
    plan: world.tactics[team] ?? null,
    defaults: {
      formation: style.preferred,
      mentality: 0,
      pressing: Math.round(style.pressing * 100) / 100,
      tempo: Math.round(style.tempo * 100) / 100,
      width: Math.round(style.width * 100) / 100,
      directness: Math.round(style.directness * 100) / 100,
      setPieces: defaultSetPieces(team),
    },
    squad: (ids ?? []).map((id) => world.players[id]!).filter(Boolean).map((p) => ({ id: p.id, name: displayName(p), position: p.position })),
  };
}
