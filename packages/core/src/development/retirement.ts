// Retiradas anticipadas: un jugador puede plantearse dejarlo por una lesión grave, por
// motivos personales o por la edad. El técnico puede intentar convencerle; él decide.

import {
  FULL_MINUTES, RETIRE_AGE_MIN, RETIRE_AGE_MINUTES, RETIRE_AGE_MONTHLY, RETIRE_BASE, RETIRE_DECISION_DAYS,
  RETIRE_INJURY_DAYS, RETIRE_INJURY_MIN_AGE, RETIRE_PERSONAL_MONTHLY,
} from "../config/development";
import { coachAuthority } from "../match/lineup";
import type { Rng } from "../rng/rng";
import { dateOf, exactAge } from "../time/calendar";
import type { Player, World } from "../types/domain";
import type { PersuasionApproach, RetirementReason } from "../types/development";
import type { GameDay } from "../types/ids";
import { clamp } from "../util/math";
import { worldRng } from "../world/rng";

/** Retira a un jugador ya mismo (sale de su club). */
export function retireNow(world: World, p: Player): void {
  const club = p.clubId ? world.clubs[p.clubId] : undefined;
  if (club) club.squad = club.squad.filter((id) => id !== p.id);
  p.clubId = null;
  p.contract = null;
  p.retired = true;
  delete p.retiring;
  delete p.retirementIntent;
  delete world.plans[p.id];
}

/**
 * Probabilidad de que se retire tras escuchar (o no) al técnico. Cada enfoque funciona con
 * un tipo de persona y de motivo: la lealtad responde al club, la ambición a un papel
 * importante y las lesiones o los problemas personales al apoyo.
 */
export function retirementChance(p: Player, reason: RetirementReason, approach: PersuasionApproach | undefined, authority: number, age: number): number {
  const ps = p.psych;
  let c = RETIRE_BASE[reason] + 0.03 * (age - 30);
  switch (approach) {
    case "club":
      c -= 0.35 * ps.loyalty;
      break;
    case "role":
      c -= 0.3 * (0.5 * ps.competitiveness + 0.5 * ps.ambition) * (reason === "injury" ? 0.6 : 1);
      break;
    case "support":
      c -= reason === "age" ? 0.1 : 0.35 * (1 - 0.5 * ps.ego);
      break;
    case "accept":
      c += 0.2;
      break;
  }
  if (approach && approach !== "accept") c -= 0.3 * (authority - 0.5);
  return clamp(c, 0.05, 0.95);
}

function consider(world: World, p: Player, reason: RetirementReason, day: GameDay): void {
  p.retirementIntent = { reason, since: day, decideBy: (day + RETIRE_DECISION_DAYS) as GameDay };
  world.events.push({ day, type: "player.consideringRetirement", data: { player: p.id, reason } });
}

/** Revisión mensual: nuevas dudas y decisiones tomadas. */
export function monthlyRetirementCheck(world: World, day: GameDay): void {
  const { y, m } = dateOf(day);
  const root = worldRng(world).fork(`retire/${y}/${m}`);
  for (const p of Object.values(world.players)) {
    if (p.retired || !p.clubId) continue;
    const rng: Rng = root.fork(p.id);
    const age = exactAge(p.birthDay, day);
    const intent = p.retirementIntent;
    if (intent) {
      if (intent.decideBy <= day) decide(world, p, age, day, rng);
      continue;
    }
    if (p.retiring) continue;
    const inj = p.injury;
    if (inj && inj.until - inj.since >= RETIRE_INJURY_DAYS && inj.since > day - 32 && age >= RETIRE_INJURY_MIN_AGE) {
      const chance = 0.2 + 0.08 * (age - RETIRE_INJURY_MIN_AGE) + 0.15 * Math.max(0, (p.development.seriousInjuries ?? 1) - 1);
      if (rng.chance(clamp(chance, 0, 0.8))) consider(world, p, "injury", day);
      continue;
    }
    if (age >= 24 && rng.chance(RETIRE_PERSONAL_MONTHLY * (0.5 + p.psych.insecurity + 0.5 * p.psych.offPitchLife))) {
      consider(world, p, "personal", day);
      continue;
    }
    if (age >= RETIRE_AGE_MIN && p.development.recentMinutes / FULL_MINUTES < RETIRE_AGE_MINUTES && rng.chance(RETIRE_AGE_MONTHLY)) {
      consider(world, p, "age", day);
    }
  }
}

function decide(world: World, p: Player, age: number, day: GameDay, rng: Rng): void {
  const intent = p.retirementIntent!;
  const authority = p.clubId ? coachAuthority(world, p.clubId, p) : 0.5;
  const retire = rng.chance(retirementChance(p, intent.reason, intent.persuasion, authority, age));
  world.events.push({
    day, type: "player.retirementDecision",
    data: { player: p.id, reason: intent.reason, decision: retire ? "retire" : "stay", approach: intent.persuasion ?? "none" },
  });
  delete p.retirementIntent;
  if (!retire) return;
  // Por motivos personales lo deja ya; si no, al terminar la temporada.
  if (intent.reason === "personal") retireNow(world, p);
  else p.retiring = true;
}
