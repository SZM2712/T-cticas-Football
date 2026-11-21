// Ciclo de los medios (Fase 5): tras cada partido y al final de cada día. Solo hay actividad
// alrededor de clubes dirigidos por humanos; sin humanos, no cuesta nada.

import { DROUGHT_MATCHES, HOT_SCORER_GOALS, PROTEST_TENSION_MIN, PROTEST_WEIGHT, STREAK_MIN, VIOLENT_BASE, VIOLENT_TENSION } from "../config/media";
import { refereeFor } from "../match/lineup";
import type { MatchReport } from "../match/types";
import { dateOf } from "../time/calendar";
import type { Match, World } from "../types/domain";
import type { ClubId, GameDay, PlayerId } from "../types/ids";
import { worldRng } from "../world/rng";
import { dailyDiscipline, openCase, serveMatchSanctions } from "./discipline";
import { decayNarratives, feedNarrative, readEvents, resolveNarrative } from "./narratives";
import { dailyArticles, fansAfterMatch, playerPostsFromEvents } from "./posts";
import { createConference, dailyPress, schedulePreMatch } from "./press";
import { findControversies, monthlyRefereeCooling, refereeMemory } from "./referees";
import { pushEvent } from "./state";

const ATTACKERS = new Set(["ST", "LW", "RW", "AM"]);

/** Lee los eventos nuevos: alimenta narrativas y saca a la luz las publicaciones de jugadores. */
function processEvents(world: World, day: GameDay): void {
  const from = world.media.cursor;
  readEvents(world, day);
  playerPostsFromEvents(world, from, world.media.cursor);
}

/** Forma y rachas del club tras un partido oficial. */
function updateForm(world: World, m: Match, club: ClubId, day: GameDay): void {
  const home = m.home === club;
  const [gf, ga] = home ? [m.result!.home, m.result!.away] : [m.result!.away, m.result!.home];
  const r = gf > ga ? "W" : gf < ga ? "L" : "D";
  const form = ((world.media.form[club] ?? "") + r).slice(-10);
  world.media.form[club] = form;
  const run = form.length - form.replace(/(.)\1*$/, "").length;
  const subject = { kind: "club" as const, id: club };
  const fact = `match:${m.id}`;
  if (r === "W") resolveNarrative(world, day, "losingStreak", club, subject);
  if (r === "L") resolveNarrative(world, day, "winningStreak", club, subject);
  if (r === "D") for (const k of ["winningStreak", "losingStreak"] as const) resolveNarrative(world, day, k, club, subject);
  if (r !== "D" && run >= STREAK_MIN) feedNarrative(world, day, r === "W" ? "winningStreak" : "losingStreak", club, subject, fact, run);
}

/** Goles de los titulares: sequías de los atacantes y goleadores en racha. */
function updateScoring(world: World, m: Match, report: MatchReport, club: ClubId, day: GameDay): void {
  const side = m.home === club ? 0 : 1;
  for (const l of report.players) {
    if (l.side !== side || !l.started) continue;
    const list = [...(world.media.scoring[l.id] ?? []), l.goals].slice(-6);
    world.media.scoring[l.id] = list;
    const p = world.players[l.id];
    if (!p) continue;
    const subject = { kind: "player" as const, id: l.id as PlayerId };
    const fact = `match:${m.id}`;
    if (l.goals > 0) resolveNarrative(world, day, "goalDrought", club, subject);
    if (ATTACKERS.has(p.position) && list.length >= DROUGHT_MATCHES && list.slice(-DROUGHT_MATCHES).every((g) => g === 0)) {
      feedNarrative(world, day, "goalDrought", club, subject, fact, list.length);
    }
    const hot = list.slice(-4).reduce((s, g) => s + g, 0);
    if (l.goals > 0 && hot >= HOT_SCORER_GOALS) feedNarrative(world, day, "topScorer", club, subject, fact, hot);
  }
}

/** Acta del árbitro: con tensión, el acta es más dura (expedientes), pero el partido no cambia. */
function refereeReport(world: World, m: Match, report: MatchReport, club: ClubId, day: GameDay): void {
  const ref = m.referee;
  if (!ref) return;
  const side = m.home === club ? 0 : 1;
  const tension = refereeMemory(world, ref, club).tension;
  const rng = worldRng(world).fork(`media/acta/${m.id}/${club}`);
  for (const e of report.events) {
    if (e.type !== "red" || e.side !== side || !e.player || e.detail === "secondYellow") continue;
    if (!rng.chance(VIOLENT_BASE + VIOLENT_TENSION * tension)) continue;
    const p = world.players[e.player];
    const redIndex = world.events.findLastIndex((x) => x.type === "match.redCard" && x.data.player === e.player && x.data.match === m.id);
    const acta = pushEvent(world, day, "media.refereeReport", { match: m.id, club, referee: ref, player: e.player, incident: "violentConduct" });
    openCase(world, day, {
      club, kind: "violentConduct", subject: { kind: "player", id: e.player as PlayerId }, referee: ref, match: m.id, competition: m.competitionId,
      facts: [acta, ...(redIndex >= 0 ? [`ev:${redIndex}`] : [])], gravity: 0.35 + 0.3 * (p?.psych.temperament ?? 0.5) + 0.2 * tension,
    });
  }
  if (tension >= PROTEST_TENSION_MIN && rng.chance(tension * PROTEST_WEIGHT)) {
    const acta = pushEvent(world, day, "media.refereeReport", { match: m.id, club, referee: ref, incident: "protests" });
    openCase(world, day, {
      club, kind: "protests", subject: { kind: "club", id: club }, referee: ref, match: m.id, competition: m.competitionId,
      facts: [acta], gravity: 0.3 + 0.5 * tension,
    });
  }
}

/** Consecuencias mediáticas de un partido con algún club dirigido por un humano. */
export function afterMatchMedia(world: World, m: Match, report: MatchReport, engine: "full" | "quick", official: boolean): void {
  const clubs = ([m.home, m.away] as string[]).filter((c) => world.dressing[c]) as ClubId[];
  if (!clubs.length || !official) return;
  const day = m.day as GameDay;
  serveMatchSanctions(world, m.home as ClubId, m.away as ClubId);
  const ref = engine === "full" ? refereeFor(world, m) : undefined;
  if (ref) m.referee = ref;
  // Polémicas: con su propio azar, después del partido (no cambian el resultado).
  const controversies = engine === "full" ? findControversies(report, worldRng(world).fork(`media/var/${m.id}`)) : [];
  if (controversies.length) world.media.controversies[m.id] = controversies;
  controversies.forEach((c, i) => {
    const harmedClub = (c.harmed === 0 ? m.home : m.away) as ClubId;
    if (!world.dressing[harmedClub] || !ref) return;
    if (!c.correct) refereeMemory(world, ref, harmedClub).harmed++;
    if (!c.correct || c.clarity === "marginal") {
      pushEvent(world, day, "media.controversy", { club: harmedClub, referee: ref, match: m.id, index: i, kind: c.kind });
    }
  });
  for (const club of clubs) {
    updateForm(world, m, club, day);
    updateScoring(world, m, report, club, day);
    if (engine === "full") refereeReport(world, m, report, club, day);
    fansAfterMatch(world, m, club, controversies, day);
  }
  // Las narrativas del partido ya cuentan en la rueda de prensa de después.
  processEvents(world, day);
  for (const club of clubs) createConference(world, day, club, m, "postMatch");
}

/** Fin del día: ruedas de prensa vencidas, expedientes, narrativas, artículos y la víspera de partido. */
export function dailyMedia(world: World, day: GameDay): void {
  if (!Object.keys(world.dressing).length) {
    world.media.cursor = world.events.length;
    return;
  }
  dailyPress(world, day);
  dailyDiscipline(world, day);
  processEvents(world, day);
  schedulePreMatch(world, day);
  dailyArticles(world, day);
  decayNarratives(world, day);
  if (dateOf(day).d === 1) monthlyRefereeCooling(world);
}
