// Motor de partido (Fase 2): determinismo, fotogramas, balance aproximado, consecuencias
// en el mundo, tácticas de balón parado e instrucciones individuales.

import { beforeAll, describe, expect, it } from "vitest";
import {
  advanceDay, applyCommand, finishLive, liveIntervene, liveReport, applyReport, buildMatchInput, generateWorld, hashValue, instructionCompliance, newGame,
  pickLineup, quickMatch, simulateMatch, worldRng, type GameDay, type Match, type MatchId, type MatchInput, type MatchReport,
  type PlayerId, type World,
} from "../src";

let world: World;
let fixtures: Match[];

/** Partido ficticio de liga entre dos clubes (no se añade al mundo). */
function fixture(w: World, home: string, away: string, n = 0): Match {
  const league = Object.values(w.leagues).find((l) => l.clubs.includes(home as never))!;
  return {
    id: `t_${n}_${home}_${away}` as MatchId, competitionId: league.currentCompetition!, stage: 0, round: 0,
    home: home as never, away: away as never, day: w.meta.today as GameDay, candidates: [], neutral: false, decisive: false,
  };
}

function play(input: MatchInput, path: string, frames = false): MatchReport {
  return simulateMatch(input, worldRng(world).fork(path), { frames });
}

beforeAll(() => {
  world = newGame({ seed: 123 }).world;
  fixtures = [];
  for (const league of Object.values(world.leagues).slice(0, 2)) {
    for (const h of league.clubs) for (const a of league.clubs) if (h !== a) fixtures.push(fixture(world, h, a));
  }
});

describe("determinismo", () => {
  it("misma entrada y mismo seedPath → mismo partido; pedir fotogramas no lo cambia", () => {
    const input = buildMatchInput(world, fixtures[0]!);
    const a = play(input, "x/1");
    const b = play(input, "x/1", true);
    expect(hashValue({ ...b, frames: undefined })).toBe(hashValue(a));
    expect(hashValue(play(input, "x/2"))).not.toBe(hashValue(a));
  });

  it("los fotogramas son coherentes: 44 coordenadas por fotograma, en el campo, tiempo creciente", () => {
    const r = play(buildMatchInput(world, fixtures[1]!), "x/frames", true);
    const f = r.frames!;
    expect(f.t.length).toBeGreaterThan(300);
    expect(f.pos.length).toBe(f.t.length * 44);
    expect(f.ball.length).toBe(f.t.length * 2);
    for (let i = 1; i < f.t.length; i++) expect(f.t[i]!).toBeGreaterThanOrEqual(f.t[i - 1]!);
    expect(f.pos.every((v) => v === -1 || (v >= 0 && v <= 1))).toBe(true);
    // Cada evento referenciado existe.
    expect(f.event.every((e) => e < r.events.length)).toBe(true);
  });
});

describe("balance aproximado (el criterio completo lo mide `npm run sim`)", () => {
  let reports: MatchReport[];
  beforeAll(() => {
    reports = fixtures.map((m, i) => play(buildMatchInput(world, m), `bal/${i}`));
  });

  it("goles, resultado local, empates y rojas en rangos razonables", () => {
    const n = reports.length;
    const goals = reports.reduce((s, r) => s + r.score[0] + r.score[1], 0) / n;
    const home = reports.filter((r) => r.score[0] > r.score[1]).length / n;
    const draws = reports.filter((r) => r.score[0] === r.score[1]).length / n;
    const reds = reports.reduce((s, r) => s + r.stats[0].red + r.stats[1].red, 0) / n;
    expect(goals).toBeGreaterThan(2.3);
    expect(goals).toBeLessThan(3.1);
    expect(home).toBeGreaterThan(0.38);
    expect(home).toBeLessThan(0.52);
    expect(draws).toBeGreaterThan(0.19);
    expect(draws).toBeLessThan(0.33);
    expect(reds).toBeLessThan(0.35);
  });

  it("cada partido es coherente: goles = eventos de gol, minutos, cambios y valoraciones", () => {
    for (const r of reports) {
      const goals = [0, 0];
      for (const e of r.events) if (e.type === "goal" || e.type === "ownGoal") goals[e.side]!++;
      expect(goals).toEqual(r.score);
      for (const side of [0, 1]) {
        const lines = r.players.filter((p) => p.side === side);
        expect(lines.filter((p) => p.started).length).toBe(11);
        expect(lines.length - 11).toBeLessThanOrEqual(5);
        for (const p of lines) {
          expect(p.rating).toBeGreaterThanOrEqual(3);
          expect(p.rating).toBeLessThanOrEqual(10);
          expect(p.minutes).toBeLessThanOrEqual(130);
        }
      }
    }
  });

  it("el mejor equipo gana más a menudo", () => {
    let favWins = 0;
    let favLosses = 0;
    for (let i = 0; i < reports.length; i++) {
      const input = buildMatchInput(world, fixtures[i]!);
      const lh = input.home.xi.reduce((s, p) => s + p.ability, 0);
      const la = input.away.xi.reduce((s, p) => s + p.ability, 0);
      if (Math.abs(lh - la) < 15) continue;
      const r = reports[i]!;
      const d = (r.score[0] - r.score[1]) * Math.sign(lh - la);
      if (d > 0) favWins++;
      else if (d < 0) favLosses++;
    }
    expect(favWins).toBeGreaterThan(favLosses * 1.8);
  });

  it("el modelo rápido da medias de goles parecidas al completo", () => {
    const ratings = new Map<string, number>();
    const quick = fixtures.map((m, i) => quickMatch(world, m, worldRng(world).fork(`q/${i}`), ratings));
    const g = (rs: MatchReport[]) => rs.reduce((s, r) => s + r.score[0] + r.score[1], 0) / rs.length;
    expect(Math.abs(g(quick) - g(reports)) / g(reports)).toBeLessThan(0.12);
  });
});

describe("consecuencias en el mundo", () => {
  it("una roja sanciona al jugador en esa competición y la cumple en el siguiente partido", () => {
    const ww = newGame({ seed: 5 }).world;
    const league = Object.values(ww.leagues)[0]!;
    const [h, a, c] = league.clubs;
    const m1 = fixture(ww, h!, a!, 1);
    const input = buildMatchInput(ww, m1);
    const report = simulateMatch(input, worldRng(ww).fork("red"));
    // Forzamos una roja directa al primer jugador del local.
    const offender = report.players.find((p) => p.side === 0)!;
    offender.red = true;
    report.events.push({ t: 600, minute: 10, added: 0, side: 0, type: "red", player: offender.id, detail: "direct" });
    applyReport(ww, m1, report, "full");
    const p = ww.players[offender.id]!;
    expect(p.suspensions).toEqual([{ competitionId: m1.competitionId, matches: 2 }]);
    expect(ww.events.some((e) => e.type === "match.redCard" && e.data.player === offender.id)).toBe(true);
    // No puede jugar el siguiente partido de esa competición…
    expect(pickLineup(ww, h!, m1.day, m1.competitionId).xi.some((x) => x.id === offender.id)).toBe(false);
    expect(pickLineup(ww, h!, m1.day, m1.competitionId).bench.some((x) => x.id === offender.id)).toBe(false);
    // …y la sanción baja al jugarse uno.
    const m2 = fixture(ww, h!, c!, 2);
    applyReport(ww, m2, simulateMatch(buildMatchInput(ww, m2), worldRng(ww).fork("m2")), "full");
    expect(p.suspensions).toEqual([{ competitionId: m1.competitionId, matches: 1 }]);
  });

  it("un lesionado no juega hasta recuperarse", () => {
    const g = newGame({ seed: 6 });
    const ww = g.world;
    const club = Object.values(ww.leagues)[0]!.clubs[0]!;
    const star = pickLineup(ww, club, ww.meta.today, Object.values(ww.leagues)[0]!.currentCompetition!).xi[5]!;
    star.injury = { kind: "match", since: ww.meta.today, until: (ww.meta.today + 10) as GameDay };
    const comp = Object.values(ww.leagues)[0]!.currentCompetition!;
    expect(pickLineup(ww, club, (ww.meta.today + 5) as GameDay, comp).xi.includes(star)).toBe(false);
    expect(pickLineup(ww, club, (ww.meta.today + 11) as GameDay, comp).xi.includes(star)).toBe(true);
  });

  it("al avanzar días se juegan partidos con el motor completo y se registran estadísticas", () => {
    const g = newGame({ seed: 9 });
    const played = [];
    while (!played.length || played.length < 60) played.push(...advanceDay(g));
    expect(played.length).toBeGreaterThan(50);
    expect(played.some((p) => p.engine === "full")).toBe(true);
    const m = played.find((p) => p.engine === "full")!.match;
    expect(m.result!.goals.length).toBe(m.result!.home + m.result!.away);
    expect(Object.keys(g.world.stats).length).toBeGreaterThan(0);
  });
});


describe("tácticas: balón parado e instrucciones", () => {
  it("valida los planes: jugadores ajenos, valores fuera de rango y rutinas inexistentes", () => {
    const g = newGame({ seed: 11 });
    const ww = g.world;
    const [club, other] = Object.values(ww.leagues)[0]!.clubs;
    const outsider = ww.clubs[other!]!.squad[0]!;
    const mine = ww.clubs[club!]!.squad[0]!;
    expect(applyCommand(ww, { type: "setTactics", team: club!, plan: { mentality: 2 } })).toEqual({ ok: false, error: "error.range" });
    expect(applyCommand(ww, { type: "setTactics", team: club!, plan: { setPieces: { penaltyTakers: [outsider] } } }).ok).toBe(false);
    expect(applyCommand(ww, { type: "setTactics", team: club!, plan: { setPieces: { corners: "rabona" as never } } }).ok).toBe(false);
    expect(applyCommand(ww, { type: "setTactics", team: club!, plan: { instructions: [{ player: mine, key: "shootMore" }] } }).ok).toBe(true);
    expect(ww.tactics[club!]!.instructions).toHaveLength(1);
  });

  it("el lanzador de penaltis designado tira los penaltis cuando está en el campo", () => {
    const g = newGame({ seed: 12 });
    const ww = g.world;
    const league = Object.values(ww.leagues)[0]!;
    const [h, a] = league.clubs;
    const comp = league.currentCompetition!;
    const xi = pickLineup(ww, h!, ww.meta.today, comp).xi;
    // Elegimos al peor lanzador del once para que el designado no coincida con el automático.
    const worst = xi.filter((p) => p.position !== "GK").sort((x, y) => x.technical.penalties - y.technical.penalties)[0]!;
    applyCommand(ww, { type: "setTactics", team: h!, plan: { setPieces: { penaltyTakers: [worst.id] } } });
    let pens = 0;
    for (let i = 0; i < 120; i++) {
      const r = simulateMatch(buildMatchInput(ww, fixture(ww, h!, a!, i)), worldRng(ww).fork(`pen/${i}`));
      const onField = new Set(r.players.filter((p) => p.side === 0).map((p) => p.id));
      for (let k = 0; k < r.events.length; k++) {
        const e = r.events[k]!;
        if (e.type !== "penaltyAwarded" || e.side !== 0 || !onField.has(worst.id)) continue;
        const sentOff = r.events.slice(0, k).some((x) => (x.type === "red" || x.type === "injury" || x.type === "sub") && (x.player === worst.id || x.other === worst.id));
        if (sentOff) continue;
        expect(e.player).toBe(worst.id);
        pens++;
      }
    }
    expect(pens).toBeGreaterThan(5);
  });

  it("los córners en corto no acaban en cabezazo directo; con todos arriba hay más contras", () => {
    const g = newGame({ seed: 13 });
    const ww = g.world;
    const league = Object.values(ww.leagues)[0]!;
    const [h, a] = league.clubs;
    applyCommand(ww, { type: "setTactics", team: h!, plan: { setPieces: { corners: "short" } } });
    let headers = 0;
    let corners = 0;
    for (let i = 0; i < 60; i++) {
      const r = simulateMatch(buildMatchInput(ww, fixture(ww, h!, a!, i)), worldRng(ww).fork(`c/${i}`));
      for (let k = 1; k < r.events.length; k++) {
        const prev = r.events[k - 1]!;
        if (prev.type === "corner" && prev.side === 0) {
          corners++;
          const e = r.events[k]!;
          if (e.side === 0 && e.detail === "cornerHeader") headers++;
        }
      }
    }
    expect(corners).toBeGreaterThan(100);
    expect(headers).toBe(0);
  });

  it("un delantero con mucho ego cumple 'tira menos' con menos probabilidad que uno profesional y humilde", () => {
    const w = generateWorld({ seed: 14 });
    const strikers = Object.values(w.players).filter((p) => p.position === "ST" && p.technical.finishing > 13);
    const egoMax = strikers.reduce((a, b) => (b.psych.ego - b.psych.professionalism > a.psych.ego - a.psych.professionalism ? b : a));
    const humble = strikers.reduce((a, b) => (b.psych.ego - b.psych.professionalism < a.psych.ego - a.psych.professionalism ? b : a));
    expect(instructionCompliance(egoMax, "shootLess", 0.5)).toBeLessThan(instructionCompliance(humble, "shootLess", 0.5) - 0.2);
    // Más autoridad del técnico → más obediencia.
    expect(instructionCompliance(egoMax, "shootLess", 0.9)).toBeGreaterThan(instructionCompliance(egoMax, "shootLess", 0.1));
  });

  it("las instrucciones ignoradas quedan registradas como evento del mundo", () => {
    const g = newGame({ seed: 15 });
    const ww = g.world;
    const league = Object.values(ww.leagues)[0]!;
    const [h, a] = league.clubs;
    const comp = league.currentCompetition!;
    const xi = pickLineup(ww, h!, ww.meta.today, comp).xi;
    const instructions = xi.slice(1).map((p) => ({ player: p.id as PlayerId, key: "stayOnFeet" as const }));
    applyCommand(ww, { type: "setTactics", team: h!, plan: { instructions } });
    const m = fixture(ww, h!, a!, 99);
    const r = simulateMatch(buildMatchInput(ww, m), worldRng(ww).fork("ign"));
    expect(r.instructions.length).toBeGreaterThanOrEqual(10);
    const ignored = r.instructions.filter((o) => !o.followed).length;
    applyReport(ww, m, r, "full");
    expect(ww.events.filter((e) => e.type === "player.ignoredInstruction").length).toBe(ignored);
  });
});

describe("partido en directo", () => {
  /** Avanza hasta el día de un partido de liga del primer club y lo reserva para jugarlo en directo. */
  function liveGame(seed: number) {
    const g = newGame({ seed });
    const club = Object.values(g.world.leagues)[0]!.clubs[0]!;
    const m = Object.values(g.world.matches)
      .filter((x) => (x.home === club || x.away === club) && g.world.competitions[x.competitionId]?.kind === "league")
      .sort((a, b) => a.day - b.day)[0]!;
    while (g.world.meta.today < m.day - 1) advanceDay(g);
    advanceDay(g, { live: m.id });
    const side = (m.home === club ? 0 : 1) as 0 | 1;
    return { g, m, club, side };
  }

  it("sin intervenciones, el directo da el mismo partido que la simulación normal", () => {
    const a = liveGame(31);
    const b = newGame({ seed: 31 });
    while (b.world.meta.today < a.m.day) advanceDay(b);
    expect(a.g.live?.match.id).toBe(a.m.id);
    expect(a.m.result).toBeUndefined();
    const played = finishLive(a.g);
    expect(hashValue(played.report)).toBe(hashValue(simulateMatch(played.input!, worldRng(a.g.world).fork(`match/${a.m.id}`))));
    expect([a.m.result!.home, a.m.result!.away]).toEqual([b.world.matches[a.m.id]!.result!.home, b.world.matches[a.m.id]!.result!.away]);
  });

  it("una intervención no cambia lo ya jugado y el partido es reproducible", () => {
    const { g, side } = liveGame(32);
    const before = liveReport(g);
    const f = before.frames!;
    const k = f.step.findIndex((s) => s > 300);
    const step = f.step[k]!;
    const xi = new Set(f.rosters.filter((r) => r.side === side && r.at <= k).at(-1)!.ids);
    const sheet = side === 0 ? g.live!.input.home : g.live!.input.away;
    const out = sheet.xi.find((p) => xi.has(p.id) && p.position !== "GK")!;
    const inn = sheet.bench.find((p) => p.position !== "GK")!;
    expect(liveIntervene(g, { step, side, change: { type: "sub", out: out.id, in: inn.id } })).toEqual({ ok: true });
    const after = liveReport(g);
    // Lo anterior a la pausa es idéntico, fotograma a fotograma.
    const n = f.step.findIndex((s) => s > step);
    expect(after.frames!.pos.slice(0, n * 44)).toEqual(f.pos.slice(0, n * 44));
    expect(after.frames!.ball.slice(0, n * 2)).toEqual(f.ball.slice(0, n * 2));
    expect(after.events.some((e) => e.type === "sub" && e.player === inn.id && e.detail === "manual")).toBe(true);
    expect(hashValue(liveReport(g))).toBe(hashValue(after));
    // No se puede volver atrás ni repetir el cambio.
    expect(liveIntervene(g, { step: step - 10, side, change: { type: "tactics", tactics: { mentality: 0.5 } } })).toEqual({ ok: false, error: "error.pastStep" });
    expect(liveIntervene(g, { step, side, change: { type: "sub", out: out.id, in: inn.id } }).ok).toBe(false);
    const played = finishLive(g);
    expect(played.match.interventions).toHaveLength(1);
    expect(g.live).toBeNull();
  });

  it("cambio de sistema en el descanso (encerrarse): se recolocan los jugadores y la IA rival responde", () => {
    const { g, side } = liveGame(33);
    const r = liveReport(g);
    const ht = r.events.findIndex((e) => e.type === "halfTime");
    const k = r.frames!.event.indexOf(ht);
    const step = r.frames!.step[k]!;
    const res = liveIntervene(g, { step, side, change: { type: "tactics", tactics: { formation: "5-3-2", mentality: -1 } } });
    expect(res).toEqual({ ok: true });
    const after = liveReport(g);
    expect(after.events.some((e) => e.type === "tactical" && e.side === side && e.detail === "5-3-2")).toBe(true);
    expect(after.events.some((e) => e.type === "tactical" && e.side !== side && e.detail === "response")).toBe(true);
    const roster = after.frames!.rosters.filter((x) => x.side === side).at(-1)!;
    expect(roster.ids.filter(Boolean).length).toBeGreaterThanOrEqual(10);
  });

  it("una instrucción dada en directo se decide en ese momento y queda con su minuto", () => {
    const { g, side } = liveGame(34);
    const r = liveReport(g);
    const step = r.frames!.step[Math.floor(r.frames!.step.length / 3)]!;
    const sheet = side === 0 ? g.live!.input.home : g.live!.input.away;
    const instructions = sheet.xi.slice(1, 6).map((p) => ({ player: p.id, key: "pressMore" as const }));
    expect(liveIntervene(g, { step, side, change: { type: "instructions", instructions } })).toEqual({ ok: true });
    const after = liveReport(g);
    const live = after.instructions.filter((o) => o.minute !== undefined);
    expect(live).toHaveLength(5);
  });
});
