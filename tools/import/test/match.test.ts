import { NATION_LEAGUES, mergeLeagues } from "@tf/data";
import { describe, expect, it } from "vitest";
import { buildImport, estimateRating, matchClub, nationCode, positionCode, allKnownClubs } from "../src/match";

describe("importación football-data (sin red)", () => {
  it("reconoce nombres de club de la API", () => {
    const clubs = allKnownClubs();
    const m = (n: string) => matchClub(n, clubs)?.n;
    expect(m("Real Madrid CF")).toBe("Real Madrid");
    expect(m("FC Bayern München")).toBe("Bayern München");
    expect(m("Bayer 04 Leverkusen")).toBe("Bayer Leverkusen");
    expect(m("Lille OSC")).toBe("LOSC Lille");
    expect(m("FC Internazionale Milano")).toBe("Inter");
    expect(m("RCD Espanyol de Barcelona")).toBe("Espanyol");
    expect(m("Club Atlético de Madrid")).toBe("Atlético de Madrid");
    expect(m("Brighton & Hove Albion FC")).toBe("Brighton & Hove Albion");
    expect(m("Racing Club de Lens")).toBe("RC Lens");
    expect(m("Club Inexistente de Nada")).toBeUndefined();
  });

  it("traduce nacionalidades y posiciones", () => {
    expect(nationCode("England")).toBe("GB-ENG");
    expect(nationCode("Spain")).toBe("ES");
    expect(nationCode("Korea Republic")).toBe("KR");
    expect(nationCode("Côte d'Ivoire")).toBe("CI");
    expect(positionCode("Centre-Back")).toBe("CB");
    expect(positionCode("Offence")).toBe("ST");
    expect(estimateRating(16, 19, "ST")).toBeLessThan(estimateRating(16, 26, "ST"));
  });

  it("conserva niveles conocidos, estima los nuevos y actualiza la liga", () => {
    const { update, players, report } = buildImport(
      [{
        source: { code: "PD", nation: "ES", tier: 1 },
        teams: [
          { name: "Real Madrid CF", squad: [
            { name: "Kylian Mbappé", position: "Centre-Forward", dateOfBirth: "1998-12-20", nationality: "France" },
            { name: "Nuevo Fichaje", position: "Left Winger", dateOfBirth: "2004-03-01", nationality: "Brazil" },
          ] },
          { name: "Club Recién Ascendido", clubColors: "Green / White", squad: [] },
        ],
      }],
      "2026/27",
      new Date("2026-10-11T00:00:00Z"),
    );
    const mbappe = players.find((p) => p.name === "Kylian Mbappé")!;
    expect(mbappe.rating).toBe(18.8);
    expect(mbappe.estimated).toBeUndefined();
    const nuevo = players.find((p) => p.name === "Nuevo Fichaje")!;
    expect(nuevo.estimated).toBe(true);
    expect(report.clubsNew).toEqual(["Club Recién Ascendido"]);
    expect(update.leagues[0]!.clubs.map((c) => c.n)).toContain("Club Recién Ascendido");
    // Messi (Inter Miami no se importó) se conserva; Vinícius (Real Madrid sí) figura como "no encontrado".
    expect(players.some((p) => p.name === "Lionel Messi")).toBe(true);
    expect(report.missing.some((m) => m.includes("Vinícius"))).toBe(true);
  });

  it("al cambiar la 1.ª división, la 2.ª se deduce manteniendo los tamaños", () => {
    const base = mergeLeagues(undefined).leagues;
    const es = base.ES!;
    // Simula: baja Real Oviedo, sube UD Las Palmas.
    const t1 = [...es.tier1.filter((c) => c.n !== "Real Oviedo"), es.tier2.find((c) => c.n === "UD Las Palmas")!];
    const { leagues, warnings } = mergeLeagues({ source: "test", importedAt: "", season: "2026/27", leagues: [{ nation: "ES", tier: 1, clubs: t1 }] });
    const data = NATION_LEAGUES.find((d) => d.nation === "ES")!;
    expect(leagues.ES!.tier1.length).toBe(data.tiers[0].teams);
    expect(leagues.ES!.tier2.length).toBe(data.tiers[1].teams);
    expect(leagues.ES!.tier2.map((c) => c.n)).toContain("Real Oviedo");
    expect(leagues.ES!.tier2.map((c) => c.n)).not.toContain("UD Las Palmas");
    expect(warnings.join(" ")).toMatch(/deducida/);
  });
});
