// Traducción de la UI. El núcleo guarda claves y códigos; aquí se convierten en texto.

import { ENTRIES, LOCALES, type Locale } from "./catalog";

export { LOCALES, type Locale };
export const DEFAULT_LOCALE: Locale = "es";

const INDEX: Record<Locale, number> = { es: 0, en: 1, fr: 2, de: 3, zh: 4 };

/** Texto de una clave con sustitución de {parámetros}. Si falta, devuelve la clave (visible en tests). */
export function t(locale: Locale, key: string, params: Record<string, string | number> = {}): string {
  const row = ENTRIES[key];
  if (!row) return key;
  return (row[INDEX[locale]] ?? key).replace(/\{(\w+)\}/g, (_, p: string) => String(params[p] ?? `{${p}}`));
}

export function hasKey(key: string): boolean {
  return key in ENTRIES;
}

/** Naciones británicas y otras que Intl.DisplayNames no conoce como región ISO. */
const NATION_OVERRIDES: Record<string, Record<Locale, string>> = {
  "GB-ENG": { es: "Inglaterra", en: "England", fr: "Angleterre", de: "England", zh: "英格兰" },
  "GB-SCT": { es: "Escocia", en: "Scotland", fr: "Écosse", de: "Schottland", zh: "苏格兰" },
  "GB-WLS": { es: "Gales", en: "Wales", fr: "Pays de Galles", de: "Wales", zh: "威尔士" },
  "GB-NIR": { es: "Irlanda del Norte", en: "Northern Ireland", fr: "Irlande du Nord", de: "Nordirland", zh: "北爱尔兰" },
};

const displayNames = new Map<Locale, Intl.DisplayNames>();

export function nationName(locale: Locale, code: string): string {
  const override = NATION_OVERRIDES[code];
  if (override) return override[locale];
  let dn = displayNames.get(locale);
  if (!dn) displayNames.set(locale, (dn = new Intl.DisplayNames([locale], { type: "region" })));
  return dn.of(code) ?? code;
}

/**
 * Nombre legible de una competición a partir de su `nameKey` del núcleo, p. ej.
 * "comp.league.GB-ENG.1", "comp.nationsLeague.EUR.0", "comp.qualifier.worldCup.AFR".
 */
export function competitionName(locale: Locale, nameKey: string): string {
  const parts = nameKey.split(".");
  const kind = parts[1];
  const confed = (c: string | undefined) => t(locale, `confed.${c}`);
  switch (kind) {
    case "league":
      return t(locale, `comp.league.${parts[3]}`, { nation: nationName(locale, parts[2]!) });
    case "cup":
    case "promotionPlayoff":
    case "relegationPlayoff":
      return t(locale, `comp.${kind}`, { nation: nationName(locale, parts[2]!) });
    case "nationsLeague":
      return t(locale, "comp.nationsLeague", { confed: confed(parts[2]), tier: t(locale, `tier.${parts[3]}`) });
    case "nationsLeagueFinals":
      return t(locale, "comp.nationsLeagueFinals", { confed: confed(parts[2]) });
    case "qualifier":
      return t(locale, `comp.qualifier.${parts[2]}`, { confed: confed(parts[3]) });
    default:
      return t(locale, nameKey);
  }
}
