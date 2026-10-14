// Desarrollo (Fase 3): crecimiento, plan individual con adherencia, mentoría, ojeadores,
// relevo generacional y vistas sin números ocultos.

import { beforeAll, describe, expect, it } from "vitest";
import {
  ageOn, applyCommand, currentAbility, dayOf, exactAge, generateWorld, hashValue, monthlyDevelopment, newGame,
  observe, planEffects, playerDevelopmentView, rollAdherence, scoutReportsView, seasonTurnover, staffQuality,
  worldRng, type DevelopmentPlan, type GameDay, type Player, type PlayerId, type Staff, type World,
} from "../src";

let base: World;
beforeAll(() => {
  base = generateWorld({ seed: 41 });
});

const clone = (w: World): World => JSON.parse(JSON.stringify(w)) as World;
const monthDay = (w: World, months: number) => (dayOf(w.meta.startYear, 8, 1) + Math.round(months * 30.44)) as GameDay;

function youngsters(w: World, maxAge = 19): Player[] {
  return Object.values(w.players).filter((p) => p.clubId && w.clubs[p.clubId]!.leagueId && ageOn(p.birthDay, w.meta.today) <= maxAge);
}

describe("desarrollo mensual", () => {
  it("es determinista y cada cambio de nivel trae su informe «¿por qué?»", () => {
    const a = clone(base);
    const b = clone(base);
    for (let m = 0; m < 3; m++) {
      monthlyDevelopment(a, monthDay(a, m));
      monthlyDevelopment(b, monthDay(b, m));
    }
    expect(hashValue(a)).toBe(hashValue(b));
    for (const p of Object.values(a.players)) {
      const h = p.development.caMonthly;
      if (h.length >= 2 && Math.abs(h.at(-1)! - h.at(-2)!) >= 3) expect(p.development.recentFactors.length, p.id).toBeGreaterThan(0);
    }
  });

  it("un joven que juega crece más que uno que no juega", () => {
    const w = clone(base);
    const kids = youngsters(w).slice(0, 200);
    const playing = new Set(kids.filter((_, i) => i % 2 === 0).map((p) => p.id));
    const start = new Map(kids.map((p) => [p.id, currentAbility(p)]));
    for (let m = 0; m < 12; m++) {
      for (const p of kids) p.development.monthMinutes = playing.has(p.id) ? 360 : 0;
      monthlyDevelopment(w, monthDay(w, m));
    }
    const gain = (yes: boolean) => {
      const list = kids.filter((p) => playing.has(p.id) === yes);
      return list.reduce((s, p) => s + currentAbility(w.players[p.id]!) - start.get(p.id)!, 0) / list.length;
    };
    expect(gain(true)).toBeGreaterThan(gain(false) + 0.15);
    expect(gain(true)).toBeGreaterThan(0.3);
  });

  it("los veteranos pierden físico con los años", () => {
    const w = clone(base);
    const vets = Object.values(w.players).filter((p) => ageOn(p.birthDay, w.meta.today) >= 32).slice(0, 100);
    const pace = new Map(vets.map((p) => [p.id, p.physical.pace + p.physical.stamina]));
    for (let m = 0; m < 12; m++) monthlyDevelopment(w, monthDay(w, m));
    const lost = vets.filter((p) => w.players[p.id]!.physical.pace + w.players[p.id]!.physical.stamina < pace.get(p.id)!).length;
    expect(lost / vets.length).toBeGreaterThan(0.85);
  });
});

describe("plan individual y adherencia", () => {
  const plan: DevelopmentPlan = { focus: "physical", intensity: "high", diet: "leanMass", exercise: "strength", sleep: "routine" };

  it("el profesional lo cumple más que el juerguista, sobre todo el sueño", () => {
    const players = Object.values(base.players);
    const pro = players.reduce((a, b) => (b.psych.professionalism - b.psych.offPitchLife > a.psych.professionalism - a.psych.offPitchLife ? b : a));
    const party = players.reduce((a, b) => (b.psych.offPitchLife - b.psych.professionalism > a.psych.offPitchLife - a.psych.professionalism ? b : a));
    const q = staffQuality(base, undefined);
    const rate = (p: Player, part: "training" | "sleep") => {
      let full = 0;
      const rng = worldRng(base).fork(`adh/${p.id}`);
      for (let i = 0; i < 400; i++) if (rollAdherence(p, plan, 0.5, q, 24, rng)[part] === "full") full++;
      return full / 400;
    };
    expect(rate(pro, "training")).toBeGreaterThan(rate(party, "training") + 0.2);
    expect(rate(pro, "sleep")).toBeGreaterThan(rate(party, "sleep") + 0.3);
  });

  it("los efectos dependen de lo que de verdad hace: cumplir da fuerza y peso; no cumplir, nada", () => {
    const q = { coaching: 0.6, nutrition: 0.7, conditioning: 0.7, medical: 0.6 };
    const full = planEffects(plan, { training: "full", diet: "full", exercise: "full", sleep: "full" }, q);
    const none = planEffects(plan, { training: "none", diet: "none", exercise: "none", sleep: "none" }, q);
    expect(full.attrs.strength!).toBeGreaterThan(0.03);
    expect(full.weightKg).toBeGreaterThan(0);
    expect(full.recoveryMult).toBeGreaterThan(none.recoveryMult - 0.2);
    expect(full.injuryRiskDelta).toBeGreaterThan(0); // intensidad alta + rutina extra: sobrecarga
    expect(none.attrs.strength ?? 0).toBe(0);
    expect(none.growth).toBeLessThan(1);
  });

  it("el comando valida el plan y el mentor, y el plan deja huella mensual", () => {
    const g = newGame({ seed: 42 }, "quick");
    const w = g.world;
    const club = Object.values(w.leagues)[0]!.clubs[0]!;
    const squad = w.clubs[club]!.squad.map((id) => w.players[id]!);
    const kid = squad.sort((a, b) => b.birthDay - a.birthDay)[0]!;
    const vet = squad.find((p) => exactAge(p.birthDay, w.meta.today) >= 27)!;
    const outsider = w.clubs[Object.values(w.leagues)[0]!.clubs[1]!]!.squad[0]!;
    expect(applyCommand(w, { type: "setPlan", player: kid.id, plan: { ...plan, mentor: outsider } })).toEqual({ ok: false, error: "error.mentor" });
    expect(applyCommand(w, { type: "setPlan", player: kid.id, plan: { ...plan, diet: "pizza" as never } }).ok).toBe(false);
    expect(applyCommand(w, { type: "setPlan", player: kid.id, plan: { ...plan, mentor: vet.id } })).toEqual({ ok: true });
    const before = { ...kid.psych };
    for (let m = 0; m < 6; m++) monthlyDevelopment(w, monthDay(w, m));
    expect(kid.development.adherence).toBeDefined();
    // La mentoría acerca sus rasgos a los del mentor.
    const closer = (["professionalism", "competitiveness"] as const).filter(
      (t) => Math.abs(kid.psych[t] - vet.psych[t]) <= Math.abs(before[t] - vet.psych[t]) + 1e-9,
    ).length;
    expect(closer).toBe(2);
    expect(kid.development.recentFactors.some((f) => f.key === "mentor" || f.key.startsWith("plan."))).toBe(true);
  });
});

describe("ojeadores", () => {
  it("dos ojeadores con criterios distintos discrepan en al menos un 30 % de los jóvenes", () => {
    const w = clone(base);
    const kids = youngsters(w, 20).slice(0, 150);
    const mk = (id: string, bias: number, potential: number): Staff => ({
      ...Object.values(w.staff).find((s) => s.role === "scout")!, id: id as never, scoutBias: bias,
      attributes: { ...Object.values(w.staff).find((s) => s.role === "scout")!.attributes, judgingPotential: potential },
    });
    const a = mk("st_a", 1.2, 15);
    const b = mk("st_b", -1.2, 8);
    w.staff[a.id] = a;
    w.staff[b.id] = b;
    const rng = worldRng(w).fork("scouts");
    for (const p of kids) {
      for (let i = 0; i < 3; i++) {
        observe(w, a, p, w.meta.today, rng, false);
        observe(w, b, p, w.meta.today, rng, false);
      }
    }
    let differ = 0;
    for (const p of kids) {
      const reports = scoutReportsView(w, p.id);
      const ra = reports.find((r) => r.scout === a.id)!;
      const rb = reports.find((r) => r.scout === b.id)!;
      if (Math.abs((ra.potential[0] + ra.potential[1]) / 2 - (rb.potential[0] + rb.potential[1]) / 2) >= 0.5) differ++;
    }
    expect(differ / kids.length).toBeGreaterThanOrEqual(0.3);
  });

  it("observar más da más confianza", () => {
    const w = clone(base);
    const s = Object.values(w.staff).find((x) => x.role === "scout")!;
    const p = youngsters(w)[0]!;
    const rng = worldRng(w).fork("conf");
    const first = observe(w, s, p, w.meta.today, rng, false).v;
    for (let i = 0; i < 6; i++) observe(w, s, p, w.meta.today, rng, true);
    expect(w.scouting[s.id]![p.id]!.v).toBeLessThan(first / 2);
  });
});

describe("relevo generacional", () => {
  it("se retiran veteranos, suben canteranos y las plantillas se mantienen", () => {
    const w = clone(base);
    const size = (c: string) => w.clubs[c]!.squad.length;
    const clubs = Object.values(w.clubs).filter((c) => c.leagueId).map((c) => c.id);
    const before = clubs.reduce((s, c) => s + size(c), 0);
    w.meta.today = dayOf(w.meta.startYear + 1, 7, 1);
    const r = seasonTurnover(w, w.meta.startYear);
    expect(r.retired).toBeGreaterThan(50);
    expect(r.promoted).toBeGreaterThan(50);
    const after = clubs.reduce((s, c) => s + size(c), 0);
    expect(Math.abs(after - before) / before).toBeLessThan(0.08);
    for (const c of Object.values(w.clubs)) for (const id of c.squad) expect(w.players[id]!.retired, id).toBe(false);
    const retired = Object.values(w.players).filter((p) => p.retired);
    expect(retired.every((p) => p.clubId === null)).toBe(true);
    expect(retired.filter((p) => ageOn(p.birthDay, w.meta.today) >= 32).length / retired.length).toBeGreaterThan(0.6);
  });
});

describe("vistas", () => {
  it("la ficha de desarrollo nunca expone el techo latente ni rasgos ocultos", () => {
    const w = clone(base);
    monthlyDevelopment(w, monthDay(w, 0));
    const p = youngsters(w)[0]!;
    const v = playerDevelopmentView(w, p.id as PlayerId);
    const json = JSON.stringify(v);
    expect(json).not.toMatch(/latentCeiling|psych|hidden|volatility|maturation/);
    expect(json).not.toContain(String(p.development.latentCeiling));
    for (const f of v.factors) expect([-2, -1, 1, 2]).toContain(f.trend);
  });
});

describe("retiradas anticipadas", () => {
  it("cada enfoque funciona con un tipo de jugador; aceptar lo hace más probable", async () => {
    const { retirementChance } = await import("../src");
    const players = Object.values(base.players);
    const loyal = players.reduce((a, b) => (b.psych.loyalty > a.psych.loyalty ? b : a));
    const mercenary = players.reduce((a, b) => (b.psych.loyalty < a.psych.loyalty ? b : a));
    expect(retirementChance(loyal, "age", "club", 0.5, 33)).toBeLessThan(retirementChance(mercenary, "age", "club", 0.5, 33) - 0.15);
    expect(retirementChance(loyal, "injury", "accept", 0.5, 30)).toBeGreaterThan(retirementChance(loyal, "injury", undefined, 0.5, 30));
    expect(retirementChance(loyal, "injury", "support", 0.5, 30)).toBeLessThan(retirementChance(loyal, "injury", undefined, 0.5, 30));
  });

  it("una lesión larga hace dudar a un veterano; se le puede hablar una vez y decide él", async () => {
    const { monthlyRetirementCheck } = await import("../src");
    const w = clone(base);
    const vets = Object.values(w.players).filter((p) => p.clubId && exactAge(p.birthDay, w.meta.today) >= 31).slice(0, 60);
    const day = monthDay(w, 1);
    for (const p of vets) p.injury = { kind: "match", since: (day - 5) as GameDay, until: (day + 200) as GameDay };
    monthlyRetirementCheck(w, day);
    const doubting = vets.filter((p) => p.retirementIntent);
    expect(doubting.length).toBeGreaterThan(10);
    const p = doubting[0]!;
    expect(applyCommand(w, { type: "persuadeRetirement", player: p.id, approach: "support" })).toEqual({ ok: true });
    expect(applyCommand(w, { type: "persuadeRetirement", player: p.id, approach: "club" })).toEqual({ ok: false, error: "error.alreadyTalked" });
    monthlyRetirementCheck(w, (p.retirementIntent!.decideBy + 1) as GameDay);
    expect(p.retirementIntent).toBeUndefined();
    const decision = w.events.find((e) => e.type === "player.retirementDecision" && e.data.player === p.id)!;
    expect(decision.data.approach).toBe("support");
    expect(["retire", "stay"]).toContain(decision.data.decision);
    if (decision.data.decision === "retire") expect(p.retiring).toBe(true);
  });
});
