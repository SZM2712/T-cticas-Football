// Vestuario (Fase 4): escenarios guionizados de las tres dinámicas de ego en 200 semillas
// (DISEÑO §5.4 y §7), promesas con acción enlazada, memoria, camarillas, jerarquía y encaje.

import { beforeAll, describe, expect, it } from "vitest";
import {
  applyCommand, currentAbility, dailySocial, dressingRoomView, fitOf, gossipView, generateWorld, hashValue, liveCommitments, louvain, recomputeStructure,
  Rng, salience, squadPlayers, talkChance, type ClubId, type GameDay, type Player, type PlayerId, type World,
} from "../src";

const SEEDS = 200;
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
let base: World;
let clubId: ClubId;

beforeAll(() => {
  base = generateWorld({ seed: 77 });
  clubId = Object.values(base.clubs).filter((c) => c.leagueId).sort((a, b) => b.reputation - a.reputation || (a.id < b.id ? -1 : 1))[0]!.id;
});

/**
 * Mundo mínimo para un escenario: solo el club (y su plantilla) con los rasgos perturbados por
 * la semilla, y un mánager humano al mando. Así 200 semillas caben en segundos.
 */
function scenarioWorld(seed: number): { w: World; squad: Player[] } {
  const club = clone(base.clubs[clubId]!);
  const players: World["players"] = {};
  const rng = Rng.create(`escenario-${seed}`);
  for (const id of club.squad) {
    const p = clone(base.players[id]!);
    for (const k of Object.keys(p.psych) as (keyof Player["psych"])[]) p.psych[k] = Math.min(1, Math.max(0, p.psych[k] + rng.normal(0, 0.15)));
    players[id] = p;
  }
  const w: World = {
    ...base, meta: { ...base.meta, seed: `escenario-${seed}` }, clubs: { [clubId]: club }, players, matches: {}, competitions: {},
    stats: {}, tactics: {}, plans: {}, scouting: {}, events: [], idCounters: {}, managers: {}, relationships: {}, trust: {},
    memories: {}, commitments: {}, inbox: [], dressing: {}, salts: {}, history: [],
  };
  expect(applyCommand(w, { type: "takeCharge", club: clubId, name: "Stefan" })).toEqual({ ok: true });
  return { w, squad: squadPlayers(w, clubId) };
}

/** Fija rasgos y participación de un jugador. */
function script(w: World, p: Player, psych: Partial<Player["psych"]>, recent?: number[]): void {
  Object.assign(p.psych, psych);
  if (recent) w.dressing[clubId]!.recent[p.id] = [...recent];
}

function run(w: World, days: number, each?: (day: number) => void): void {
  for (let i = 0; i < days; i++) {
    w.meta.today = (w.meta.today + 1) as GameDay;
    each?.(i + 1);
    dailySocial(w, w.meta.today);
  }
}

const PLAYS = [1, 1, 1, 1, 1, 1, 1, 1];
const BENCHED = [0, 0, 0, 0, 0, 0, 0, 0];

/** El líder del vestuario (mayor influencia) convertido en el del escenario. */
function makeLeader(w: World, squad: Player[], psych: Partial<Player["psych"]>): Player {
  const leader = [...squad].sort((a, b) => currentAbility(b) - currentAbility(a) || (a.id < b.id ? -1 : 1))[0]!;
  script(w, leader, { influence: 0.95, ...psych }, PLAYS);
  leader.state.expectedStatus = "keyPlayer";
  // Lleva años en el club: es líder del vestuario, no solo influyente.
  leader.contract = { ...leader.contract!, signed: (w.meta.today - 6 * 365) as GameDay };
  recomputeStructure(w, clubId);
  return leader;
}

/** Llega una estrella con un salario `ratio` veces el del líder. */
function signStar(w: World, squad: Player[], leader: Player, ratio: number): Player {
  const model = squad.find((p) => p.position === leader.position && p.id !== leader.id) ?? squad.find((p) => p.id !== leader.id)!;
  const star = clone(model);
  star.id = "pl_star" as PlayerId;
  star.contract = { ...star.contract!, wage: Math.round(leader.contract!.wage * ratio) };
  star.state.expectedStatus = "keyPlayer";
  star.state.tensions = {};
  star.memoryIds = [];
  w.players[star.id] = star;
  w.clubs[clubId]!.squad.push(star.id);
  return star;
}

function share(n: number, f: (seed: number) => boolean): number {
  let hits = 0;
  for (let s = 0; s < n; s++) if (f(s)) hits++;
  // Con SOCIAL_REPORT=1 se imprime cada tasa (para docs/balance/fase4.md).
  const g = globalThis as { process?: { env: Record<string, string | undefined> }; console?: { log(s: string): void } };
  if (g.process?.env.SOCIAL_REPORT) g.console?.log(`[escenario] ${expect.getState().currentTestName}: ${((100 * hits) / n).toFixed(1)} %`);
  return hits / n;
}

describe("celos salariales (§5.4.1)", () => {
  it("fichar a una estrella con 1,5× el salario del líder (ego 0,85) → tensión ≥ 0,45 en ≤ 30 días en ≥ 80 %", () => {
    const rate = share(SEEDS, (seed) => {
      const { w, squad } = scenarioWorld(seed);
      const leader = makeLeader(w, squad, { ego: 0.85, loyalty: 0.3 });
      signStar(w, squad, leader, 1.5);
      expect(w.dressing[clubId]!.levels[leader.id]).toBe("leader");
      run(w, 30);
      return (leader.state.tensions.salaryEnvy ?? 0) >= 0.45;
    });
    expect(rate).toBeGreaterThanOrEqual(0.8);
  });

  it("con un líder muy leal (0,9) → como mucho en el 40 %", () => {
    const rate = share(SEEDS, (seed) => {
      const { w, squad } = scenarioWorld(seed);
      const leader = makeLeader(w, squad, { ego: 0.85, loyalty: 0.9 });
      signStar(w, squad, leader, 1.5);
      run(w, 30);
      return (leader.state.tensions.salaryEnvy ?? 0) >= 0.45;
    });
    expect(rate).toBeLessThanOrEqual(0.4);
  });

  it("renovar al líder al 90 % del salario de la estrella la desactiva (≥ 95 % por debajo de 0,25)", () => {
    const rate = share(SEEDS, (seed) => {
      const { w, squad } = scenarioWorld(seed);
      const leader = makeLeader(w, squad, { ego: 0.85, loyalty: 0.3 });
      const star = signStar(w, squad, leader, 1.5);
      run(w, 30, (d) => {
        if (d === 12) expect(applyCommand(w, { type: "renewContract", player: leader.id, wage: Math.round(star.contract!.wage * 0.9), years: 3 }).ok).toBe(true);
      });
      return (leader.state.tensions.salaryEnvy ?? 0) < 0.25;
    });
    expect(rate).toBeGreaterThanOrEqual(0.95);
  });
});

describe("estatus prometido frente a real (§5.4.2)", () => {
  it("un jugador clave (ego 0,7) que pasa a no jugar → tensión ≥ 0,45 en ≤ 45 días en ≥ 70 %", () => {
    const rate = share(SEEDS, (seed) => {
      const { w, squad } = scenarioWorld(seed);
      const p = squad.find((x) => x.state.expectedStatus === "keyPlayer")!;
      script(w, p, { ego: 0.7 }, BENCHED);
      run(w, 45);
      return (p.state.tensions.statusGap ?? 0) >= 0.45;
    });
    expect(rate).toBeGreaterThanOrEqual(0.7);
  });

  it("si juega lo que espera, la tensión no aparece (≥ 95 % por debajo de 0,25)", () => {
    const rate = share(SEEDS, (seed) => {
      const { w, squad } = scenarioWorld(seed);
      const p = squad.find((x) => x.state.expectedStatus === "keyPlayer")!;
      script(w, p, { ego: 0.7 }, PLAYS);
      run(w, 45);
      return (p.state.tensions.statusGap ?? 0) < 0.25;
    });
    expect(rate).toBeGreaterThanOrEqual(0.95);
  });

  it("una promesa de minutos incumplida se rompe al vencer: recuerdo, confianza y testigos", () => {
    const { w, squad } = scenarioWorld(1);
    const p = squad.find((x) => x.state.expectedStatus === "rotation") ?? squad[5]!;
    const res = applyCommand(w, { type: "talk", player: p.id, topic: "promisePlayingTime", minStartsPct: 0.5, days: 28 });
    expect(res.ok).toBe(true);
    const c = Object.values(w.commitments)[0]!;
    expect(c.type).toBe("playingTime");
    expect(c.linkedActions).toEqual([`lineup:${p.id}`]);
    // Público ante el vestuario: los testigos también lo recordarán.
    c.witnesses = "squad";
    const mgr = Object.keys(w.managers)[0]!;
    const before = w.trust[`${p.id}|${mgr}`]!.trust;
    // Cuatro partidos oficiales en los que no sale de titular.
    run(w, 35, (d) => {
      if (d % 7 === 3) c.params.matches = Number(c.params.matches) + 1;
    });
    expect(c.status).toBe("broken");
    expect(w.trust[`${p.id}|${mgr}`]!.trust).toBeLessThan(before);
    const kinds = p.memoryIds.map((id) => w.memories[id]!.kind);
    expect(kinds).toContain("promiseBroken");
    const witness = squad.find((x) => x.id !== p.id)!;
    expect(witness.memoryIds.map((id) => w.memories[id]!.kind)).toContain("witnessedBrokenPromise");
    expect(w.inbox.some((i) => i.kind === "commitmentBroken" && i.player === p.id)).toBe(true);
  });
});

describe("dos gallos en el mismo corral (§5.4.3)", () => {
  /** Dos delanteros con mucho ego, ambos titulares; uno tira los penaltis y el otro también sabría. */
  function roosters(w: World, squad: Player[], egoB = 0.8): [Player, Player] {
    const forwards = squad.filter((p) => ["ST", "LW", "RW", "AM"].includes(p.position));
    const a = forwards[0]!;
    const b = forwards.find((p) => p.id !== a.id && p.position === a.position) ?? forwards[1]!;
    b.position = a.position;
    script(w, a, { ego: 0.8 }, PLAYS);
    script(w, b, { ego: egoB }, PLAYS);
    a.technical.penalties = 15;
    b.technical.penalties = 15;
    const rel = w.relationships[a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`]!;
    rel.affinity = rel.baseline = -0.1;
    expect(applyCommand(w, { type: "setRoleTaker", role: "penalties", player: a.id }).ok).toBe(true);
    return [a, b];
  }

  it("dos titulares con ego 0,8 que se disputan el penalti → tensión del par ≥ 0,45 en ≤ 30 días en ≥ 70 %", () => {
    const rate = share(SEEDS, (seed) => {
      const { w, squad } = scenarioWorld(seed);
      const [a, b] = roosters(w, squad);
      run(w, 30);
      return (a.state.tensions[`roosters:${b.id}`] ?? 0) >= 0.45;
    });
    expect(rate).toBeGreaterThanOrEqual(0.7);
  });

  it("con roles pactados (penaltis a uno, faltas al otro) → como mucho en el 20 %", () => {
    const rate = share(SEEDS, (seed) => {
      const { w, squad } = scenarioWorld(seed);
      const [a, b] = roosters(w, squad);
      const res = applyCommand(w, { type: "talk", player: a.id, topic: "agreeRoles", other: b.id, role: "penalties", otherRole: "freeKicks" });
      expect(res.ok).toBe(true);
      run(w, 30);
      return (a.state.tensions[`roosters:${b.id}`] ?? 0) >= 0.45;
    });
    expect(rate).toBeLessThanOrEqual(0.2);
  });

  it("si uno de los dos no tiene ego (0,5), no hay gallos", () => {
    const rate = share(SEEDS, (seed) => {
      const { w, squad } = scenarioWorld(seed);
      const [a, b] = roosters(w, squad, 0.5);
      run(w, 30);
      return (a.state.tensions[`roosters:${b.id}`] ?? 0) > 0;
    });
    expect(rate).toBe(0);
  });
});

describe("vestuario", () => {
  it("es determinista: misma semilla y mismas decisiones → mismo vestuario", () => {
    const a = scenarioWorld(5).w;
    const b = scenarioWorld(5).w;
    run(a, 40);
    run(b, 40);
    expect(hashValue(a)).toBe(hashValue(b));
  });

  it("cada promesa de una conversación crea un Commitment con su acción enlazada", () => {
    const { w, squad } = scenarioWorld(2);
    const [p, q, r] = squad;
    expect(applyCommand(w, { type: "talk", player: p!.id, topic: "promiseRole", role: "captain" }).ok).toBe(true);
    expect(applyCommand(w, { type: "talk", player: q!.id, topic: "promiseContract", wage: 99999 }).ok).toBe(true);
    expect(applyCommand(w, { type: "talk", player: r!.id, topic: "promisePlayingTime", minStartsPct: 0.6 }).ok).toBe(true);
    const cs = liveCommitments(w);
    expect(cs.map((c) => c.type).sort()).toEqual(["captaincy", "newContract", "playingTime"]);
    for (const c of cs) {
      expect(c.linkedActions.length).toBeGreaterThan(0);
      expect(c.origin.kind).toBe("conversation");
    }
    // Una conversación por semana con cada jugador.
    expect(applyCommand(w, { type: "talk", player: p!.id, topic: "praise" })).toEqual({ ok: false, error: "error.talkedRecently" });
    // Cumplir la promesa de capitanía con su acción la da por cumplida en la revisión semanal.
    expect(applyCommand(w, { type: "setCaptain", player: p!.id }).ok).toBe(true);
    run(w, 7);
    expect(cs.find((c) => c.type === "captaincy")!.status).toBe("kept");
  });

  it("los recuerdos negativos pesan más y duran más en quien tiene ego", () => {
    const { w, squad } = scenarioWorld(3);
    const [p, q] = squad;
    script(w, p!, { ego: 0.95, recognitionNeed: 0.9, temperament: 0.9 });
    script(w, q!, { ego: 0.05, recognitionNeed: 0.1, temperament: 0.1 });
    for (const x of [p!, q!]) expect(applyCommand(w, { type: "setCaptain", player: x.id }).ok).toBe(true);
    // p perdió la capitanía al dársela a q.
    const lost = p!.memoryIds.map((id) => w.memories[id]!).find((m) => m.kind === "captaincyRemoved")!;
    expect(lost.halfLifeDays).toBeGreaterThan(500);
    expect(salience(lost, lost.day + 365)).toBeGreaterThan(0.3);
  });

  it("Louvain separa dos grupos claramente unidos por dentro", () => {
    const ids = ["a", "b", "c", "d", "e", "f"];
    const groupOf = (x: string) => (["a", "b", "c"].includes(x) ? 0 : 1);
    const groups = louvain(ids, (x, y) => (groupOf(x) === groupOf(y) ? 0.8 : 0.02));
    expect(groups).toEqual([["a", "b", "c"], ["d", "e", "f"]]);
  });

  it("hay jerarquía con líderes y camarillas con nombre", () => {
    const { w } = scenarioWorld(4);
    run(w, 28);
    const dr = w.dressing[clubId]!;
    const levels = Object.values(dr.levels);
    expect(levels.filter((l) => l === "leader").length).toBeGreaterThan(0);
    expect(levels.filter((l) => l === "leader").length).toBeLessThanOrEqual(3);
    expect(dr.cliques.length).toBeGreaterThan(0);
    for (const c of dr.cliques) expect(c.label).toMatch(/^(language|nation|veterans|youngsters|homegrown|locals|mixed)$/);
  });

  it("el encaje tiene desglose y queda en −1..1; la autoridad cambia la probabilidad de una charla", () => {
    const { w, squad } = scenarioWorld(6);
    const f = fitOf(w, squad[0]!, clubId);
    for (const v of Object.values(f)) {
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
    const mgr = Object.values(w.managers)[0]!;
    const p = squad[0]!;
    const low = talkChance(w, { ...mgr, reputation: 0.1 }, p, "rolePlans");
    const high = talkChance(w, { ...mgr, reputation: 0.9 }, p, "rolePlans");
    expect(high).toBeGreaterThan(low);
  });

  it("con varios humanos, cada uno solo actúa sobre su club", () => {
    const { w, squad } = scenarioWorld(8);
    const [mine] = Object.keys(w.managers);
    // Segundo humano en otro club del mundo base.
    const other = Object.values(base.clubs).find((c) => c.id !== clubId && c.leagueId)!;
    w.clubs[other.id] = clone(other);
    for (const id of other.squad) w.players[id] = clone(base.players[id]!);
    expect(applyCommand(w, { type: "takeCharge", club: other.id, name: "Ana" }, "mg_99").ok).toBe(true);
    const ana = Object.keys(w.managers).find((id) => id !== mine)!;
    expect(applyCommand(w, { type: "talk", player: squad[0]!.id, topic: "praise" }, ana)).toEqual({ ok: false, error: "error.notYourPlayer" });
    expect(applyCommand(w, { type: "talk", player: squad[0]!.id, topic: "praise" }, mine).ok).toBe(true);
    expect(applyCommand(w, { type: "takeCharge", club: clubId, name: "Intruso" }, ana)).toEqual({ ok: false, error: "error.clubTaken" });
  });
});

describe("salario aceptado y chismes", () => {
  it("quien acaba de firmar no se queja de su salario, salvo que otro firme después cobrando más", () => {
    const { w, squad } = scenarioWorld(9);
    const leader = makeLeader(w, squad, { ego: 0.9, loyalty: 0.2 });
    // Acaba de renovar con el salario que aceptó; ya había alguien que cobraba más.
    leader.contract = { ...leader.contract!, signed: w.meta.today };
    const rich = squad.find((p) => p.id !== leader.id)!;
    rich.contract = { ...rich.contract!, wage: leader.contract.wage * 2, signed: (w.meta.today - 400) as GameDay };
    run(w, 30);
    expect(leader.state.tensions.salaryEnvy ?? 0).toBe(0);
    // Llega después un fichaje que cobra mucho más: eso sí le escuece.
    signStar(w, squad, leader, 1.6).contract!.signed = w.meta.today;
    run(w, 30);
    expect(leader.state.tensions.salaryEnvy ?? 0).toBeGreaterThan(0.2);
  });

  it("los chismes cuentan lo que pasa en el vestuario, sin números", () => {
    const { w, squad } = scenarioWorld(10);
    const clubId0 = Object.values(w.managers)[0]!.clubId!;
    expect(applyCommand(w, { type: "setCaptain", player: squad[2]!.id }).ok).toBe(true);
    const gossip = gossipView(w, clubId0);
    expect(gossip[0]).toMatchObject({ kind: "newCaptain", player: { id: squad[2]!.id } });
    expect(JSON.stringify(gossip)).not.toMatch(/tension|psych|ego"/);
    expect(dressingRoomView(w, clubId0).leaders.length).toBeGreaterThan(0);
  });
});
