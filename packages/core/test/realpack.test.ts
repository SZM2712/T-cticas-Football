import { NATION_LEAGUES, REAL_COMPETITION_NAMES, REAL_LEAGUES, REAL_PLAYERS, realPlayersFromCsv, realPlayersToCsv } from "@tf/data";
import { describe, expect, it } from "vitest";
import { displayName, generateWorld, hashValue, teamRating } from "../src";
import { validateRealPlayers } from "../src/gen/realPlayers";

describe("paquete opcional de clubes reales", () => {
  const world = generateWorld({ seed: 123, dataPack: "real" });

  it("las ligas tienen exactamente los clubes reales de cada división", () => {
    for (const data of NATION_LEAGUES) {
      const pack = REAL_LEAGUES[data.nation]!;
      const [t1, t2] = Object.values(world.leagues).filter((l) => l.nation === data.nation).sort((a, b) => a.tier - b.tier);
      expect(t1!.clubs.map((id) => world.clubs[id]!.name).sort()).toEqual(pack.tier1.map((c) => c.n).sort());
      expect(t2!.clubs.map((id) => world.clubs[id]!.name).sort()).toEqual(pack.tier2.map((c) => c.n).sort());
    }
  });

  it("los grandes son los más fuertes de su liga", () => {
    const best = (nation: string) => {
      const league = Object.values(world.leagues).find((l) => l.nation === nation && l.tier === 1)!;
      return league.clubs.map((id) => ({ name: world.clubs[id]!.name, r: teamRating(world, id) })).sort((a, b) => b.r - a.r).slice(0, 4).map((x) => x.name);
    };
    expect(best("ES")).toContain("Real Madrid");
    expect(best("DE")).toContain("Bayern München");
    expect(best("FR")).toContain("Paris Saint-Germain");
    expect(best("GB-ENG").some((n) => ["Liverpool", "Arsenal", "Manchester City"].includes(n))).toBe(true);
  });

  it("las ligas y copas de las naciones jugables tienen su nombre oficial", () => {
    for (const l of Object.values(world.leagues)) if (NATION_LEAGUES.some((n) => n.nation === l.nation)) expect(REAL_COMPETITION_NAMES[`comp.league.${l.nation}.${l.tier}`], l.id).toBeTruthy();
    for (const n of NATION_LEAGUES) expect(REAL_COMPETITION_NAMES[`comp.cup.${n.nation}`], n.nation).toBeTruthy();
  });

  it("es determinista y no altera el mundo ficticio por defecto", () => {
    expect(hashValue(generateWorld({ seed: 123, dataPack: "real" }))).toBe(hashValue(world));
    expect(world.meta.dataPack).toBe("real");
    expect(generateWorld({ seed: 123 }).meta.dataPack).toBeUndefined();
  });
});


describe("jugadores reales", () => {
  const world = generateWorld({ seed: 123, dataPack: "real" });
  const names = new Set(Object.values(world.players).map((p) => displayName(p)));

  it("el pack embebido no tiene errores y cubre los 98 clubes de primera", () => {
    expect(validateRealPlayers(REAL_PLAYERS)).toEqual([]);
    const clubs = new Set(REAL_PLAYERS.map((r) => r.club));
    for (const data of NATION_LEAGUES) for (const c of REAL_LEAGUES[data.nation]!.tier1) expect(clubs.has(c.n), c.n).toBe(true);
  });

  it("todos los jugadores del pack existen en su club con su nombre", () => {
    for (const r of REAL_PLAYERS) expect(names.has(r.knownAs ?? r.name), r.name).toBe(true);
  });

  it("las selecciones convocan a sus estrellas reales", () => {
    const squad = (code: string) => world.nationalTeams[`nt_${code}`]!.squad.map((id) => displayName(world.players[id]!));
    expect(squad("ES")).toContain("Lamine Yamal");
    expect(squad("FR")).toContain("Kylian Mbappé");
    expect(squad("AR")).toContain("Lionel Messi");
    expect(squad("PT")).toContain("Cristiano Ronaldo");
    expect(squad("NO")).toContain("Erling Haaland");
  });

  it("CSV: exportar e importar conserva los datos", () => {
    const { records, errors } = realPlayersFromCsv(realPlayersToCsv(REAL_PLAYERS));
    expect(errors).toEqual([]);
    expect(records).toEqual(REAL_PLAYERS);
  });

  it("un CSV con errores se rechaza con mensajes claros", () => {
    const bad = "club,name,position,birth_year,nation,rating\nClub Inventado,Juan Pérez,XX,1999,ZZ,25\n";
    const { records } = realPlayersFromCsv(bad);
    const errors = validateRealPlayers(records);
    expect(errors.join(" ")).toMatch(/club desconocido/);
    expect(errors.join(" ")).toMatch(/posición desconocida/);
    expect(errors.join(" ")).toMatch(/nación desconocida/);
  });
});
