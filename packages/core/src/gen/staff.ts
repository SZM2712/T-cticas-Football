// Staff ficticio: entrenadores, ojeadores, fisios, seleccionadores y árbitros.

import type { NationData } from "@tf/data";
import type { Rng } from "../rng/rng";
import type { Staff, StaffRole } from "../types/domain";
import type { ClubId, GameDay, NationId, StaffId } from "../types/ids";
import { clamp, clamp01, round } from "../util/math";
import { generateName, pickCulture } from "./names";
import { generatePsych } from "./psych";
import { dayOf, dateOf } from "../time/calendar";

export interface StaffSpec {
  id: StaffId;
  nation: NationData;
  role: StaffRole;
  clubId: ClubId | null;
  /** Nivel de referencia (escala CA de su club o liga). */
  level: number;
  today: GameDay;
}

const AGE_BY_ROLE: Record<StaffRole, [number, number]> = {
  headCoach: [36, 66], assistant: [32, 62], coach: [28, 62], scout: [26, 68], physio: [26, 60], nutritionist: [26, 60],
  fitnessCoach: [27, 60],
  referee: [27, 45], nationalCoach: [42, 70],
};

/** Rasgo principal de cada rol (recibe el nivel completo; el resto, algo menos). */
const FOCUS: Record<StaffRole, (keyof Staff["attributes"])[]> = {
  headCoach: ["tactics", "manManagement", "motivation", "coaching"],
  assistant: ["coaching", "tactics", "manManagement"],
  coach: ["coaching", "youth", "discipline"],
  scout: ["judgingAbility", "judgingPotential"],
  physio: ["physiotherapy"],
  nutritionist: ["nutrition"],
  fitnessCoach: ["conditioning", "coaching"],
  referee: ["discipline"],
  nationalCoach: ["tactics", "manManagement", "motivation"],
};

export function generateStaff(rng: Rng, spec: StaffSpec): Staff {
  const culture = pickCulture(rng, spec.nation.cultures);
  const name = generateName(rng, culture);
  const [minAge, maxAge] = AGE_BY_ROLE[spec.role];
  const age = rng.int(minAge, maxAge);
  const { y } = dateOf(spec.today);
  const birthDay = (dayOf(y - age - 1, 1, 1) + rng.int(0, 364)) as GameDay;
  const level = spec.level;
  const v = (focus: boolean) => round(clamp(level + (focus ? 1 : -2.5) + rng.normal(0, 2), 1, 20), 2);
  const focus = new Set(FOCUS[spec.role]);
  const attributes: Staff["attributes"] = {
    coaching: v(focus.has("coaching")),
    tactics: v(focus.has("tactics")),
    manManagement: v(focus.has("manManagement")),
    judgingAbility: v(focus.has("judgingAbility")),
    judgingPotential: v(focus.has("judgingPotential")),
    physiotherapy: v(focus.has("physiotherapy")),
    nutrition: v(focus.has("nutrition")),
    conditioning: v(focus.has("conditioning")),
    discipline: v(focus.has("discipline")),
    motivation: v(focus.has("motivation")),
    youth: v(focus.has("youth")),
  };
  if (spec.role === "referee") {
    attributes.refStrictness = round(clamp(rng.normal(11, 3.5), 1, 20), 2);
    attributes.refConsistency = round(clamp(level + rng.normal(0, 2.5), 1, 20), 2);
  }
  const staff: Staff = {
    id: spec.id,
    firstName: name.firstName,
    lastName: name.lastName,
    birthDay,
    nationality: spec.nation.code as NationId,
    languages: spec.nation.languages.map((lang, i) => ({ lang, fluency: i === 0 ? 1 : 0.6 })),
    role: spec.role,
    clubId: spec.clubId,
    attributes,
    psych: generatePsych(rng, age, false).psych,
    reputation: round(clamp01((level - 6) / 13 + rng.normal(0, 0.05)), 3),
  };
  if (spec.role === "scout") staff.scoutBias = round(rng.normal(0, 0.8), 2);
  return staff;
}
