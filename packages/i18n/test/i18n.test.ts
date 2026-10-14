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

describe("i18n del motor de partido", () => {
  it("todo tipo de evento, instrucción y rutina de balón parado tiene texto", async () => {
    const { INSTRUCTION_KEYS } = await import("@tf/core");
    const events = [
      "kickoff", "goal", "ownGoal", "shotSaved", "shotOff", "shotBlocked", "woodwork", "foul", "penaltyAwarded", "yellow",
      "red", "corner", "sub", "injury", "halfTime", "fullTime", "extraTime", "shootout", "penaltyScored", "penaltyMissed",
    ];
    const keys = [
      ...events.map((e) => `event.${e}`),
      ...INSTRUCTION_KEYS.map((k) => `instruction.${k}`),
      ...["nearPost", "farPost", "short", "edgeOfBox"].map((k) => `corners.${k}`),
      ...["stay", "some", "all"].map((k) => `crowd.${k}`),
      ...["shoot", "cross", "short"].map((k) => `freeKicks.${k}`),
      ...["short", "long"].map((k) => `throwIns.${k}`),
      ...["buildUp", "long"].map((k) => `kickoff.${k}`),
      ...["unknownTeam", "formation", "lineup", "range", "setPiece", "taker", "instruction"].map((k) => `error.${k}`),
    ];
    for (const key of keys) expect(ENTRIES[key], key).toBeDefined();
  });
});

describe("i18n del desarrollo", () => {
  it("planes, adherencia, factores y ojeadores tienen texto", async () => {
    const core = await import("@tf/core");
    const keys = [
      ...core.TRAINING_FOCUSES.map((k) => `focus.${k}`),
      ...core.INTENSITIES.map((k) => `intensity.${k}`),
      ...core.DIETS.map((k) => `diet.${k}`),
      ...core.EXERCISES.map((k) => `exercise.${k}`),
      ...core.SLEEP_PLANS.map((k) => `sleep.${k}`),
      ...["full", "partial", "none"].map((k) => `adherence.${k}`),
      ...["low", "medium", "high"].map((k) => `confidence.${k}`),
      ...["age", "minutes", "training", "attitude", "plan.training", "plan.diet", "plan.exercise", "plan.sleep", "mentor", "decline", "injury"]
        .flatMap((k) => [`factor.${k}.up`, `factor.${k}.down`]),
      ...["coach", "physio", "nutritionist", "fitnessCoach"].map((k) => `role.${k}`),
    ];
    for (const key of keys) expect(ENTRIES[key], key).toBeDefined();
  });
});
