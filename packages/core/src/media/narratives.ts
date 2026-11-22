// Narrativas: el tablero vivo del que salen preguntas de prensa, titulares y publicaciones
// (DISEÑO §6). Solo alrededor de clubes dirigidos por humanos. Cada narrativa enlaza los hechos
// que la sostienen; su calor sube con cada hecho nuevo y se enfría con los días.

import {
  DIVIDED_SHARE, INJURY_BLOW_DAYS, NARRATIVE_CLOSE_HEAT, NARRATIVE_FEED, NARRATIVE_HALF_LIFE, NARRATIVE_KEEP_DAYS,
} from "../config/media";
import { managedClubs } from "../social/store";
import type { World } from "../types/domain";
import type { ClubId, GameDay, PlayerId, StaffId } from "../types/ids";
import type { MediaSubject, Narrative, NarrativeKind } from "../types/media";
import type { ManagerId } from "../types/social";
import { round } from "../util/math";
import { nextId } from "../world/ids";
import { eventRef, subjectKey } from "./state";

const DECAY = Math.pow(0.5, 1 / NARRATIVE_HALF_LIFE);

/** Narrativa abierta de ese tipo sobre ese sujeto en ese club, si la hay. */
export function findNarrative(world: World, kind: NarrativeKind, club: ClubId, subject: MediaSubject): Narrative | undefined {
  const key = subjectKey(subject);
  for (const id of Object.keys(world.media.narratives).sort()) {
    const n = world.media.narratives[id]!;
    if (n.kind === kind && n.club === club && n.resolvedDay === undefined && subjectKey(n.subject) === key) return n;
  }
  return undefined;
}

/** Un hecho nuevo alimenta (o abre) una narrativa. */
export function feedNarrative(
  world: World, day: GameDay, kind: NarrativeKind, club: ClubId, subject: MediaSubject, fact: string, count?: number,
): Narrative {
  let n = findNarrative(world, kind, club, subject);
  if (n) {
    n.heat = round(Math.min(1, n.heat + NARRATIVE_FEED[kind] * 0.6), 3);
    if (!n.facts.includes(fact)) n.facts.push(fact);
    n.lastFedDay = day;
  } else {
    n = { id: nextId<string>(world, "nr", 6), kind, club, subject, heat: NARRATIVE_FEED[kind], facts: [fact], openedDay: day, lastFedDay: day };
    world.media.narratives[n.id] = n;
  }
  if (count !== undefined) n.count = count;
  return n;
}

/** Cierra la narrativa (una racha que se corta, una sequía que acaba). */
export function resolveNarrative(world: World, day: GameDay, kind: NarrativeKind, club: ClubId, subject: MediaSubject): void {
  const n = findNarrative(world, kind, club, subject);
  if (n) n.resolvedDay = day;
}

/** Narrativas abiertas de un club, de la más caliente a la más fría. */
export function activeNarratives(world: World, club: ClubId): Narrative[] {
  return Object.values(world.media.narratives)
    .filter((n) => n.club === club && n.resolvedDay === undefined)
    .sort((a, b) => b.heat - a.heat || a.id.localeCompare(b.id));
}

/** Enfriamiento diario; se cierran las que ya no interesan y se olvidan las viejas. */
export function decayNarratives(world: World, day: GameDay): void {
  for (const id of Object.keys(world.media.narratives).sort()) {
    const n = world.media.narratives[id]!;
    if (n.resolvedDay !== undefined) {
      if (day - n.resolvedDay > NARRATIVE_KEEP_DAYS) delete world.media.narratives[id];
      continue;
    }
    n.heat = round(n.heat * DECAY, 4);
    if (n.heat < NARRATIVE_CLOSE_HEAT) n.resolvedDay = day;
  }
}

const player = (id: string): MediaSubject => ({ kind: "player", id: id as PlayerId });

/** Club dirigido por un humano al que pertenece el jugador (si no, los medios no lo siguen). */
function managedClubOf(world: World, playerId: string): ClubId | undefined {
  const c = world.players[playerId]?.clubId;
  return c && world.dressing[c] ? c : undefined;
}

/**
 * Lee los eventos nuevos del mundo y alimenta las narrativas. Los eventos nunca se borran, así
 * que basta un cursor; cada hecho queda enlazado por su posición.
 */
export function readEvents(world: World, day: GameDay): void {
  const media = world.media;
  if (!managedClubs(world).length) {
    media.cursor = world.events.length;
    return;
  }
  for (let i = media.cursor; i < world.events.length; i++) {
    const e = world.events[i]!;
    const d = e.data;
    const fact = eventRef(i);
    const pid = typeof d.player === "string" ? d.player : undefined;
    const pclub = pid ? managedClubOf(world, pid) : undefined;
    switch (e.type) {
      case "manager.tookCharge": {
        const club = d.club as ClubId;
        if (world.dressing[club]) feedNarrative(world, day, "newManager", club, { kind: "manager", id: d.manager as ManagerId }, fact);
        break;
      }
      case "player.egoStep":
        if (!pclub || !pid) break;
        if (Number(d.step) >= 5) feedNarrative(world, day, "transferRequest", pclub, player(pid), fact);
        else if (Number(d.step) >= 3 && (d.channel === "social" || d.channel === "public")) feedNarrative(world, day, "egoPublic", pclub, player(pid), fact);
        break;
      case "manager.promiseBroken":
        if (pclub && pid) feedNarrative(world, day, "brokenPromise", pclub, player(pid), fact);
        break;
      case "player.injured": {
        const p = pid ? world.players[pid] : undefined;
        const status = p?.state.expectedStatus;
        if (pclub && pid && Number(d.days) >= INJURY_BLOW_DAYS && (status === "firstTeam" || status === "keyPlayer")) {
          feedNarrative(world, day, "injuryBlow", pclub, player(pid), fact);
        }
        break;
      }
      case "player.prodigy":
      case "player.breakthrough":
        if (pclub && pid) feedNarrative(world, day, e.type === "player.prodigy" ? "prodigy" : "breakthrough", pclub, player(pid), fact);
        break;
      case "player.consideringRetirement":
        if (pclub && pid) feedNarrative(world, day, "retirementRumour", pclub, player(pid), fact);
        break;
      case "manager.presentation":
      case "manager.teamMeeting": {
        const club = d.club as ClubId;
        const total = Number(d.agree) + Number(d.doubt) + Number(d.disagree);
        if (world.dressing[club] && total && Number(d.disagree) / total >= DIVIDED_SHARE) {
          feedNarrative(world, day, "dividedSquad", club, { kind: "club", id: club }, fact);
        }
        break;
      }
      case "manager.captain":
        if (pclub && pid) feedNarrative(world, day, "captaincy", pclub, player(pid), fact);
        break;
      case "media.controversy":
        if (world.dressing[d.club as ClubId]) feedNarrative(world, day, "refereeRow", d.club as ClubId, { kind: "referee", id: d.referee as StaffId }, fact);
        break;
      case "media.hypocrisy": {
        const club = d.club as ClubId;
        if (world.dressing[club]) feedNarrative(world, day, "hypocrisy", club, { kind: "manager", id: d.manager as ManagerId }, fact);
        break;
      }
      case "media.caseOpened": {
        const club = d.club as ClubId;
        if (world.dressing[club]) feedNarrative(world, day, "disciplinary", club, { kind: "club", id: club }, fact);
        break;
      }
    }
  }
  media.cursor = world.events.length;
}
