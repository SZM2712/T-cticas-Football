// Comité de disciplina (DISEÑO §11.4): acta → expediente → alegaciones → sanción → recurso.
// Toda sanción enlaza los hechos que la causaron; sin hechos no hay expediente.

import {
  ALLEGATION_DAYS, ALLEGATION_FACTOR, APPEAL_ANNUL, APPEAL_DAYS, APPEAL_REDUCE, CLOSURE_REVENUE_SHARE, CONTEST_DISMISS_WITH_EVIDENCE,
  FINE_MIN, FINE_PER_REVENUE, TOUCHLINE_GRAVITY,
} from "../config/media";
import { managerOf, notify } from "../social/store";
import type { World } from "../types/domain";
import type { ClubId, CompetitionId, GameDay, MatchId, PlayerId, StaffId } from "../types/ids";
import type { Allegation, CaseKind, DisciplinaryCase, MediaSubject, Sanction } from "../types/media";
import { clamp, round } from "../util/math";
import { nextId } from "../world/ids";
import { worldRng } from "../world/rng";
import { pushEvent } from "./state";

export interface NewCase {
  club: ClubId;
  kind: CaseKind;
  subject: MediaSubject;
  referee?: StaffId;
  match?: MatchId;
  competition?: CompetitionId;
  facts: string[];
  gravity: number;
}

/** Abre un expediente (si no hay hechos enlazados, no hay expediente). */
export function openCase(world: World, day: GameDay, input: NewCase): DisciplinaryCase | undefined {
  if (!input.facts.length) return undefined;
  const c: DisciplinaryCase = {
    id: nextId<string>(world, "dc", 5), club: input.club, kind: input.kind, subject: input.subject, facts: [...input.facts],
    gravity: round(clamp(input.gravity, 0, 1), 3), openedDay: day, deadline: (day + ALLEGATION_DAYS) as GameDay, status: "allegations",
  };
  if (input.referee) c.referee = input.referee;
  if (input.match) c.match = input.match;
  if (input.competition) c.competition = input.competition;
  world.media.cases[c.id] = c;
  pushEvent(world, day, "media.caseOpened", { club: c.club, case: c.id, kind: c.kind });
  if (world.dressing[c.club]) notify(world, day, c.club, "caseOpened", { ref: c.id, ...(c.subject.kind === "player" ? { player: c.subject.id } : {}) });
  return c;
}

/** Alegaciones del club dentro de plazo. */
export function allege(world: World, c: DisciplinaryCase, allegation: Allegation): string | null {
  if (c.status !== "allegations") return "error.caseClosed";
  if (world.meta.today > c.deadline) return "error.deadlinePassed";
  c.allegation = allegation;
  if (allegation === "apologize" && c.referee) {
    const key = `${c.referee}|${c.club}`;
    const m = world.media.referees[key];
    if (m) m.tension = round(Math.max(0, m.tension - 0.15), 3);
  }
  return null;
}

/** Pruebas a favor: la decisión arbitral que se criticó fue un error (lo muestran las imágenes). */
function hasEvidence(world: World, c: DisciplinaryCase): boolean {
  return c.facts.some((f) => {
    if (!f.startsWith("ctrv:")) return false;
    const [, match, idx] = f.split(":");
    return world.media.controversies[match!]?.[Number(idx)]?.correct === false;
  });
}

function fineFor(world: World, club: ClubId, severity: number): number {
  const revenue = world.clubs[club]?.finances.revenue ?? 10;
  return Math.max(FINE_MIN, Math.round((severity * FINE_PER_REVENUE * revenue) / 100) * 100);
}

/** Sanciones según el tipo de expediente y su gravedad ya ajustada. */
function sanctionsFor(world: World, c: DisciplinaryCase, severity: number): Sanction[] {
  const fine = (): Sanction => ({ kind: "fine", amount: fineFor(world, c.club, severity) });
  switch (c.kind) {
    case "refereeCriticism":
      return severity >= TOUCHLINE_GRAVITY ? [fine(), { kind: "touchlineBan", matches: severity >= 0.75 ? 2 : 1 }] : [fine()];
    case "violentConduct":
      return [{ kind: "playerBan", matches: 1 + Math.round(severity * 2) }];
    case "protests":
      return severity > 0.7 ? [fine(), { kind: "stadiumClosure", matches: 1 }] : [fine()];
    case "socialPost":
      return severity > 0.6 ? [fine(), { kind: "playerBan", matches: 1 }] : [fine()];
  }
}

/** Competición en la que se cumple una sanción de partidos: la del expediente o la liga del club. */
function competitionOf(world: World, c: DisciplinaryCase): CompetitionId | undefined {
  if (c.competition) return c.competition;
  const league = world.clubs[c.club]?.leagueId;
  return (league ? world.leagues[league]?.currentCompetition : undefined) ?? undefined;
}

/** Aplica (factor 1) o revierte (factor −1, −0,5) las sanciones. */
function applySanctions(world: World, c: DisciplinaryCase, sanctions: Sanction[], factor: number): void {
  const club = world.clubs[c.club];
  for (const s of sanctions) {
    if (s.kind === "fine" && club) club.finances.balance = Math.round(club.finances.balance - factor * (s.amount ?? 0));
    const matches = Math.round(factor * (s.matches ?? 0));
    if (!matches) continue;
    if (s.kind === "touchlineBan") {
      const mgr = c.subject.kind === "manager" ? c.subject.id : managerOf(world, c.club)?.id;
      if (mgr) world.media.touchlineBans[mgr] = Math.max(0, (world.media.touchlineBans[mgr] ?? 0) + matches);
    } else if (s.kind === "stadiumClosure") {
      world.media.stadiumClosures[c.club] = Math.max(0, (world.media.stadiumClosures[c.club] ?? 0) + matches);
    } else if (s.kind === "playerBan" && c.subject.kind === "player") {
      const p = world.players[c.subject.id as PlayerId];
      const comp = competitionOf(world, c);
      if (!p || !comp) continue;
      const existing = p.suspensions.find((x) => x.competitionId === comp);
      if (existing) existing.matches = Math.max(0, existing.matches + matches);
      else if (matches > 0) p.suspensions.push({ competitionId: comp, matches });
      p.suspensions = p.suspensions.filter((x) => x.matches > 0);
    }
  }
}

/** Resuelve un expediente al vencer el plazo de alegaciones. */
function resolveCase(world: World, c: DisciplinaryCase, day: GameDay): void {
  const rng = worldRng(world).fork(`media/case/${c.id}/resolve`);
  if (c.allegation === "contest" && hasEvidence(world, c) && rng.chance(CONTEST_DISMISS_WITH_EVIDENCE)) {
    c.status = "dismissed";
  } else {
    const severity = clamp(c.gravity * ALLEGATION_FACTOR[c.allegation ?? "none"], 0, 1);
    c.sanctions = sanctionsFor(world, c, severity);
    applySanctions(world, c, c.sanctions, 1);
    c.status = "sanctioned";
    c.deadline = (day + APPEAL_DAYS) as GameDay;
  }
  pushEvent(world, day, "media.caseResolved", { club: c.club, case: c.id, status: c.status });
  if (world.dressing[c.club]) notify(world, day, c.club, "caseResolved", { ref: c.id });
}

/** Recurso contra la sanción, dentro de plazo. Se decide en el acto. */
export function appeal(world: World, c: DisciplinaryCase): string | null {
  if (c.status !== "sanctioned" || !c.sanctions) return "error.caseClosed";
  const day = world.meta.today;
  if (day > c.deadline) return "error.deadlinePassed";
  const rng = worldRng(world).fork(`media/case/${c.id}/appeal`);
  const roll = rng.float();
  const annul = hasEvidence(world, c) ? APPEAL_ANNUL.evidence : APPEAL_ANNUL.none;
  const outcome = roll < annul ? "annulled" : roll < annul + APPEAL_REDUCE ? "reduced" : "upheld";
  if (outcome === "annulled") applySanctions(world, c, c.sanctions, -1);
  else if (outcome === "reduced") applySanctions(world, c, c.sanctions, -0.5);
  c.appeal = { day, outcome };
  c.status = "closed";
  pushEvent(world, day, "media.appeal", { club: c.club, case: c.id, outcome });
  return null;
}

/** Plazos que vencen hoy: se resuelven los expedientes y se cierran los recursos no presentados. */
export function dailyDiscipline(world: World, day: GameDay): void {
  for (const id of Object.keys(world.media.cases).sort()) {
    const c = world.media.cases[id]!;
    if (day <= c.deadline) continue;
    if (c.status === "allegations") resolveCase(world, c, day);
    else if (c.status === "sanctioned") c.status = "closed";
  }
}

/** Cumplimiento de sanciones por partido: banquillo y estadio. Devuelve si el estadio estaba cerrado. */
export function serveMatchSanctions(world: World, home: ClubId, away: ClubId): boolean {
  for (const club of [home, away]) {
    const mgr = managerOf(world, club);
    if (mgr && (world.media.touchlineBans[mgr.id] ?? 0) > 0) world.media.touchlineBans[mgr.id]! -= 1;
  }
  const closed = (world.media.stadiumClosures[home] ?? 0) > 0;
  if (closed) {
    world.media.stadiumClosures[home]! -= 1;
    const club = world.clubs[home];
    if (club) {
      club.finances.balance = Math.round(club.finances.balance - club.finances.revenue * 1e6 * CLOSURE_REVENUE_SHARE);
      for (const seg of ["members", "ultras"] as const) club.fanBase[seg].mood = round(clamp(club.fanBase[seg].mood - 0.03, -1, 1), 3);
    }
  }
  return closed;
}
