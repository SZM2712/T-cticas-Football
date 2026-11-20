// Relevo generacional al cerrar cada temporada: retiradas, subida de canteranos y
// ajuste de plantillas. Mantiene el mundo vivo y estable durante décadas (DISEÑO §4.3).

import { nationByCode } from "@tf/data";
import { POSITION_WEIGHTS, SQUAD_TEMPLATE, type Position } from "../config/attributes";
import { ELITE_BAND, ELITE_NUDGE_MAX, ELITE_CONTROL_GAIN, ELITE_EXIT_BY_AGE, NEAR_ELITE_GROWTH, NEAR_ELITE_SLACK, WONDERKID_AGE, WONDERKID_CA, WONDERKID_CEILING, WONDERKIDS_PER_YEAR, NEAR_ELITE_MARGIN, NEAR_ELITE_MAX_AGE, ELITE_CA, ELITE_INFLOW_PER_YEAR, ELITE_TARGET_SHARE, INTAKE_AGE, INTAKE_EXTRA, INTAKE_GAP_EXTRA, INTAKE_GAP_SD, INTAKE_OFFSET, MAX_CEILING, RETIRE_CURVE, SQUAD_MAX } from "../config/development";
import { SHADOW_SQUAD_SIZE, YOUTH_CA_PENALTY } from "../config/generation";
import { generatePlayer } from "../gen/player";
import { invalidateAbilityCache, invalidatePlayerAbility } from "../match/lineup";
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
  // Niños prodigio: unos pocos por temporada, más probables en las mejores canteras.
  const playable = Object.values(world.clubs).filter((c) => c.leagueId).sort((a, b) => a.id.localeCompare(b.id));
  const wrng = rng.fork("wonderkids");
  for (let i = 0; i < WONDERKIDS_PER_YEAR && playable.length; i++) {
    const club = wrng.weighted(playable, (c) => c.facilities.youth ** 2 + 0.05);
    const position = wrng.pick(Object.keys(templateFor(club)) as Position[]);
    const kid = promoteYouth(world, club, position, day, wrng.int(WONDERKID_AGE[0], WONDERKID_AGE[1]), root, wrng.fork(`kid${i}`), true);
    intake.push(kid);
    summary.promoted++;
    world.events.push({ day, type: "player.prodigy", data: { player: kid.id, club: club.id } });
  }
  // Oferta de élite: un cupo de cracks por promoción y una "generación que viene" cuyo tamaño
  // se corrige según lo lejos que esté la élite actual de su cuota mundial.
  limitEliteCeilings(intake, ELITE_INFLOW_PER_YEAR, rng.fork("elite"));
  limitEliteCeilings(Object.values(world.players).filter((p) => !p.retired), elitePipelineSize(world), rng.fork("pipeline"));
  steerNearElite(world, rng.fork("near"));
  invalidateAbilityCache();
  nudgeEliteBand(world, day);
  invalidateAbilityCache();
  return summary;
}

/**
 * Élite actual, objetivo y salidas previstas en los próximos años (los cracks veteranos dejarán
 * de serlo pronto: así el control se anticipa a las olas de edad).
 */
function eliteStatus(world: World): { elite: number; target: number; exits: number } {
  const day = world.meta.today;
  let withClub = 0;
  let elite = 0;
  let exits = 0;
  for (const p of Object.values(world.players)) {
    if (p.retired || !p.clubId) continue;
    withClub++;
    if (currentAbility(p) < ELITE_CA) continue;
    elite++;
    exits += curve(ELITE_EXIT_BY_AGE, ageOn(p.birthDay, day));
  }
  return { elite, target: Math.max(1, withClub * ELITE_TARGET_SHARE), exits };
}

/**
 * Último ajuste de la élite al cerrar la temporada, solo si está fuera de ±ELITE_BAND del objetivo
 * y sobre jugadores que ya están en el límite (a menos de ELITE_NUDGE_MAX de ELITE_CA):
 * - si sobran, a los veteranos de élite más mayores les pasa factura la edad;
 * - si faltan, los jóvenes que se quedaron a las puertas tienen una temporada de explosión.
 * El cambio es pequeño y queda en el registro de eventos (la prensa lo contará en la Fase 5).
 */
export function nudgeEliteBand(world: World, day: GameDay): void {
  const { elite, target } = eliteStatus(world);
  const hi = Math.floor(target * (1 + ELITE_BAND));
  const lo = Math.ceil(target * (1 - ELITE_BAND));
  const club = Object.values(world.players).filter((p) => !p.retired && p.clubId);
  const shift = (p: Player, delta: number) => {
    // Sumar delta a todos los atributos que pesan en su posición mueve su CA exactamente delta.
    const w = POSITION_WEIGHTS[p.position];
    for (const g of ["technical", "mental", "physical", "goalkeeping"] as const) {
      const grp = p[g] as Record<string, number>;
      for (const a of Object.keys(grp)) if ((w as Record<string, number | undefined>)[a]) grp[a] = round(clamp(grp[a]! + delta, 1, 20), 3);
    }
    invalidatePlayerAbility(p);
  };
  if (elite > hi) {
    const vets = club
      .map((p) => ({ p, ca: currentAbility(p), age: ageOn(p.birthDay, day) }))
      .filter((x) => x.ca >= ELITE_CA && x.ca < ELITE_CA + ELITE_NUDGE_MAX && x.age >= 27)
      .sort((a, b) => b.age - a.age || a.ca - b.ca || a.p.id.localeCompare(b.p.id))
      .slice(0, elite - hi);
    for (const { p, ca } of vets) {
      shift(p, ELITE_CA - 0.05 - ca);
      world.events.push({ day, type: "player.agingToll", data: { player: p.id } });
    }
  } else if (elite < lo) {
    const kids = club
      .map((p) => ({ p, ca: currentAbility(p), age: ageOn(p.birthDay, day) }))
      .filter((x) => x.ca < ELITE_CA && x.ca >= ELITE_CA - ELITE_NUDGE_MAX && x.age <= NEAR_ELITE_MAX_AGE && !x.p.development.prodigy)
      .sort((a, b) => b.ca - a.ca || a.p.id.localeCompare(b.p.id))
      .slice(0, lo - elite);
    for (const { p, ca } of kids) {
      shift(p, ELITE_CA + 0.05 - ca);
      p.development.latentCeiling = Math.max(p.development.latentCeiling, round(ELITE_CA + NEAR_ELITE_MARGIN, 3));
      world.events.push({ day, type: "player.breakthrough", data: { player: p.id } });
    }
  }
}

/** Jóvenes con techo de élite que aún no han llegado (la "generación que viene"). */
function pipelineOf(world: World): Player[] {
  return Object.values(world.players).filter((p) => !p.retired && p.development.latentCeiling >= ELITE_CA && currentAbility(p) < ELITE_CA);
}

/**
 * Tamaño de la "generación que viene" (sin contar prodigios): se controla el total de cracks y
 * futuros cracks, ELITE_TARGET_SHARE × (1 + ELITE_PIPELINE_RATIO). Si hoy sobran cracks, la
 * generación que viene se encoge en el acto, sin esperar a que pasen los años.
 */
export function elitePipelineSize(world: World): number {
  const { elite, target, exits } = eliteStatus(world);
  const prodigies = pipelineOf(world).filter((p) => p.development.prodigy).length;
  return Math.max(0, Math.round(ELITE_CONTROL_GAIN * (target - elite) + exits - prodigies));
}

/**
 * Prodigios del mundo inicial: los jóvenes (≤ 18) con más nivel para su edad de los clubes
 * jugables reciben techo de estrella. Se llama al generar, después del cupo de élite.
 */
export function seedWonderkids(world: World, n: number, rng: ReturnType<typeof worldRng>): void {
  const day = world.meta.today;
  const kids = Object.values(world.players)
    .filter((p) => !p.retired && p.clubId && world.clubs[p.clubId]?.leagueId && ageOn(p.birthDay, day) <= 18)
    .map((p) => ({ p, score: currentAbility(p) + 0.8 * (18 - ageOn(p.birthDay, day)) }))
    .sort((a, b) => b.score - a.score || a.p.id.localeCompare(b.p.id))
    .slice(0, n);
  for (const { p } of kids) {
    p.development.latentCeiling = round(Math.max(p.development.latentCeiling, rng.range(WONDERKID_CEILING[0], WONDERKID_CEILING[1])), 3);
    p.development.prodigy = true;
  }
}

/**
 * Si faltan cracks y futuros cracks, los jóvenes con mejor proyección (por su nivel y su edad
 * llegarían pronto) reciben techo de élite. Determinista: orden por proyección e id.
 */
export function steerNearElite(world: World, rng: ReturnType<typeof worldRng>): void {
  const { elite, target, exits } = eliteStatus(world);
  const deficit = Math.round(ELITE_CONTROL_GAIN * (target - elite) + exits - pipelineOf(world).length);
  if (deficit <= 0) return;
  const day = world.meta.today;
  const readyAt = ELITE_CA + NEAR_ELITE_MARGIN;
  const candidates = Object.values(world.players)
    .filter((p) => !p.retired && p.clubId && !p.development.prodigy && p.development.latentCeiling < ELITE_CA && ageOn(p.birthDay, day) <= NEAR_ELITE_MAX_AGE)
    .map((p) => ({ p, projected: currentAbility(p) + curve(NEAR_ELITE_GROWTH, ageOn(p.birthDay, day)) }))
    .filter((x) => x.projected >= ELITE_CA - NEAR_ELITE_SLACK)
    .sort((a, b) => b.projected - a.projected || a.p.id.localeCompare(b.p.id));
  for (const { p } of candidates.slice(0, deficit)) p.development.latentCeiling = round(readyAt + rng.float() * 0.6, 3);
}

/**
 * Cupo de talento de élite: de los jugadores dados (aún por debajo de la élite), solo los
 * `allowed` con mayor techo lo conservan por encima de ELITE_CA; el resto se recorta justo
 * por debajo (seguirán siendo muy buenos). Determinista: orden por techo y por id.
 */
export function limitEliteCeilings(players: Player[], allowed: number, rng: ReturnType<typeof worldRng>): void {
  const candidates = players
    .filter((p) => p.development.latentCeiling >= ELITE_CA && currentAbility(p) < ELITE_CA && !p.development.prodigy)
    .sort((a, b) => b.development.latentCeiling - a.development.latentCeiling || a.id.localeCompare(b.id));
  for (const p of candidates.slice(allowed)) {
    p.development.latentCeiling = round(ELITE_CA - 0.4 - rng.float() * 0.8, 3);
  }
}

/** Sube un canterano al primer equipo con la calidad de la cantera del club. */
function promoteYouth(
  world: World, club: Club, position: Position, day: GameDay, age: number, root: ReturnType<typeof worldRng>,
  rng: ReturnType<typeof worldRng>,
  prodigy = false,
): Player {
  const id = nextId<PlayerId>(world, "pl");
  const youth = club.facilities.youth;
  const agePenalty = Math.max(0, 22 - age) * YOUTH_CA_PENALTY;
  const targetCA = prodigy
    ? rng.range(WONDERKID_CA[0], WONDERKID_CA[1])
    : clamp(club.quality + INTAKE_OFFSET - agePenalty + rng.normal(0, 0.7) + (youth - 0.5), 3, 16);
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
  if (prodigy) {
    p.development.latentCeiling = round(Math.max(currentAbility(p) + 3, rng.range(WONDERKID_CEILING[0], WONDERKID_CEILING[1])), 3);
    p.development.prodigy = true;
  }
  p.fitnessDay = day;
  world.players[id] = p;
  club.squad.push(id);
  return p;
}
