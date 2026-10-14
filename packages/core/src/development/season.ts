// Relevo generacional al cerrar cada temporada: retiradas, subida de canteranos y
// ajuste de plantillas. Mantiene el mundo vivo y estable durante décadas (DISEÑO §4.3).

import { nationByCode } from "@tf/data";
import { SQUAD_TEMPLATE, type Position } from "../config/attributes";
import { ELITE_CA, ELITE_FEEDBACK, ELITE_INFLOW_PER_YEAR, ELITE_PIPELINE_START, ELITE_TARGET_SHARE, INTAKE_AGE, INTAKE_EXTRA, INTAKE_GAP_EXTRA, INTAKE_GAP_SD, INTAKE_OFFSET, MAX_CEILING, RETIRE_CURVE, SQUAD_MAX } from "../config/development";
import { SHADOW_SQUAD_SIZE, YOUTH_CA_PENALTY } from "../config/generation";
import { generatePlayer } from "../gen/player";
import { invalidateAbilityCache } from "../match/lineup";
import { currentAbility } from "../player/ability";
import { ageOn, dateOf, dayOf } from "../time/calendar";
import type { Club, Player, World } from "../types/domain";
import type { GameDay, PlayerId } from "../types/ids";
import { clamp, round } from "../util/math";
import { nextId } from "../world/ids";
import { worldRng } from "../world/rng";
import { retireNow } from "./retirement";
import { curve } from "./tick";

export interface TurnoverSummary {
  retired: number;
  promoted: number;
  released: number;
}

function removeFromClub(world: World, p: Player): void {
  const club = p.clubId ? world.clubs[p.clubId] : undefined;
  if (club) club.squad = club.squad.filter((id) => id !== p.id);
  p.clubId = null;
  p.contract = null;
}

/** Composición objetivo de la plantilla de un club (los clubes en sombra tienen menos jugadores). */
function templateFor(club: Club): Record<Position, number> {
  if (club.leagueId) return SQUAD_TEMPLATE;
  const out = {} as Record<Position, number>;
  for (const [pos, n] of Object.entries(SQUAD_TEMPLATE) as [Position, number][]) out[pos] = Math.max(1, Math.round((n * SHADOW_SQUAD_SIZE) / 29));
  return out;
}

export function seasonTurnover(world: World, season: number): TurnoverSummary {
  const day = world.meta.today as GameDay;
  const root = worldRng(world);
  const rng = root.fork(`turnover/${season}`);
  const summary: TurnoverSummary = { retired: 0, promoted: 0, released: 0 };

  // CA de cierre de temporada (para las gráficas de evolución).
  for (const p of Object.values(world.players)) {
    if (!p.retired) p.development.caYearly.push(Math.round(currentAbility(p) * 10));
  }

  // 1) Retiradas: la edad manda; pesan también no tener club o haberse quedado atrás.
  for (const p of Object.values(world.players)) {
    if (p.retired) continue;
    const age = ageOn(p.birthDay, day);
    // Quien anunció su retirada durante la temporada se va ahora.
    if (p.retiring) {
      retireNow(world, p);
      summary.retired++;
      world.events.push({ day, type: "player.retired", data: { player: p.id, age } });
      continue;
    }
    // Quien aún está decidiendo no se retira por la curva de edad: decide él.
    if (p.retirementIntent) continue;
    let chance = curve(RETIRE_CURVE, age - (p.position === "GK" ? 2 : 0));
    if (chance <= 0 && p.clubId) continue;
    const club = p.clubId ? world.clubs[p.clubId] : undefined;
    if (!club) chance = Math.max(chance, age >= 24 ? 0.25 : 0.05) * 1.5;
    else if (currentAbility(p) < club.quality - 2.5) chance *= 1.4;
    chance *= 1.2 - 0.4 * p.psych.professionalism;
    if (!rng.chance(clamp(chance, 0, 1))) continue;
    retireNow(world, p);
    summary.retired++;
    if (p.reputation >= 0.5) world.events.push({ day, type: "player.retired", data: { player: p.id, age } });
  }

  // 2) Plantillas: los canteranos cubren los huecos por puesto (y algunos más en los clubes jugables).
  const intake: Player[] = [];
  for (const club of Object.values(world.clubs)) {
    const crng = rng.fork(club.id);
    const template = templateFor(club);
    const count = {} as Record<Position, number>;
    for (const id of club.squad) {
      const p = world.players[id];
      if (p) count[p.position] = (count[p.position] ?? 0) + 1;
    }
    const needs: Position[] = [];
    for (const [pos, n] of Object.entries(template) as [Position, number][]) {
      for (let i = count[pos] ?? 0; i < n; i++) needs.push(pos);
    }
    if (club.leagueId) for (let i = 0; i < INTAKE_EXTRA; i++) needs.push(crng.pick(Object.keys(template) as Position[]));
    for (const position of needs) {
      intake.push(promoteYouth(world, club, position, day, crng.int(INTAKE_AGE[0], INTAKE_AGE[1]), root, crng));
      summary.promoted++;
    }
    // 3) Plantilla demasiado larga: salen los más flojos ya formados (quedan libres).
    if (club.squad.length > SQUAD_MAX) {
      const surplus = club.squad
        .map((id) => world.players[id]!)
        .filter((p) => ageOn(p.birthDay, day) >= 24)
        .sort((a, b) => currentAbility(a) - currentAbility(b) || a.id.localeCompare(b.id))
        .slice(0, club.squad.length - SQUAD_MAX);
      for (const p of surplus) {
        removeFromClub(world, p);
        summary.released++;
      }
    }
  }
  // Oferta de élite: un cupo de cracks por promoción y una "generación que viene" cuyo tamaño
  // se corrige según lo lejos que esté la élite actual de su cuota mundial.
  limitEliteCeilings(intake, ELITE_INFLOW_PER_YEAR, rng.fork("elite"));
  limitEliteCeilings(Object.values(world.players).filter((p) => !p.retired), elitePipelineSize(world), rng.fork("pipeline"));
  invalidateAbilityCache();
  return summary;
}

/** Tamaño de la "generación que viene" esta temporada (realimentación sobre la élite actual). */
export function elitePipelineSize(world: World): number {
  let withClub = 0;
  let elite = 0;
  for (const p of Object.values(world.players)) {
    if (p.retired || !p.clubId) continue;
    withClub++;
    if (currentAbility(p) >= ELITE_CA) elite++;
  }
  const target = Math.max(1, withClub * ELITE_TARGET_SHARE);
  const scale = 1 + ELITE_FEEDBACK * (target - elite) / target;
  return Math.round(clamp(ELITE_PIPELINE_START * scale, 0, 3 * ELITE_PIPELINE_START));
}

/**
 * Cupo de talento de élite: de los jugadores dados (aún por debajo de la élite), solo los
 * `allowed` con mayor techo lo conservan por encima de ELITE_CA; el resto se recorta justo
 * por debajo (seguirán siendo muy buenos). Determinista: orden por techo y por id.
 */
export function limitEliteCeilings(players: Player[], allowed: number, rng: ReturnType<typeof worldRng>): void {
  const candidates = players
    .filter((p) => p.development.latentCeiling >= ELITE_CA && currentAbility(p) < ELITE_CA)
    .sort((a, b) => b.development.latentCeiling - a.development.latentCeiling || a.id.localeCompare(b.id));
  for (const p of candidates.slice(allowed)) {
    p.development.latentCeiling = round(ELITE_CA - 0.1 - rng.float() * 0.8, 3);
  }
}

/** Sube un canterano al primer equipo con la calidad de la cantera del club. */
function promoteYouth(
  world: World, club: Club, position: Position, day: GameDay, age: number, root: ReturnType<typeof worldRng>,
  rng: ReturnType<typeof worldRng>,
): Player {
  const id = nextId<PlayerId>(world, "pl");
  const youth = club.facilities.youth;
  const agePenalty = Math.max(0, 22 - age) * YOUTH_CA_PENALTY;
  const targetCA = clamp(club.quality + INTAKE_OFFSET - agePenalty + rng.normal(0, 0.7) + (youth - 0.5), 3, 16);
  const p = generatePlayer(rng.fork(id), root, {
    id,
    nation: nationByCode(club.nation),
    position,
    targetCA,
    age,
    today: day,
    clubId: club.id,
    homegrown: true,
    youthQuality: youth,
  });
  const { y } = dateOf(day);
  p.contract = {
    clubId: club.id,
    wage: Math.max(250, Math.round(club.finances.revenue * 2) * 10),
    expires: dayOf(y + 3, 6, 30),
    signed: day,
    squadStatus: "prospect",
  };
  p.reputation = round(clamp(0.7 * p.reputation + 0.3 * club.reputation * 0.5, 0, 1), 3);
  // Techo del canterano: el dial principal de la oferta de talento (anti-inflación).
  const gap = Math.max(0, rng.normal(agePenalty + INTAKE_GAP_EXTRA * (0.6 + 0.8 * youth), INTAKE_GAP_SD));
  p.development.latentCeiling = round(Math.min(MAX_CEILING, currentAbility(p) + gap), 3);
  p.fitnessDay = day;
  world.players[id] = p;
  club.squad.push(id);
  return p;
}
