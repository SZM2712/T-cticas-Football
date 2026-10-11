// Asignación de día concreto a cada partido respetando el descanso mínimo entre
// partidos de un mismo equipo. Cada partido tiene un día base (jornada) y una lista de
// candidatos (sáb/dom/vie/lun, mar/mié…). Si no cabe, intenta mover partidos vecinos
// dentro de sus propios candidatos.

import { MIN_REST_DAYS } from "../config/calendar";
import type { Match, World } from "../types/domain";
import type { GameDay, MatchId, TeamId } from "../types/ids";

export type { SlotKind } from "../types/domain";
import type { SlotKind } from "../types/domain";

/** Candidatos por tipo de jornada, en orden de preferencia, relativos al día base. */
const OFFSETS: Record<SlotKind, number[]> = {
  weekend: [0, 1, -1, 2], // sábado, domingo, viernes, lunes
  midweek: [0, 1, -1], // mar/mié según base, y adyacentes
  c1: [0, 1], // martes, miércoles
  thursday: [0],
  fixed: [0],
  intl1: [0, 1], // jueves, viernes
  intl2: [0, 1, -1], // domingo, lunes, sábado
};

export function candidatesFor(base: GameDay, kind: SlotKind): GameDay[] {
  return OFFSETS[kind].map((o) => (base + o) as GameDay);
}

/** Índice en memoria de los días ocupados por cada equipo (se reconstruye del mundo). */
export class TeamSchedule {
  private byTeam = new Map<TeamId, Map<number, MatchId[]>>();
  private byDay = new Map<number, Set<MatchId>>();

  static fromWorld(world: World): TeamSchedule {
    const s = new TeamSchedule();
    for (const m of Object.values(world.matches)) s.add(m);
    return s;
  }

  add(m: Match): void {
    let set = this.byDay.get(m.day);
    if (!set) this.byDay.set(m.day, (set = new Set()));
    set.add(m.id);
    for (const t of [m.home, m.away]) {
      let days = this.byTeam.get(t);
      if (!days) this.byTeam.set(t, (days = new Map()));
      const list = days.get(m.day) ?? [];
      list.push(m.id);
      days.set(m.day, list);
    }
  }

  remove(m: Match): void {
    this.byDay.get(m.day)?.delete(m.id);
    for (const t of [m.home, m.away]) {
      const days = this.byTeam.get(t);
      const list = days?.get(m.day);
      if (!days || !list) continue;
      const rest = list.filter((id) => id !== m.id);
      if (rest.length) days.set(m.day, rest);
      else days.delete(m.day);
    }
  }

  /** Partidos del equipo a menos de MIN_REST_DAYS de `day` (excluyendo `except`). */
  conflicts(team: TeamId, day: number, except?: MatchId): MatchId[] {
    const days = this.byTeam.get(team);
    if (!days) return [];
    const out: MatchId[] = [];
    for (let d = day - MIN_REST_DAYS + 1; d <= day + MIN_REST_DAYS - 1; d++) {
      for (const id of days.get(d) ?? []) if (id !== except) out.push(id);
    }
    return out;
  }

  isFree(m: Pick<Match, "home" | "away" | "id">, day: number): boolean {
    return this.conflicts(m.home, day, m.id).length === 0 && this.conflicts(m.away, day, m.id).length === 0;
  }

  /** Partidos programados en un día, en orden de id (determinista). */
  matchesOn(day: number): MatchId[] {
    return [...(this.byDay.get(day) ?? [])].sort();
  }

  daysOf(team: TeamId): number[] {
    return [...(this.byTeam.get(team)?.keys() ?? [])].sort((a, b) => a - b);
  }
}

type Journal = { m: Match; from: GameDay | null }[];

function undo(schedule: TeamSchedule, journal: Journal, mark: number): void {
  while (journal.length > mark) {
    const { m, from } = journal.pop()!;
    if (from === null) schedule.remove(m);
    else {
      m.day = from;
      schedule.add(m);
    }
  }
}

/**
 * Intenta colocar `m` (que no está en el índice) en `day`. Si choca con partidos aún no
 * jugados, intenta recolocarlos recursivamente en otro de sus candidatos (hasta `depth`
 * niveles). Todo cambio queda en `journal` para poder deshacerlo si la rama falla.
 */
function tryAt(world: World, schedule: TeamSchedule, m: Match, day: GameDay, depth: number, locked: Set<MatchId>, journal: Journal): boolean {
  const blockers = [...new Set([...schedule.conflicts(m.home, day, m.id), ...schedule.conflicts(m.away, day, m.id)])];
  if (blockers.length === 0) {
    m.day = day;
    schedule.add(m);
    journal.push({ m, from: null });
    return true;
  }
  if (depth === 0) return false;
  const others = blockers.map((id) => world.matches[id]);
  if (others.some((o) => !o || o.result || locked.has(o.id))) return false;
  const mark = journal.length;
  m.day = day;
  schedule.add(m);
  journal.push({ m, from: null });
  locked.add(m.id);
  for (const o of others as Match[]) {
    // Puede que un movimiento anterior ya lo haya desplazado fuera del conflicto.
    if (Math.abs(o.day - day) >= MIN_REST_DAYS) continue;
    const from = o.day;
    schedule.remove(o);
    journal.push({ m: o, from });
    const moved = o.candidates.some((alt) => alt !== from && tryAt(world, schedule, o, alt, depth - 1, locked, journal));
    if (!moved) {
      undo(schedule, journal, mark);
      locked.delete(m.id);
      return false;
    }
  }
  locked.delete(m.id);
  return true;
}

/**
 * Coloca un partido nuevo: primer candidato libre; si no hay, recoloca partidos vecinos
 * no jugados (búsqueda en profundidad creciente). Devuelve false si tuvo que aceptar un
 * choque (lo detectan los tests de calendario).
 */
export function placeMatch(world: World, schedule: TeamSchedule, m: Match): boolean {
  for (let depth = 0; depth <= 3; depth++) {
    for (const day of m.candidates) {
      const journal: Journal = [];
      if (tryAt(world, schedule, m, day, depth, new Set(), journal)) return true;
    }
  }
  m.day = m.candidates[0]!;
  schedule.add(m);
  return false;
}
