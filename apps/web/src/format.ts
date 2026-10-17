// Formatos de la UI (solo presentación).

/** Importe compacto en euros: "1,5 M €", "230 mil €". */
export function money(eur: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", notation: "compact", maximumFractionDigits: 1 }).format(eur);
}
