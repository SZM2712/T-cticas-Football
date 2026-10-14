// Estado de la UI (no del juego): idioma, selección y versión del mundo para refrescar vistas.

import type { CompetitionId, TeamId } from "@tf/core";
import { DEFAULT_LOCALE, type Locale } from "@tf/i18n";
import { create } from "zustand";
import type { Summary } from "./protocol";

export type Tab = "table" | "results" | "squad" | "scorers" | "tactics" | "match";

interface UiState {
  locale: Locale;
  tab: Tab;
  busy: boolean;
  error: string | null;
  summary: Summary | null;
  /** Se incrementa tras cada cambio del mundo para que las vistas se recarguen. */
  version: number;
  competition: CompetitionId | null;
  team: TeamId | null;
  set(patch: Partial<Omit<UiState, "set">>): void;
}

const savedLocale = (() => {
  try {
    return (localStorage.getItem("tf.locale") as Locale | null) ?? DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
})();

export const useUi = create<UiState>((set) => ({
  locale: savedLocale,
  tab: "table",
  busy: false,
  error: null,
  summary: null,
  version: 0,
  competition: null,
  team: null,
  set: (patch) => set(patch),
}));
