// Ruedas de prensa (DISEÑO §6): las preguntas salen de las narrativas más calientes del club y
// del partido; una pregunta sobre el mismo tema y sujeto no se repite en la temporada salvo que
// haya un hecho nuevo. La respuesta (intención + tono) tiene consecuencias: recuerdos de los
// aludidos, promesas públicas, tensión con los árbitros, expedientes y contradicciones.

import {
  ASSISTANT_PREFERENCE, CRITICISM_GRAVITY, CRITICISM_TENSION, ACCEPT_TENSION, COLLECTIVE_STATEMENT_TENSION, DEFAULT_DIRECTIVES, FAN_MOOD,
  HYPOCRISY_DAYS, POINTED_AGGRESSION, POINTED_RELATION, QUESTION_MIN_HEAT, QUESTIONS_PER_CONFERENCE, RELATION_EVASIVE, RELATION_TONE,
  STATEMENTS_KEPT,
} from "../config/media";
import { PROMISE_DAYS } from "../config/social";
import type { Rng } from "../rng/rng";
import { makeCommitment } from "../social/commitments";
import { addTrust, managerOf, managerRef, notify, remember } from "../social/store";
import { minutesDemand } from "../social/talk";
import type { Match, World } from "../types/domain";
import type { ClubId, GameDay, PlayerId, StaffId } from "../types/ids";
import type {
  AnswerIntent, AnswerTone, MediaSubject, Narrative, NarrativeKind, PressConference, PressDirectives, PressQuestion,
} from "../types/media";
import type { Manager } from "../types/social";
import { clamp, round } from "../util/math";
import { nextId } from "../world/ids";
import { worldRng } from "../world/rng";
import { openCase } from "./discipline";
import { journalistsOf } from "./journalists";
import { activeNarratives } from "./narratives";
import { addTension, refereeMemory } from "./referees";
import { addRelation, publish, pushEvent, reachOf, relationOf, subjectKey } from "./state";

/** Respuestas posibles a cada tipo de pregunta. */
const NARRATIVE_INTENTS: Record<NarrativeKind, AnswerIntent[]> = {
  newManager: ["ambitious", "humble", "noComment"],
  winningStreak: ["humble", "ambitious", "calm"],
  losingStreak: ["takeBlame", "blamePlayers", "calm", "promiseImprovement"],
  goalDrought: ["backPlayer", "criticizePlayer", "noComment"],
  brokenPromise: ["takeBlame", "promisePlayingTime", "criticizePlayer", "noComment"],
  egoPublic: ["backPlayer", "criticizePlayer", "noComment"],
  transferRequest: ["deny", "confirm", "noComment"],
  injuryBlow: ["calm", "backPlayer"],
  prodigy: ["praisePlayer", "calm"],
  breakthrough: ["praisePlayer", "calm"],
  retirementRumour: ["backPlayer", "noComment"],
  refereeRow: ["criticizeReferee", "acceptDecision", "noComment"],
  dividedSquad: ["calm", "deny", "takeBlame"],
  hypocrisy: ["deny", "takeBlame", "noComment"],
  disciplinary: ["acceptDecision", "criticizeReferee", "noComment"],
  topScorer: ["praisePlayer", "humble"],
  captaincy: ["backPlayer", "noComment"],
};

/** Las intenciones que una directriz prohíbe al asistente. */
export function forbiddenBy(d: PressDirectives): Set<AnswerIntent> {
  const out = new Set<AnswerIntent>();
  if (!d.refereeCriticism) out.add("criticizeReferee");
  if (!d.criticizePlayers) for (const i of ["criticizePlayer", "blamePlayers"] as const) out.add(i);
  if (!d.promises) for (const i of ["promisePlayingTime", "promiseImprovement"] as const) out.add(i);
  return out;
}

export function directivesOf(world: World, manager: string): PressDirectives {
  return world.media.directives[manager] ?? { ...DEFAULT_DIRECTIVES };
}

/** Clave anti-repetición: tema (tipo de narrativa) + sujeto + temporada. */
function askedKey(world: World, kind: string, subject: MediaSubject): string {
  return `${kind}|${subjectKey(subject)}|${world.meta.season}`;
}

/** Se puede preguntar si nunca se preguntó esta temporada o si hay un hecho nuevo desde entonces. */
export function canAsk(world: World, n: Narrative): boolean {
  const last = world.media.asked[askedKey(world, n.kind, n.subject)];
  return last === undefined || n.lastFedDay > last;
}

/** El partido del que se habla y lo que pasó en él (para las preguntas del partido). */
function matchIntents(world: World, m: Match, club: ClubId, kind: PressConference["kind"]): { templateId: string; intents: AnswerIntent[] } {
  if (kind === "preMatch" || !m.result) return { templateId: "match.preview", intents: ["ambitious", "humble", "calm"] };
  const home = m.home === club;
  const [gf, ga] = home ? [m.result.home, m.result.away] : [m.result.away, m.result.home];
  const side = home ? 0 : 1;
  const harmed = (world.media.controversies[m.id] ?? []).some((c) => c.harmed === side);
  if (gf > ga) return { templateId: "match.win", intents: ["humble", "ambitious", "calm"] };
  if (gf === ga) return { templateId: "match.draw", intents: harmed ? ["calm", "humble", "criticizeReferee"] : ["calm", "humble"] };
  return { templateId: "match.loss", intents: harmed ? ["takeBlame", "blamePlayers", "calm", "criticizeReferee"] : ["takeBlame", "blamePlayers", "calm"] };
}

/** Convoca una rueda de prensa del club dirigido por un humano. */
export function createConference(world: World, day: GameDay, club: ClubId, m: Match, kind: PressConference["kind"]): PressConference | undefined {
  const mgr = managerOf(world, club);
  if (!mgr) return undefined;
  const rng = worldRng(world).fork(`media/press/${m.id}/${kind}/${club}`);
  const journalists = journalistsOf(world, world.clubs[club]!.nation);
  if (!journalists.length) return undefined;
  const pool = [...journalists];
  const pickJournalist = (r: Rng) => (pool.length > 1 ? pool.splice(r.int(0, pool.length - 1), 1)[0]! : pool[0]!);
  const questions: PressQuestion[] = [];
  const ask = (templateBase: string, subject: MediaSubject, intents: AnswerIntent[], narrative?: string): void => {
    const j = pickJournalist(rng);
    const pointed = j.aggression > POINTED_AGGRESSION || relationOf(world, j.id, mgr.id) < POINTED_RELATION;
    const q: PressQuestion = { journalist: j.id, templateId: `${templateBase}.${pointed ? "b" : "a"}`, subject, intents, pointed };
    if (narrative) q.narrative = narrative;
    questions.push(q);
  };
  const mi = matchIntents(world, m, club, kind);
  ask(mi.templateId, { kind: "match", id: m.id }, mi.intents);
  for (const n of activeNarratives(world, club)) {
    if (questions.length >= QUESTIONS_PER_CONFERENCE) break;
    if (n.heat < QUESTION_MIN_HEAT || !canAsk(world, n)) continue;
    // Dos preguntas sobre el mismo sujeto en la misma rueda sobran.
    if (questions.some((q) => subjectKey(q.subject) === subjectKey(n.subject))) continue;
    ask(n.kind, n.subject, NARRATIVE_INTENTS[n.kind], n.id);
    world.media.asked[askedKey(world, n.kind, n.subject)] = day;
  }
  const conf: PressConference = {
    id: nextId<string>(world, "pc", 6), club, manager: mgr.id, kind, match: m.id, day, deadline: day, questions, status: "pending",
  };
  world.media.conferences[conf.id] = conf;
  notify(world, day, club, "pressConference", { ref: conf.id });
  return conf;
}

// ── Declaraciones y contradicciones ─────────────────────────────────────────

/** Guarda lo dicho en público; si contradice algo reciente sobre lo mismo, abre la narrativa de hipocresía. */
export function addStatement(world: World, day: GameDay, mgr: Manager, club: ClubId, topic: string, stance: 1 | -1, source: string): void {
  const st = world.media.statements;
  const prev = [...st].reverse().find((s) => s.manager === mgr.id && s.topic === topic && day - s.day <= HYPOCRISY_DAYS);
  st.push({ day, manager: mgr.id, topic, stance, source });
  if (st.length > STATEMENTS_KEPT) st.splice(0, st.length - STATEMENTS_KEPT);
  if (prev && prev.stance !== stance) {
    pushEvent(world, day, "media.hypocrisy", { manager: mgr.id, club, topic, before: prev.source, now: source });
    for (const j of journalistsOf(world, world.clubs[club]!.nation)) addRelation(world, j.id, mgr.id, -0.03);
  }
}

// ── Efectos de una respuesta ────────────────────────────────────────────────

export interface Saying {
  club: ClubId;
  mgr: Manager;
  intent: AnswerIntent;
  tone: AnswerTone;
  subject: MediaSubject;
  /** Referencia a lo dicho ("press:pc_000012:1", "post:ps_0000123"). */
  source: string;
  /** Partido del que se habla (para el árbitro y las polémicas). */
  match?: Match;
  day: GameDay;
}

/** Árbitro aludido: el sujeto si es un árbitro, o el del partido del que se habla. */
function refereeOf(s: Saying): StaffId | undefined {
  if (s.subject.kind === "referee") return s.subject.id;
  return s.match?.referee;
}

/** Hechos de las polémicas de los partidos de ese árbitro con el club (para el expediente). */
function controversyFacts(world: World, club: ClubId, referee: StaffId): string[] {
  const out: string[] = [];
  for (const mid of Object.keys(world.media.controversies).sort()) {
    const m = world.matches[mid];
    if (!m || m.referee !== referee || (m.home !== club && m.away !== club)) continue;
    world.media.controversies[mid]!.forEach((_, i) => out.push(`ctrv:${mid}:${i}`));
  }
  return out;
}

/**
 * Consecuencias de algo que el mánager dice en público (rueda de prensa o redes). Devuelve la
 * clave de la reacción para la UI.
 */
export function applySaying(world: World, s: Saying): string {
  const { club, mgr, intent, tone, subject, day, source } = s;
  const me = [managerRef(mgr.id)];
  const p = subject.kind === "player" ? world.players[subject.id] : undefined;
  const squad = world.clubs[club]!.squad.map((id) => world.players[id]!).filter(Boolean);
  const mood = (pl: { state: { morale: number } }, d: number) => (pl.state.morale = round(clamp(pl.state.morale + d, -1, 1), 3));
  const fans = world.clubs[club]!.fanBase;
  switch (intent) {
    case "praisePlayer":
    case "backPlayer":
      if (p) {
        remember(world, day, { owner: p.id, about: me, kind: "publicPraise", valence: intent === "praisePlayer" ? 0.45 : 0.35, intensity: 0.4, publicness: "public", source });
        mood(p, 0.04);
        addStatement(world, day, mgr, club, `player:${p.id}`, 1, source);
      }
      break;
    case "criticizePlayer":
      if (p) {
        remember(world, day, { owner: p.id, about: me, kind: "publicCriticism", valence: -0.6, intensity: 0.6, publicness: "public", source });
        addTrust(world, p.id, mgr.id, -0.08, day);
        mood(p, -0.06);
        addStatement(world, day, mgr, club, `player:${p.id}`, -1, source);
      }
      break;
    case "blamePlayers": {
      const dr = world.dressing[club];
      for (const pl of squad) {
        if (dr?.recent[pl.id]?.at(-1) !== 1) continue;
        addTrust(world, pl.id, mgr.id, -0.03, day);
        remember(world, day, { owner: pl.id, about: me, kind: "publicCriticism", valence: -0.3, intensity: 0.3, publicness: "public", source });
      }
      break;
    }
    case "takeBlame":
      for (const pl of squad) addTrust(world, pl.id, mgr.id, 0.015, day);
      break;
    case "humble":
    case "ambitious":
      addStatement(world, day, mgr, club, `ambition:${club}`, intent === "ambitious" ? 1 : -1, source);
      if (intent === "ambitious") for (const seg of ["ultras", "members"] as const) fans[seg].mood = round(clamp(fans[seg].mood + 0.02, -1, 1), 3);
      break;
    case "promiseImprovement":
      addStatement(world, day, mgr, club, `improve:${club}`, 1, source);
      break;
    case "promisePlayingTime":
      if (p) {
        makeCommitment(world, day, {
          madeBy: mgr.id, clubId: club, madeTo: p.id as PlayerId, type: "playingTime", params: { minStartsPct: Math.max(0.5, minutesDemand(p)), matches: 0, starts: 0 },
          days: PROMISE_DAYS, witnesses: "public", origin: { kind: "press", refId: source },
        });
        addStatement(world, day, mgr, club, `player:${p.id}`, 1, source);
      }
      break;
    case "criticizeReferee": {
      const ref = refereeOf(s);
      if (!ref) break;
      const before = refereeMemory(world, ref, club).tension;
      const mem = addTension(world, ref, club, CRITICISM_TENSION[tone]);
      mem.criticisms++;
      fans.ultras.mood = round(clamp(fans.ultras.mood + FAN_MOOD.refCriticismUltras, -1, 1), 3);
      addStatement(world, day, mgr, club, `referee:${ref}`, -1, source);
      // El colectivo arbitral responde con un comunicado si la tensión se dispara.
      if (before < COLLECTIVE_STATEMENT_TENSION && mem.tension >= COLLECTIVE_STATEMENT_TENSION) {
        const nation = world.staff[ref]?.nationality ?? world.clubs[club]!.nation;
        publish(world, {
          day, platform: "newspaper", author: { kind: "refereeCollective", nation }, key: "post.refereeCollective.statement",
          params: {}, subjects: [{ kind: "referee", id: ref }, { kind: "manager", id: mgr.id }], sentiment: -1, reach: "medium", club,
        });
        notify(world, day, club, "refereeStatement");
      }
      // Criticar con firmeza o de malas maneras abre expediente; con calma es una opinión.
      if (CRITICISM_GRAVITY[tone] > 0) {
        openCase(world, day, {
          club, kind: "refereeCriticism", subject: { kind: "manager", id: mgr.id }, referee: ref,
          ...(s.match ? { match: s.match.id, competition: s.match.competitionId } : {}),
          facts: [source, ...controversyFacts(world, club, ref)], gravity: CRITICISM_GRAVITY[tone] + 0.2 * before,
        });
      }
      break;
    }
    case "acceptDecision": {
      const ref = refereeOf(s);
      if (ref) {
        addTension(world, ref, club, ACCEPT_TENSION);
        addStatement(world, day, mgr, club, `referee:${ref}`, 1, source);
      }
      break;
    }
    case "deny":
    case "confirm":
      if (p && subject.kind === "player") {
        addStatement(world, day, mgr, club, `transfer:${p.id}`, intent === "confirm" ? 1 : -1, source);
        if (p.transferRequest !== undefined) mood(p, intent === "confirm" ? 0.06 : -0.05);
      }
      break;
    case "calm":
    case "noComment":
      break;
  }
  return `press.r.${intent}`;
}

/** Sentido de la noticia que sale de una respuesta (para su protagonista). */
const INTENT_SENTIMENT: Record<AnswerIntent, -1 | 0 | 1> = {
  praisePlayer: 1, backPlayer: 1, criticizePlayer: -1, blamePlayers: -1, takeBlame: 0, calm: 0, promiseImprovement: 0,
  promisePlayingTime: 1, criticizeReferee: -1, acceptDecision: 0, deny: 0, confirm: 0, noComment: 0, humble: 0, ambitious: 1,
};
const SPICY: ReadonlySet<AnswerIntent> = new Set(["criticizeReferee", "criticizePlayer", "blamePlayers", "confirm"]);

/** Responde una pregunta (el mánager o su asistente). */
export function answerQuestion(world: World, conf: PressConference, index: number, intent: AnswerIntent, tone: AnswerTone, by: "manager" | "assistant"): string {
  const q = conf.questions[index]!;
  const mgr = world.managers[conf.manager]!;
  const day = world.meta.today;
  const source = `press:${conf.id}:${index}`;
  const reaction = applySaying(world, { club: conf.club, mgr, intent, tone, subject: q.subject, source, day, ...(world.matches[conf.match] ? { match: world.matches[conf.match]! } : {}) });
  // El periodista recuerda el tono y si le esquivaste la pregunta.
  addRelation(world, q.journalist, mgr.id, RELATION_TONE[tone] + (intent === "noComment" ? RELATION_EVASIVE * (q.pointed ? 2 : 1) : 0));
  q.answer = { intent, tone, by, reaction };
  // Lo dicho sale publicado: más difusión si es polémico o el tono es duro.
  const j = world.media.journalists[q.journalist];
  const score = (j?.reach ?? 0.4) * 0.5 + (SPICY.has(intent) ? 0.35 : 0) + (tone === "combative" ? 0.25 : 0);
  publish(world, {
    day, platform: j?.outlet === "radio" || j?.outlet === "tv" ? "radioTv" : "newspaper", author: { kind: "journalist", id: q.journalist },
    key: `post.press.${intent}`, params: {}, subjects: [q.subject, { kind: "manager", id: mgr.id }], sentiment: INTENT_SENTIMENT[intent],
    reach: reachOf(score), club: conf.club,
  });
  return reaction;
}

/** Intención que elige el asistente para una pregunta: la más prudente que permiten tus directrices. */
export function assistantIntent(q: PressQuestion, d: PressDirectives): AnswerIntent {
  const banned = forbiddenBy(d);
  const allowed = q.intents.filter((i) => !banned.has(i));
  const pick = ASSISTANT_PREFERENCE.find((i) => allowed.includes(i));
  return pick ?? allowed[0] ?? "noComment";
}

/** El asistente responde lo que quede pendiente con tus directrices. */
export function delegateConference(world: World, conf: PressConference): void {
  const d = directivesOf(world, conf.manager);
  conf.questions.forEach((q, i) => {
    if (!q.answer) answerQuestion(world, conf, i, assistantIntent(q, d), d.tone, "assistant");
  });
  conf.status = conf.status === "pending" ? "delegated" : conf.status;
}

/** Las ruedas de prensa sin responder al acabar su plazo las atiende el asistente. */
export function dailyPress(world: World, day: GameDay): void {
  for (const id of Object.keys(world.media.conferences).sort()) {
    const c = world.media.conferences[id]!;
    if (c.status === "pending" && day > c.deadline) delegateConference(world, c);
  }
  // Se guardan solo las ruedas de prensa recientes.
  for (const id of Object.keys(world.media.conferences).sort()) {
    const c = world.media.conferences[id]!;
    if (c.status !== "pending" && day - c.day > 60) delete world.media.conferences[id];
  }
}

/** Rueda de prensa previa: la víspera de cada partido oficial de un club dirigido por un humano. */
export function schedulePreMatch(world: World, day: GameDay): void {
  const clubs = new Set(Object.keys(world.dressing));
  if (!clubs.size) return;
  const tomorrow = day + 1;
  for (const id of Object.keys(world.matches).sort()) {
    const m = world.matches[id]!;
    if (m.day !== tomorrow || m.result) continue;
    if (world.competitions[m.competitionId]?.kind === "friendly") continue;
    for (const club of [m.home, m.away]) {
      if (!clubs.has(club)) continue;
      const exists = Object.values(world.media.conferences).some((c) => c.match === m.id && c.kind === "preMatch" && c.club === club);
      if (!exists) createConference(world, day, club as ClubId, m, "preMatch");
    }
  }
}
