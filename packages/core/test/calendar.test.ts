import { describe, expect, it } from "vitest";
import { ageOn, dateOf, dayOf, formatDate, nextWeekday, seasonYearOf, SAT, weekday, WED } from "../src";

describe("calendario", () => {
  it("ida y vuelta fecha civil ↔ GameDay en 200 años", () => {
    for (let d: number = dayOf(1950, 1, 1); d < dayOf(2150, 1, 1); d += 17) {
      const { y, m, d: dd } = dateOf(d);
      expect(dayOf(y, m, dd)).toBe(d);
    }
  });

  it("días de la semana conocidos", () => {
    expect(weekday(dayOf(2000, 1, 1))).toBe(SAT);
    expect(weekday(dayOf(2026, 7, 1))).toBe(WED);
    expect(formatDate(nextWeekday(dayOf(2026, 7, 1), SAT))).toBe("2026-07-04");
  });

  it("años bisiestos", () => {
    expect(dayOf(2028, 3, 1) - dayOf(2028, 2, 28)).toBe(2);
    expect(dayOf(2100, 3, 1) - dayOf(2100, 2, 28)).toBe(1);
  });

  it("edad cumplida", () => {
    const birth = dayOf(2000, 7, 15);
    expect(ageOn(birth, dayOf(2026, 7, 14))).toBe(25);
    expect(ageOn(birth, dayOf(2026, 7, 15))).toBe(26);
  });

  it("temporada de julio a junio", () => {
    expect(seasonYearOf(dayOf(2026, 7, 1))).toBe(2026);
    expect(seasonYearOf(dayOf(2027, 6, 30))).toBe(2026);
  });
});
