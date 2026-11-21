// Formatos de la UI (solo presentación).

/** Importe compacto en euros: "1,5 M €", "230 mil €". */
export function money(eur: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", notation: "compact", maximumFractionDigits: 1 }).format(eur);
}

/** Fecha de un GameDay (días desde el 1/1/2000, UTC). Solo la UI usa Date. */
export function dateOfDay(day: number, locale: string): string {
  return new Date(Date.UTC(2000, 0, 1) + day * 86400000).toLocaleDateString(locale, { timeZone: "UTC" });
}
