// PAQUETE OPCIONAL DE DATOS REALES: nombres oficiales de las competiciones (sin patrocinador).
// Solo se usan cuando el mundo se creó con `dataPack: "real"`; el mundo por defecto usa los
// nombres genéricos de `packages/i18n` (CLAUDE.md, regla 7). Clave = `nameKey` del núcleo.

export const REAL_COMPETITION_NAMES: Readonly<Record<string, string>> = {
  "comp.league.GB-ENG.1": "Premier League",
  "comp.league.GB-ENG.2": "EFL Championship",
  "comp.cup.GB-ENG": "FA Cup",
  "comp.promotionPlayoff.GB-ENG": "EFL Championship play-offs",
  "comp.league.ES.1": "LaLiga",
  "comp.league.ES.2": "LaLiga Hypermotion",
  "comp.cup.ES": "Copa del Rey",
  "comp.league.IT.1": "Serie A",
  "comp.league.IT.2": "Serie B",
  "comp.cup.IT": "Coppa Italia",
  "comp.league.DE.1": "Bundesliga",
  "comp.league.DE.2": "2. Bundesliga",
  "comp.cup.DE": "DFB-Pokal",
  "comp.relegationPlayoff.DE": "Bundesliga Relegation",
  "comp.league.FR.1": "Ligue 1",
  "comp.league.FR.2": "Ligue 2",
  "comp.cup.FR": "Coupe de France",
  "comp.continental.1": "UEFA Champions League",
  "comp.continental.2": "UEFA Europa League",
  "comp.continental.3": "UEFA Conference League",
};
