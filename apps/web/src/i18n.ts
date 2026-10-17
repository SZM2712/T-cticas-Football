import { competitionName, nationName, t } from "@tf/i18n";
import type { TeamRef } from "@tf/core";
import { REAL_COMPETITION_NAMES } from "@tf/data";
import { useUi } from "./store";

/** Traductor ligado al idioma actual. */
export function useT() {
  const locale = useUi((s) => s.locale);
  // Con datos reales, las competiciones llevan su nombre oficial.
  const real = useUi((s) => !!s.summary?.real);
  return {
    locale,
    t: (key: string, params?: Record<string, string | number>) => t(locale, key, params),
    comp: (nameKey: string) => (real && REAL_COMPETITION_NAMES[nameKey]) || competitionName(locale, nameKey),
    nation: (code: string) => nationName(locale, code),
    team: (ref: TeamRef) => (ref.nation ? nationName(locale, ref.nation) : ref.name),
  };
}
