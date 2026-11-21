// Polémicas arbitrales con evidencia y memoria del colectivo arbitral (DISEÑO §11.4).
// Las polémicas se deciden después del partido, con su propio stream de azar a partir de lo que
// pasó en él: nunca cambian el resultado. El colectivo recuerda las críticas, pero un árbitro
// jamás pita en contra de nadie por venganza: la tensión solo endurece sus actas.

import { CONTROVERSY_P, CORRECT_P, TENSION_MONTHLY_DECAY } from "../config/media";
import type { MatchReport } from "../match/types";
import type { Rng } from "../rng/rng";
import type { World } from "../types/domain";
import type { ClubId, PlayerId, StaffId } from "../types/ids";
import type { Clarity, Controversy, RefereeMemory } from "../types/media";
import { clamp, round } from "../util/math";

/** Memoria del colectivo arbitral sobre un club respecto a un árbitro. */
export function refereeMemory(world: World, referee: StaffId, club: ClubId): RefereeMemory {
  const key = `${referee}|${club}`;
  return (world.media.referees[key] ??= { tension: 0, criticisms: 0, harmed: 0 });
}

export function addTension(world: World, referee: StaffId, club: ClubId, delta: number): RefereeMemory {
  const m = refereeMemory(world, referee, club);
  m.tension = round(clamp(m.tension + delta, 0, 1), 3);
  return m;
}

/** Enfriamiento mensual de las tensiones con los árbitros. */
export function monthlyRefereeCooling(world: World): void {
  for (const key of Object.keys(world.media.referees).sort()) {
    const m = world.media.referees[key]!;
    m.tension = round(m.tension * TENSION_MONTHLY_DECAY, 3);
  }
}

function clarityOf(rng: Rng): Clarity {
  return rng.weighted(["clear", "debatable", "marginal"] as const, (c) => (c === "clear" ? 0.3 : c === "debatable" ? 0.45 : 0.25));
}

/**
 * Jugadas discutibles de un partido: penaltis pitados, rojas, goles con fuera de juego ajustado y
 * penaltis no pitados. Solo se guardan las que dan para discutir (no las claras y bien pitadas).
 */
export function findControversies(report: MatchReport, rng: Rng): Controversy[] {
  const out: Controversy[] = [];
  const add = (minute: number, kind: Controversy["kind"], harmed: 0 | 1, player?: string): void => {
    const clarity = clarityOf(rng);
    const correct = rng.chance(CORRECT_P[clarity]);
    if (clarity === "clear" && correct) return;
    const c: Controversy = { minute, kind, harmed, clarity, correct };
    if (player) c.player = player as PlayerId;
    out.push(c);
  };
  for (const e of report.events) {
    if (e.type === "penaltyAwarded" && rng.chance(CONTROVERSY_P.penaltyGiven)) add(e.minute, "penaltyGiven", (1 - e.side) as 0 | 1, e.player);
    else if (e.type === "red" && e.detail !== "secondYellow" && rng.chance(CONTROVERSY_P.redCard)) add(e.minute, "redCard", e.side, e.player);
    else if (e.type === "goal" && e.detail !== "penalty" && rng.chance(CONTROVERSY_P.offsideGoal)) add(e.minute, "offsideGoal", (1 - e.side) as 0 | 1, e.player);
  }
  // Penalti no pitado: alguna vez por partido, al equipo que más atacó.
  for (const side of [0, 1] as const) {
    if (!rng.chance(CONTROVERSY_P.penaltyDenied * Math.min(1.5, (report.stats[side]?.shots ?? 8) / 10))) continue;
    const attackers = report.players.filter((l) => l.side === side && l.minutes > 0);
    const who = attackers.length ? rng.pick(attackers).id : undefined;
    add(rng.int(5, 90), "penaltyDenied", side, who);
  }
  out.sort((a, b) => a.minute - b.minute || a.kind.localeCompare(b.kind));
  return out;
}
