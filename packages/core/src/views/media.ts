// Vistas de medios, redes y disciplina (Fase 5). Solo claves, nombres y valores cualitativos:
// nunca un rasgo oculto ni un número interno (calor, tensión, gravedad) en pantalla (regla 6).

import { canAsk, directivesOf } from "../media/press";
import type { World } from "../types/domain";
import type { ClubId } from "../types/ids";
import type {
  AnswerIntent, AnswerTone, CaseKind, DisciplinaryCase, MediaSubject, Narrative, NarrativeKind, OutletKind, Platform, PostAuthor, PressDirectives,
  Reach, Sanction,
} from "../types/media";
import { displayName } from "./player";

export interface JournalistRef {
  id: string;
  name: string;
  outlet: OutletKind;
  city: string;
  /** Cómo te trata: bien, normal o mal (sin números). */
  relation: "good" | "neutral" | "bad";
}

export interface SubjectView {
  kind: MediaSubject["kind"];
  id: string;
  name: string;
}

export interface QuestionView {
  index: number;
  journalist: JournalistRef;
  templateId: string;
  pointed: boolean;
  subject: SubjectView;
  /** Parámetros visibles de la pregunta (nombres, rival, recuentos). */
  params: Record<string, string | number>;
  intents: AnswerIntent[];
  answer?: { intent: AnswerIntent; tone: AnswerTone; by: "manager" | "assistant"; reaction: string };
}

export interface ConferenceView {
  id: string;
  kind: "preMatch" | "postMatch";
  day: number;
  deadline: number;
  status: "pending" | "answered" | "delegated";
  opponent: string;
  questions: QuestionView[];
}

export interface PressView {
  pending: ConferenceView[];
  recent: ConferenceView[];
  directives: PressDirectives;
}

export interface NarrativeView {
  id: string;
  kind: NarrativeKind;
  subject: SubjectView;
  /** Lo caliente que está el tema, en palabras. */
  heat: "hot" | "warm" | "cool";
  count?: number;
  facts: number;
  /** Te pueden volver a preguntar por ella (hay hechos nuevos desde la última vez). */
  askable: boolean;
}

export interface PostView {
  id: string;
  day: number;
  platform: Platform;
  author: { kind: PostAuthor["kind"]; name: string; outlet?: OutletKind; segment?: string };
  key: string;
  params: Record<string, string | number>;
  subjects: SubjectView[];
  sentiment: -1 | 0 | 1;
  reach: Reach;
}

export interface FactView {
  /** Clave de texto del hecho y sus parámetros. */
  key: string;
  params: Record<string, string | number>;
  day?: number;
}

export interface CaseView {
  id: string;
  kind: CaseKind;
  subject: SubjectView;
  referee?: string;
  openedDay: number;
  deadline: number;
  status: DisciplinaryCase["status"];
  allegation?: DisciplinaryCase["allegation"];
  sanctions: Sanction[];
  appeal?: DisciplinaryCase["appeal"];
  facts: FactView[];
}

export interface DisciplineView {
  cases: CaseView[];
  touchlineBan: number;
  stadiumClosure: number;
  /** Relación con los árbitros que te han pitado: tensa o normal (sin números). */
  referees: { id: string; name: string; mood: "tense" | "strained" | "normal"; criticisms: number }[];
}

export interface FansView {
  segments: { segment: string; mood: "furious" | "unhappy" | "calm" | "happy" | "euphoric"; size: "small" | "medium" | "large" }[];
  form: string;
}

function staffName(world: World, id: string): string {
  const s = world.staff[id];
  return s ? `${s.firstName} ${s.lastName}` : id;
}

export function subjectView(world: World, s: MediaSubject, club?: ClubId): SubjectView {
  switch (s.kind) {
    case "club":
      return { kind: s.kind, id: s.id, name: world.clubs[s.id]?.name ?? s.id };
    case "player":
      return { kind: s.kind, id: s.id, name: world.players[s.id] ? displayName(world.players[s.id]!) : s.id };
    case "manager":
      return { kind: s.kind, id: s.id, name: world.managers[s.id]?.name ?? s.id };
    case "referee":
      return { kind: s.kind, id: s.id, name: staffName(world, s.id) };
    case "match": {
      const m = world.matches[s.id];
      const other = m ? (m.home === club ? m.away : m.home) : "";
      return { kind: s.kind, id: s.id, name: world.clubs[other]?.name ?? other };
    }
  }
}

function journalistRef(world: World, id: string, manager: string): JournalistRef {
  const j = world.media.journalists[id];
  const rel = world.media.relations[`${id}|${manager}`] ?? 0;
  return {
    id, name: j ? `${j.firstName} ${j.lastName}` : id, outlet: j?.outlet ?? "newspaper", city: j?.city ?? "",
    relation: rel > 0.2 ? "good" : rel < -0.2 ? "bad" : "neutral",
  };
}

function conferenceView(world: World, id: string): ConferenceView {
  const c = world.media.conferences[id]!;
  const m = world.matches[c.match];
  const opponent = m ? (world.clubs[m.home === c.club ? m.away : m.home]?.name ?? "") : "";
  return {
    id, kind: c.kind, day: c.day, deadline: c.deadline, status: c.status, opponent,
    questions: c.questions.map((q, index) => {
      const n = q.narrative ? world.media.narratives[q.narrative] : undefined;
      const subject = subjectView(world, q.subject, c.club);
      const params: Record<string, string | number> = { name: subject.name, opponent, club: world.clubs[c.club]?.name ?? "" };
      if (n?.count !== undefined) params.n = n.count;
      if (m?.result) params.score = m.home === c.club ? `${m.result.home}-${m.result.away}` : `${m.result.away}-${m.result.home}`;
      return {
        index, journalist: journalistRef(world, q.journalist, c.manager), templateId: q.templateId, pointed: q.pointed, subject, params,
        intents: q.intents, ...(q.answer ? { answer: q.answer } : {}),
      };
    }),
  };
}

export function pressView(world: World, club: ClubId): PressView {
  const mgr = Object.values(world.managers).find((m) => m.clubId === club);
  const confs = Object.keys(world.media.conferences).sort().filter((id) => world.media.conferences[id]!.club === club);
  return {
    pending: confs.filter((id) => world.media.conferences[id]!.status === "pending").map((id) => conferenceView(world, id)),
    recent: confs.filter((id) => world.media.conferences[id]!.status !== "pending").slice(-3).reverse().map((id) => conferenceView(world, id)),
    directives: directivesOf(world, mgr?.id ?? ""),
  };
}

export function narrativesView(world: World, club: ClubId): NarrativeView[] {
  return Object.values(world.media.narratives)
    .filter((n: Narrative) => n.club === club && n.resolvedDay === undefined)
    .sort((a, b) => b.heat - a.heat || a.id.localeCompare(b.id))
    .map((n) => ({
      id: n.id, kind: n.kind, subject: subjectView(world, n.subject, club), heat: n.heat >= 0.6 ? "hot" : n.heat >= 0.3 ? "warm" : "cool",
      ...(n.count !== undefined ? { count: n.count } : {}), facts: n.facts.length, askable: canAsk(world, n),
    }));
}

function authorView(world: World, a: PostAuthor, manager: string): PostView["author"] {
  switch (a.kind) {
    case "journalist": {
      const j = journalistRef(world, a.id, manager);
      return { kind: a.kind, name: j.name, outlet: j.outlet };
    }
    case "player":
      return { kind: a.kind, name: world.players[a.id] ? displayName(world.players[a.id]!) : a.id };
    case "manager":
      return { kind: a.kind, name: world.managers[a.id]?.name ?? a.id };
    case "fans":
      return { kind: a.kind, name: world.clubs[a.club]?.name ?? a.club, segment: a.segment };
    case "refereeCollective":
      return { kind: a.kind, name: a.nation };
  }
}

export function feedView(world: World, club: ClubId, limit = 40): PostView[] {
  const mgr = Object.values(world.managers).find((m) => m.clubId === club)?.id ?? "";
  return world.media.posts.filter((p) => p.club === club).slice(-limit).reverse().map((p) => {
    const params: Record<string, string | number> = {};
    // El id de la narrativa no se enseña: solo el recuento si lo hay.
    if (p.params.n !== undefined) params.n = p.params.n;
    const subjects = p.subjects.map((s) => subjectView(world, s, club));
    const author = authorView(world, p.author, mgr);
    params.name = subjects[0]?.name ?? "";
    params.author = author.name;
    return { id: p.id, day: p.day, platform: p.platform, author, key: p.key, params, subjects, sentiment: p.sentiment, reach: p.reach };
  });
}

/** Un hecho enlazado en un expediente, para enseñarlo. */
export function factView(world: World, ref: string, club: ClubId): FactView {
  const [kind, a, b] = ref.split(":");
  if (kind === "ev") {
    const e = world.events[Number(a)];
    if (!e) return { key: "fact.unknown", params: {} };
    const params: Record<string, string | number> = {};
    if (typeof e.data.player === "string" && world.players[e.data.player]) params.player = displayName(world.players[e.data.player]!);
    if (typeof e.data.matches === "number") params.matches = e.data.matches;
    if (typeof e.data.incident === "string") params.incident = e.data.incident;
    if (typeof e.data.match === "string") params.opponent = subjectView(world, { kind: "match", id: e.data.match as never }, club).name;
    return { key: `fact.${e.type}`, params, day: e.day };
  }
  if (kind === "press") {
    const c = world.media.conferences[a!];
    const q = c?.questions[Number(b)];
    return q?.answer ? { key: "fact.press", params: { intent: q.answer.intent, tone: q.answer.tone }, day: c!.day } : { key: "fact.pressOld", params: {} };
  }
  if (kind === "post") {
    const p = world.media.posts.find((x) => x.id === a);
    return p ? { key: "fact.post", params: { intent: p.key.split(".").at(-1) ?? "" }, day: p.day } : { key: "fact.postOld", params: {} };
  }
  if (kind === "ctrv") {
    const c = world.media.controversies[a!]?.[Number(b)];
    const m = world.matches[a!];
    if (!c || !m) return { key: "fact.unknown", params: {} };
    return {
      key: `fact.ctrv.${c.kind}`, params: { minute: c.minute, clarity: c.clarity, verdict: c.correct ? "right" : "wrong", opponent: subjectView(world, { kind: "match", id: m.id }, club).name },
      day: m.day,
    };
  }
  if (kind === "match") {
    const m = world.matches[a!];
    return m ? { key: "fact.match", params: { opponent: subjectView(world, { kind: "match", id: m.id }, club).name }, day: m.day } : { key: "fact.unknown", params: {} };
  }
  return { key: "fact.unknown", params: {} };
}

export function disciplineView(world: World, club: ClubId): DisciplineView {
  const mgr = Object.values(world.managers).find((m) => m.clubId === club);
  const cases = Object.keys(world.media.cases).sort().reverse().map((id) => world.media.cases[id]!).filter((c) => c.club === club).map((c): CaseView => ({
    id: c.id, kind: c.kind, subject: subjectView(world, c.subject, club), ...(c.referee ? { referee: staffName(world, c.referee) } : {}),
    openedDay: c.openedDay, deadline: c.deadline, status: c.status, ...(c.allegation ? { allegation: c.allegation } : {}),
    sanctions: c.sanctions ?? [], ...(c.appeal ? { appeal: c.appeal } : {}), facts: c.facts.map((f) => factView(world, f, club)),
  }));
  const referees = Object.keys(world.media.referees).sort().filter((k) => k.endsWith(`|${club}`)).map((k) => {
    const r = world.media.referees[k]!;
    const id = k.split("|")[0]!;
    return { id, name: staffName(world, id), mood: r.tension >= 0.5 ? ("tense" as const) : r.tension >= 0.2 ? ("strained" as const) : ("normal" as const), criticisms: r.criticisms };
  }).filter((r) => r.criticisms > 0 || r.mood !== "normal");
  return {
    cases, touchlineBan: mgr ? (world.media.touchlineBans[mgr.id] ?? 0) : 0, stadiumClosure: world.media.stadiumClosures[club] ?? 0, referees,
  };
}

export function fansView(world: World, club: ClubId): FansView {
  const c = world.clubs[club];
  if (!c) return { segments: [], form: "" };
  const sizes = Object.values(c.fanBase).map((s) => s.size);
  const max = Math.max(1, ...sizes);
  return {
    segments: (["ultras", "members", "casual", "international"] as const).map((segment) => {
      const s = c.fanBase[segment];
      const mood = s.mood <= -0.5 ? "furious" : s.mood < -0.15 ? "unhappy" : s.mood < 0.2 ? "calm" : s.mood < 0.55 ? "happy" : "euphoric";
      return { segment, mood, size: s.size >= max * 0.5 ? "large" : s.size >= max * 0.15 ? "medium" : "small" };
    }),
    form: world.media.form[club] ?? "",
  };
}

