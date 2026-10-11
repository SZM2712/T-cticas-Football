// Proyecciones de solo lectura para la UI. Nunca exponen números ocultos: ni
// atributos ocultos, ni rasgos psicológicos, ni techo latente (regla 6 de CLAUDE.md).

import type { AttrKey, Position } from "../config/attributes";
import type { Archetype } from "../config/psych";
import { classifyArchetype } from "../gen/psych";
import { attributeMap, currentAbility } from "../player/ability";
import { ageOn } from "../time/calendar";
import type { Player, World } from "../types/domain";
import type { ClubId, NationId, PlayerId } from "../types/ids";

export interface PlayerView {
  id: PlayerId;
  name: string;
  age: number;
  nationality: NationId;
  position: Position;
  positions: Position[];
  /** Atributos visibles redondeados a enteros 1–20. */
  attributes: Record<AttrKey, number>;
  /** Etiqueta descriptiva (clave i18n `archetype.*`); nunca el perfil numérico. */
  archetype: { primary: Archetype; secondary: Archetype };
  clubId: ClubId | null;
  heightCm: number;
  foot: "left" | "right" | "both";
}

export function displayName(p: Pick<Player, "firstName" | "lastName" | "knownAs">): string {
  return p.knownAs ?? `${p.firstName} ${p.lastName}`;
}

export function playerView(world: World, id: PlayerId): PlayerView {
  const p = world.players[id];
  if (!p) throw new Error(`Jugador desconocido: ${id}`);
  const age = ageOn(p.birthDay, world.meta.today);
  const attrs = attributeMap(p);
  const attributes = Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k, Math.round(v)])) as Record<AttrKey, number>;
  const { primary, secondary } = classifyArchetype(p.psych, age);
  const diff = p.foot.left - p.foot.right;
  return {
    id,
    name: displayName(p),
    age,
    nationality: p.nationality,
    position: p.position,
    positions: (Object.entries(p.positions) as [Position, number][]).filter(([, f]) => f >= 0.75).map(([pos]) => pos),
    attributes,
    archetype: { primary, secondary },
    clubId: p.clubId,
    heightCm: p.heightCm,
    foot: Math.abs(diff) < 3 ? "both" : diff > 0 ? "left" : "right",
  };
}

export interface ClubSummary {
  id: ClubId;
  name: string;
  nation: NationId;
  leagueTier: number | null;
  squadSize: number;
  averageAge: number;
  /** Nivel medio del once en estrellas 0.5–5 (lo que vería un aficionado). */
  stars: number;
}

export function clubSummary(world: World, id: ClubId): ClubSummary {
  const club = world.clubs[id];
  if (!club) throw new Error(`Club desconocido: ${id}`);
  const players = club.squad.map((pid) => world.players[pid]!).filter(Boolean);
  const cas = players.map(currentAbility).sort((a, b) => b - a).slice(0, 11);
  const avg = cas.reduce((a, b) => a + b, 0) / Math.max(1, cas.length);
  const league = club.leagueId ? world.leagues[club.leagueId] : null;
  return {
    id,
    name: club.name,
    nation: club.nation,
    leagueTier: league ? league.tier : null,
    squadSize: players.length,
    averageAge: players.reduce((a, p) => a + ageOn(p.birthDay, world.meta.today), 0) / Math.max(1, players.length),
    stars: Math.max(0.5, Math.min(5, Math.round(((avg - 6) / 2.4) * 2) / 2)),
  };
}
