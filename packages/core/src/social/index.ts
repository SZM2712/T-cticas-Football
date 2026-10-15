// Orquestación del vestuario: tomar el mando de un club, tick diario (dinámicas de ego),
// semanal (grafo, jerarquía, camarillas, moral, promesas), mensual (poda de recuerdos) y
// consecuencias de cada partido oficial en los clubes dirigidos por humanos.

import { K_SHARED_GOAL, MORALE_RESULT } from "../config/social";
import type { MatchReport } from "../match/types";
import type { Match, World } from "../types/domain";
import type { ClubId, GameDay, PlayerId } from "../types/ids";
import type { Manager, ManagerId } from "../types/social";
import { clamp, round } from "../util/math";
import { nextId } from "../world/ids";
import { worldRng } from "../world/rng";
import { countMatchForCommitments, reviewCommitments } from "./commitments";
import { dailyEgo } from "./ego";
import { initDressingRoom, recordParticipation, squadPlayers, statusRank, weeklySocial } from "./graph";
import { managedClubs, managerOf, managerRef, pairKey, pruneMemories, remember } from "./store";

/** Un humano toma el mando de un club: crea su mánager (o lo cambia de club) y el vestuario. */
export function takeCharge(world: World, clubId: ClubId, name: string, by?: ManagerId): Manager {
  const day = world.meta.today;
  let mgr = by ? world.managers[by] : undefined;
  if (!mgr) {
    const id = nextId<string>(world, "mg", 2) as ManagerId;
    mgr = { id, name, role: "coach", clubId: null, reputation: 0.45, sinceDay: day };
    world.managers[id] = mgr;
  }
  if (mgr.clubId && mgr.clubId !== clubId && !managerOfOther(world, mgr.clubId, mgr.id)) delete world.dressing[mgr.clubId];
  mgr.clubId = clubId;
  mgr.sinceDay = day;
  if (!world.dressing[clubId]) initDressingRoom(world, clubId, mgr.id, day, worldRng(world).fork(`social/init/${clubId}/${day}`));
  world.events.push({ day, type: "manager.tookCharge", data: { manager: mgr.id, club: clubId } });
  return mgr;
}

function managerOfOther(world: World, clubId: ClubId, except: ManagerId): boolean {
  return Object.values(world.managers).some((m) => m.id !== except && m.clubId === clubId);
}

/** Tick diario del vestuario (tras los partidos del día). */
export function dailySocial(world: World, day: GameDay): void {
  for (const clubId of managedClubs(world)) {
    const dr = world.dressing[clubId]!;
    if (day - dr.lastWeekly >= 7) {
      weeklySocial(world, clubId, day, worldRng(world).fork(`social/week/${clubId}/${day}`));
    }
    dailyEgo(world, clubId, day);
  }
  // Revisión semanal de promesas (cada 7 días del mundo).
  if (managedClubs(world).length && day % 7 === 0) reviewCommitments(world, day);
}

/** Poda mensual de recuerdos que ya no pesan (solo jugadores con recuerdos). */
export function monthlyMemoryPrune(world: World, day: GameDay): void {
  for (const clubId of managedClubs(world)) for (const p of squadPlayers(world, clubId)) pruneMemories(world, p, day);
}

/** Consecuencias sociales de un partido oficial para los clubes dirigidos por humanos. */
export function afterMatch(world: World, m: Match, report: MatchReport, official: boolean): void {
  const day = m.day as GameDay;
  const teams = [m.home, m.away] as const;
  for (const side of [0, 1] as const) {
    const clubId = teams[side] as ClubId;
    const dr = world.dressing[clubId];
    if (!dr) continue;
    const club = world.clubs[clubId]!;
    const lines = report.players.filter((l) => l.side === side);
    const played = new Map<string, boolean>(lines.map((l) => [l.id, l.started]));
    const started = new Set(lines.filter((l) => l.started).map((l) => l.id));
    if (official) {
      recordParticipation(dr, club.squad, played);
      countMatchForCommitments(world, clubId, started);
    }
    // Moral por el resultado, según los minutos jugados.
    const [gf, ga] = side === 0 ? report.score : [report.score[1], report.score[0]];
    const res = gf > ga ? 1 : gf < ga ? -1 : 0;
    for (const l of lines) {
      const p = world.players[l.id];
      if (!p) continue;
      p.state.morale = round(clamp(p.state.morale + res * MORALE_RESULT * (0.4 + 0.6 * Math.min(1, l.minutes / 90)), -1, 1), 3);
    }
    if (!official) continue;
    const mgr = managerOf(world, clubId);
    // Química de campo: goles con asistencia entre compañeros.
    for (const e of report.events) {
      if (e.type !== "goal" || e.side !== side || !e.player || !e.other) continue;
      const rel = world.relationships[pairKey(e.player, e.other)];
      if (rel) rel.affinity = round(clamp(rel.affinity + K_SHARED_GOAL, -1, 1), 4);
    }
    // Quien espera ser titular y se queda fuera, o es sustituido pronto, lo recuerda.
    for (const id of [...club.squad].sort()) {
      const p = world.players[id];
      if (!p || !mgr || p.injury || p.suspensions.length) continue;
      const expect = statusRank(p.state.expectedStatus);
      if (expect < statusRank("firstTeam") || p.psych.ego < 0.5) continue;
      const line = lines.find((l) => l.id === id);
      if (!line) {
        remember(world, day, {
          owner: id as PlayerId, about: [managerRef(mgr.id)], kind: "benched", valence: -0.3, intensity: 0.2 + 0.3 * p.psych.ego,
          publicness: "squad", source: `match:${m.id}`,
        });
      } else if (line.started && line.minutes < 60 && !line.injuryDays && !line.red) {
        remember(world, day, {
          owner: id as PlayerId, about: [managerRef(mgr.id)], kind: "subbedOff", valence: -0.2, intensity: 0.15 + 0.25 * p.psych.ego,
          publicness: "public", source: `match:${m.id}`,
        });
      }
    }
  }
}
