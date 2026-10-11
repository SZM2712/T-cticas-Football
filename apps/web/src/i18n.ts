import { competitionName, nationName, t } from "@tf/i18n";
import type { TeamRef } from "@tf/core";
import { useUi } from "./store";

/** Traductor ligado al idioma actual. */
export function useT() {
  const locale = useUi((s) => s.locale);
  return {
    locale,
    t: (key: string, params?: Record<string, string | number>) => t(locale, key, params),
    comp: (nameKey: string) => competitionName(locale, nameKey),
    nation: (code: string) => nationName(locale, code),
    team: (ref: TeamRef) => (ref.nation ? nationName(locale, ref.nation) : ref.name),
  };
}
