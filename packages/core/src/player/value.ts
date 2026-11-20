// Valor de mercado estimado de un jugador (visible en la UI). Solo con datos visibles:
// nivel actual, edad, reputación y años de contrato. El mercado real (Fase 6) lo sustituirá.

import { VALUE_AGE_CURVE, VALUE_AT_12, VALUE_CONTRACT_CURVE, VALUE_MIN, VALUE_PER_LEVEL, VALUE_REPUTATION } from "../config/market";
import { curve } from "../development/tick";
import { exactAge } from "../time/calendar";
import type { Player } from "../types/domain";
import type { GameDay } from "../types/ids";
import { currentAbility } from "./ability";

/** Redondea a 2 cifras significativas (como se publican los valores: 1,5 M, 230 mil). */
function roundNice(x: number): number {
  const mag = 10 ** Math.max(0, Math.floor(Math.log10(x)) - 1);
  return Math.round(x / mag) * mag;
}

export function marketValue(p: Player, day: GameDay | number): number {
  const level = currentAbility(p);
  const age = exactAge(p.birthDay, day);
  const years = p.contract ? Math.max(0, (p.contract.expires - day) / 365) : 0;
  const v = VALUE_AT_12 * Math.exp(VALUE_PER_LEVEL * (level - 12)) * curve(VALUE_AGE_CURVE, age) *
    (VALUE_REPUTATION.base + VALUE_REPUTATION.span * p.reputation) * curve(VALUE_CONTRACT_CURVE, years);
  return roundNice(Math.max(VALUE_MIN, v));
}
