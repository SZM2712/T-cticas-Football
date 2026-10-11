// Grupos de puestos que usan el motor y las tácticas.

import type { Position } from "../config/attributes";

export const ATTACKING_ROLES: ReadonlySet<Position> = new Set<Position>(["ST", "LW", "RW", "AM"]);
export const DEFENDING_ROLES: ReadonlySet<Position> = new Set<Position>(["CB", "LB", "RB"]);
