import { NATIONS } from "@tf/data";
import { describe, expect, it } from "vitest";
import { ENTRIES } from "../src/catalog";
import { LOCALES, competitionName, nationName, t } from "../src";

describe("i18n", () => {
  it("ninguna clave falta en ningún idioma", () => {
    for (const [key, row] of Object.entries(ENTRIES)) {
      expect(row.length, key).toBe(LOCALES.length);
      for (const text of row) expect(text.trim().length, key).toBeGreaterThan(0);
    }
  });

  it("todas las naciones tienen nombre en los 5 idiomas", () => {
    for (const locale of LOCALES) {
      for (const n of NATIONS) {
        const name = nationName(locale, n.code);
        expect(name, `${locale}:${n.code}`).not.toBe(n.code);
      }
    }
    expect(nationName("es", "GB-ENG")).toBe("Inglaterra");
    expect(nationName("zh", "FR")).toBe("法国");
  });

  it("nombres de competición sin claves sin traducir", () => {
    const keys = [
      "comp.league.GB-ENG.1", "comp.league.DE.2", "comp.cup.ES", "comp.promotionPlayoff.IT", "comp.relegationPlayoff.FR",
      "comp.continental.1", "comp.worldCup", "comp.euro", "comp.nationsLeague.EUR.3", "comp.nationsLeagueFinals.NCA",
      "comp.qualifier.worldCup.AFR", "comp.qualifier.euro.EUR", "comp.friendly", "comp.afcon",
    ];
    for (const locale of LOCALES) {
      for (const key of keys) {
        const name = competitionName(locale, key);
        expect(name, `${locale}:${key}`).not.toMatch(/comp\.|\{|undefined/);
      }
    }
    expect(competitionName("es", "comp.league.GB-ENG.1")).toBe("Primera División de Inglaterra");
    expect(t("de", "pos.ST")).toBe("Mittelstürmer");
  });
});
