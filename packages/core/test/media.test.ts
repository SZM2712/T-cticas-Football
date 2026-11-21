// Medios, redes y disciplina (Fase 5): criterios de aceptación (DISEÑO §7) y consecuencias.
// - 0 preguntas repetidas sin hecho nuevo; - el asistente nunca viola una directriz;
// - toda sanción tiene expediente con hechos enlazados; - ninguna publicación expone números ocultos.

import { beforeAll, describe, expect, it } from "vitest";
import {
  advanceDay, applyCommand, disciplineView, factView, feedView, forbiddenBy, migrateWorld, newGame, pressView, SAVE_VERSION, subjectKey,
  type ClubId, type Game, type PressDirectives,
} from "../src";

const DAYS = 150;
let game: Game;
let club: ClubId;
const directives: PressDirectives = { refereeCriticism: true, criticizePlayers: false, promises: false, tone: "firm" };
/** Preguntas de narrativas vistas al crearse: clave tema|sujeto|temporada → días y calor (lastFedDay) al preguntar. */
const asked: { key: string; day: number; lastFed: number }[] = [];

beforeAll(() => {
  game = newGame({ seed: 2024 });
  const w = game.world;
  club = Object.values(w.clubs).filter((c) => c.leagueId && c.nation === "ES").sort((a, b) => b.reputation - a.reputation || a.id.localeCompare(b.id))[2]!.id;
  expect(applyCommand(w, { type: "takeCharge", club, name: "Stefan" }).ok).toBe(true);
  expect(applyCommand(w, { type: "setPressDirectives", directives }).ok).toBe(true);
  const seen = new Set<string>();
  for (let d = 0; d < DAYS; d++) {
    advanceDay(game);
    for (const c of Object.values(w.media.conferences)) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      for (const q of c.questions) {
        const n = q.narrative ? w.media.narratives[q.narrative] : undefined;
        if (!n) continue;
        asked.push({ key: `${n.kind}|${subjectKey(q.subject)}|${w.meta.season}`, day: c.day, lastFed: n.lastFedDay });
      }
    }
  }
}, 120_000);

describe("prensa", () => {
  it("hay periodistas, narrativas y ruedas de prensa antes y después de cada partido", () => {
    const w = game.world;
    expect(Object.keys(w.media.journalists).length).toBeGreaterThan(0);
    expect(Object.keys(w.media.narratives).length).toBeGreaterThan(0);
    const confs = Object.values(w.media.conferences);
    expect(confs.some((c) => c.kind === "preMatch")).toBe(true);
    expect(confs.some((c) => c.kind === "postMatch")).toBe(true);
    expect(asked.length).toBeGreaterThan(5);
  });

  it("nunca se repite una pregunta sobre el mismo tema y sujeto en la temporada sin un hecho nuevo", () => {
    const last = new Map<string, number>();
    for (const a of asked) {
      const prev = last.get(a.key);
      if (prev !== undefined) expect(a.lastFed, a.key).toBeGreaterThan(prev);
      last.set(a.key, a.day);
    }
  });

  it("el asistente nunca viola una directriz", () => {
    const banned = forbiddenBy(directives);
    const byAssistant = Object.values(game.world.media.conferences).flatMap((c) => c.questions).filter((q) => q.answer?.by === "assistant");
    expect(byAssistant.length).toBeGreaterThan(0);
    for (const q of byAssistant) {
      expect(banned.has(q.answer!.intent), q.answer!.intent).toBe(false);
      expect(q.answer!.tone).toBe(directives.tone);
    }
  });

  it("responder tú mismo deja huella: el periodista, los aludidos y lo que se publica", () => {
    const w = game.world;
    // Se prepara una rueda de prensa y se responde.
    let conf = Object.values(w.media.conferences).find((c) => c.status === "pending" && c.club === club);
    for (let i = 0; i < 15 && !conf; i++) {
      advanceDay(game);
      conf = Object.values(w.media.conferences).find((c) => c.status === "pending" && c.club === club);
    }
    expect(conf).toBeDefined();
    const posts = w.media.posts.length;
    const answers = conf!.questions.map((q) => ({ intent: q.intents.includes("noComment") ? ("noComment" as const) : q.intents[0]!, tone: "combative" as const }));
    const r = applyCommand(w, { type: "answerPress", conference: conf!.id, answers });
    expect(r.ok).toBe(true);
    expect(conf!.status).toBe("answered");
    expect(w.media.posts.length).toBe(posts + conf!.questions.length);
    for (const q of conf!.questions) expect(w.media.relations[`${q.journalist}|${conf!.manager}`]).toBeLessThan(0);
    expect(applyCommand(w, { type: "answerPress", conference: conf!.id, answers })).toEqual({ ok: false, error: "error.alreadyAnswered" });
    const v = pressView(w, club);
    expect(v.recent.some((c) => c.id === conf!.id)).toBe(true);
  });
});

describe("redes", () => {
  it("ninguna publicación expone números ocultos: solo nombres, claves y recuentos visibles", () => {
    const w = game.world;
    expect(w.media.posts.length).toBeGreaterThan(10);
    for (const p of w.media.posts) {
      for (const [k, v] of Object.entries(p.params)) {
        expect(["narrative", "n"], k).toContain(k);
        if (typeof v === "number") expect(Number.isInteger(v)).toBe(true);
      }
    }
    for (const p of feedView(w, club, 400)) {
      for (const k of Object.keys(p.params)) expect(["n", "name", "author"], k).toContain(k);
    }
  });

  it("decir una cosa y luego la contraria abre la narrativa de hipocresía", () => {
    const w = game.world;
    const p = w.clubs[club]!.squad[3]!;
    expect(applyCommand(w, { type: "post", intent: "praisePlayer", tone: "calm", subject: { kind: "player", id: p } }).ok).toBe(true);
    expect(applyCommand(w, { type: "post", intent: "criticizePlayer", tone: "calm", subject: { kind: "player", id: p } })).toEqual({ ok: false, error: "error.postedToday" });
    advanceDay(game);
    expect(applyCommand(w, { type: "post", intent: "criticizePlayer", tone: "firm", subject: { kind: "player", id: p } }).ok).toBe(true);
    advanceDay(game);
    expect(Object.values(w.media.narratives).some((n) => n.kind === "hypocrisy" && n.club === club)).toBe(true);
    // El aludido lo recuerda.
    expect(w.players[p]!.memoryIds.some((id) => w.memories[id]?.kind === "publicCriticism")).toBe(true);
  });
});

describe("árbitros y disciplina", () => {
  it("criticar al árbitro con dureza abre expediente; la sanción enlaza los hechos y se puede recurrir", () => {
    const w = game.world;
    const m = Object.values(w.matches).filter((x) => x.result && x.referee && (x.home === club || x.away === club)).sort((a, b) => b.day - a.day)[0]!;
    expect(m).toBeDefined();
    advanceDay(game);
    const before = Object.keys(w.media.cases).length;
    expect(applyCommand(w, { type: "post", intent: "criticizeReferee", tone: "combative", subject: { kind: "match", id: m.id } }).ok).toBe(true);
    const c = Object.values(w.media.cases).find((x) => x.kind === "refereeCriticism" && x.status === "allegations")!;
    expect(Object.keys(w.media.cases).length).toBe(before + 1);
    expect(c.facts.length).toBeGreaterThan(0);
    expect(c.facts[0]).toMatch(/^post:/);
    expect(applyCommand(w, { type: "allegeCase", case: c.id, allegation: "accept" }).ok).toBe(true);
    const balance = w.clubs[club]!.finances.balance;
    for (let i = 0; i < 7; i++) advanceDay(game);
    expect(c.status).toBe("sanctioned");
    expect(c.sanctions!.some((s) => s.kind === "fine")).toBe(true);
    expect(w.clubs[club]!.finances.balance).toBeLessThan(balance);
    // Toda sanción del mundo tiene hechos y todos se pueden enseñar.
    for (const k of Object.values(w.media.cases)) {
      if (k.sanctions?.length) expect(k.facts.length, k.id).toBeGreaterThan(0);
      for (const f of k.facts) expect(factView(w, f, k.club).key, f).not.toBe("fact.unknown");
    }
    expect(applyCommand(w, { type: "appealCase", case: c.id }).ok).toBe(true);
    expect(c.status).toBe("closed");
    expect(c.appeal).toBeDefined();
    const dv = disciplineView(w, club);
    expect(dv.cases.some((x) => x.id === c.id)).toBe(true);
    expect(dv.referees.some((r) => r.criticisms > 0)).toBe(true);
    // La vista nunca enseña la gravedad ni la tensión como número.
    expect(JSON.stringify(dv)).not.toMatch(/gravity|tension/);
  });

  it("las polémicas llevan su evidencia y nunca cambian el marcador guardado", () => {
    const w = game.world;
    const all = Object.entries(w.media.controversies);
    for (const [mid, list] of all) {
      const m = w.matches[mid]!;
      expect(m.result).toBeDefined();
      for (const c of list) {
        expect(["clear", "debatable", "marginal"]).toContain(c.clarity);
        expect(typeof c.correct).toBe("boolean");
        expect(c.clarity === "clear" && c.correct).toBe(false);
      }
    }
  });
});

describe("migración", () => {
  it("v5 → v6: los medios empiezan vacíos y la prensa del país existe si ya había un humano", () => {
    const g = newGame({ seed: 22 }, "quick");
    const c = Object.values(g.world.clubs).find((x) => x.leagueId)!;
    applyCommand(g.world, { type: "takeCharge", club: c.id, name: "Ana" });
    const raw = JSON.parse(JSON.stringify(g.world)) as Record<string, unknown> & { meta: { saveVersion: number } };
    raw.meta.saveVersion = 5;
    delete raw.media;
    const w = migrateWorld(raw);
    expect(w.meta.saveVersion).toBe(SAVE_VERSION);
    expect(w.media.posts).toEqual([]);
    expect(Object.keys(w.media.journalists).length).toBeGreaterThan(0);
  });
});
