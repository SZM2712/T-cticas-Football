// Patrones genéricos de nombres de club por idioma. {city} = ciudad o distrito,
// {de} = "de " / "d'" según la ciudad (francés), {year} = año de fundación.
// Todo nombre generado se valida contra REAL_CLUB_BLOCKLIST (ver blocklist.ts).

export const CLUB_PATTERNS: Record<string, string[]> = {
  en: [
    "{city} United", "{city} City", "{city} Town", "{city} Rovers", "{city} Athletic", "{city} Wanderers",
    "{city} Albion", "{city} Rangers", "AFC {city}", "{city} Borough", "{city} Harriers", "{city} Corinthians",
    "{city} Sporting", "{city} Victoria", "{city} Celtic", "{city} Swifts", "{city} Olympic", "{city} County",
    "{city} Alexandra", "{city} Dynamos", "{city} Saints", "{city} Mariners", "{city} Phoenix", "{city} Royals",
    "{city} Vale", "{city} Thistle", "{city} Invicta", "{city} Pilgrims",
  ],
  es: [
    "Atlético {city}", "Real {city}", "Deportivo {city}", "Club Deportivo {city}", "Unión Deportiva {city}",
    "Sporting {city}", "Racing {city}", "Real Unión {city}", "Club Atlético {city}", "Gimnástica {city}",
    "Unión {city}", "Cultural {city}", "Recreativo {city}", "Arenas {city}", "Sociedad Deportiva {city}",
    "Juventud {city}", "Olímpico {city}", "Atlético Unión {city}", "Deportiva {city}", "Imperial {city}",
    "Agrupación Deportiva {city}", "Real Club {city}", "Ciudad de {city}",
  ],
  it: [
    "AC {city}", "US {city}", "Associazione Calcio {city}", "Unione Sportiva {city}", "Atletico {city}",
    "Pro {city}", "Virtus {city}", "Sporting {city}", "Polisportiva {city}", "Audace {city}", "Fortitudo {city}",
    "Libertas {city}", "Robur {city}", "Dinamo {city}", "Olimpia {city}", "Aurora {city}", "Real {city}",
    "Accademia {city}", "Vigor {city}", "Sporting Club {city}", "Calcio {city} {year}",
  ],
  de: [
    "SV {city}", "FC {city}", "VfB {city}", "VfL {city}", "TSV {city} {year}", "SC {city}", "Sportfreunde {city}",
    "Eintracht {city}", "Fortuna {city}", "Alemannia {city}", "Rot-Weiss {city}", "Blau-Weiß {city}",
    "Germania {city}", "Viktoria {city}", "Preußen {city}", "Union {city}", "Kickers {city}", "Concordia {city}",
    "SpVgg {city}", "Teutonia {city}", "FSV {city}", "Dynamo {city}", "Lokomotive {city}", "Stahl {city}",
    "Turbine {city}", "Wacker {city}", "SV {city} {year}", "FC {city} {year}", "Sportverein {city}",
  ],
  fr: [
    "Olympique {de}{city}", "AS {city}", "FC {city}", "Stade {de}{city}", "Racing Club {de}{city}", "US {city}",
    "SC {city}", "Entente {city}", "Football Club {de}{city}", "Association Sportive {de}{city}",
    "Sporting Club {de}{city}", "Jeunesse {city}", "Étoile {city}", "Avenir {city}", "Stade {city}",
    "Union {city}", "Racing {city}", "Olympique {city}", "Union Sportive {de}{city}", "Espérance {city}",
    "Athletic Club {de}{city}",
  ],
  pt: [
    "Sporting {city}", "Académico {de}{city}", "Atlético {city}", "Clube Desportivo {city}", "União {city}",
    "Futebol Clube {de}{city}", "Desportivo {city}", "Estrela {city}", "Associação {city}", "Esporte Clube {city}",
  ],
  nl: ["{city} FC", "SC {city}", "VV {city}", "Fortuna {city}", "Quick {city}", "Excelsior {city}", "Unitas {city}", "Victoria {city}", "Sportclub {city}"],
  generic: [
    "FC {city}", "{city} FC", "Sporting {city}", "Dinamo {city}", "Olimpia {city}", "Atlético {city}", "Union {city}",
    "Inter {city}", "{city} United", "Athletic {city}", "Racing {city}", "Lokomotiv {city}", "Spartak {city}",
    "Real {city}", "{city} City", "Progress {city}", "Torpedo {city}", "Energie {city}", "Academica {city}",
  ],
};

/** Idioma de patrones de club para cada nación (si no figura, "generic"). */
export const CLUB_PATTERN_LANG: Record<string, string> = {
  "GB-ENG": "en", "GB-SCT": "en", "GB-WLS": "en", "GB-NIR": "en", IE: "en", US: "en", CA: "en", AU: "en", NZ: "en",
  JM: "en", TT: "en", NG: "en", GH: "en", ZA: "en",
  ES: "es", AR: "es", UY: "es", CO: "es", EC: "es", PY: "es", CL: "es", PE: "es", VE: "es", BO: "es", MX: "es",
  CR: "es", PA: "es", HN: "es", SV: "es", GT: "es", NI: "es", AD: "es",
  IT: "it", SM: "it", DE: "de", AT: "de", CH: "de", LI: "de",
  FR: "fr", BE: "fr", LU: "fr", SN: "fr", CI: "fr", CM: "fr", ML: "fr", BF: "fr", GN: "fr", GA: "fr", BJ: "fr",
  CD: "fr", MA: "fr", DZ: "fr", TN: "fr", HT: "fr", NC: "fr", PF: "fr",
  PT: "pt", BR: "pt", AO: "pt", CV: "pt",
  NL: "nl", CW: "nl", SR: "nl",
};

/** Palabras para nombres de estadio por idioma ({name} = apellido, {city} = ciudad). */
export const STADIUM_PATTERNS: Record<string, string[]> = {
  en: ["{name} Park", "{name} Road", "{name} Lane", "{city} Stadium", "The {name} Ground", "{name} Meadow"],
  es: ["Estadio {name}", "Estadio Municipal de {city}", "Campo de {name}", "Estadio Nuevo {name}"],
  it: ["Stadio {name}", "Stadio Comunale di {city}", "Arena {name}"],
  de: ["{name}-Stadion", "Arena {city}", "Sportpark {name}", "Stadion am {name}platz"],
  fr: ["Stade {name}", "Stade Municipal de {city}", "Parc {name}"],
  pt: ["Estádio {name}", "Estádio Municipal de {city}"],
  nl: ["{name} Stadion", "Sportpark {name}"],
  generic: ["{name} Stadium", "{city} Arena", "Stadium {name}"],
};
