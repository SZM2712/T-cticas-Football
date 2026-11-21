// Diales de medios, redes y disciplina (Fase 5, DISEÑO §6 y §11.4).

import type { AnswerIntent, NarrativeKind } from "../types/media";

// ── Narrativas ──────────────────────────────────────────────────────────────

/** Calor que aporta cada hecho nuevo a una narrativa (y el de partida al abrirla). */
export const NARRATIVE_FEED: Record<NarrativeKind, number> = {
  newManager: 0.7, winningStreak: 0.45, losingStreak: 0.55, goalDrought: 0.4, brokenPromise: 0.7, egoPublic: 0.6,
  transferRequest: 0.9, injuryBlow: 0.5, prodigy: 0.5, breakthrough: 0.4, retirementRumour: 0.5, refereeRow: 0.65,
  dividedSquad: 0.6, hypocrisy: 0.8, disciplinary: 0.6, topScorer: 0.4, captaincy: 0.4,
};
/** Narrativas que, contadas, son buenas noticias para su protagonista. */
export const POSITIVE_NARRATIVES: readonly NarrativeKind[] = ["newManager", "winningStreak", "prodigy", "breakthrough", "topScorer", "captaincy"];
/** Semivida del calor de una narrativa, en días. */
export const NARRATIVE_HALF_LIFE = 9;
/** Por debajo de este calor la narrativa se da por cerrada. */
export const NARRATIVE_CLOSE_HEAT = 0.06;
/** Días que se guarda una narrativa cerrada antes de borrarla. */
export const NARRATIVE_KEEP_DAYS = 120;
/** Racha (victorias o derrotas seguidas) que abre una narrativa. */
export const STREAK_MIN = 3;
/** Partidos seguidos sin marcar de un atacante titular que abren la narrativa de sequía. */
export const DROUGHT_MATCHES = 5;
/** Goles en los últimos 4 partidos que abren la de goleador en racha. */
export const HOT_SCORER_GOALS = 4;
/** Lesión (días) de un titular que abre la narrativa de golpe para el equipo. */
export const INJURY_BLOW_DAYS = 28;
/** Reunión con al menos esta fracción en contra: vestuario dividido. */
export const DIVIDED_SHARE = 0.33;

// ── Periodistas y ruedas de prensa ─────────────────────────────────────────

/** Periodistas por nación (se crean al tomar el mando de un club de esa nación). */
export const JOURNALISTS_PER_NATION = 8;
/** Preguntas por rueda de prensa. */
export const QUESTIONS_PER_CONFERENCE = 3;
/** Pregunta incisiva si la agresividad del periodista supera esto o la relación es mala. */
export const POINTED_AGGRESSION = 0.62;
export const POINTED_RELATION = -0.3;
/** Calor mínimo para que una narrativa dé pregunta. */
export const QUESTION_MIN_HEAT = 0.12;
/** Cambio de relación con el periodista según el tono y si esquivas la pregunta. */
export const RELATION_TONE = { calm: 0.03, firm: 0, combative: -0.06 } as const;
export const RELATION_EVASIVE = -0.03;
/** Días en los que dos declaraciones opuestas sobre lo mismo son una contradicción. */
export const HYPOCRISY_DAYS = 90;
/** Declaraciones guardadas (las más antiguas se olvidan). */
export const STATEMENTS_KEPT = 200;
/** Orden de preferencia del asistente (lo más prudente primero). */
export const ASSISTANT_PREFERENCE: readonly AnswerIntent[] = [
  "calm", "humble", "backPlayer", "praisePlayer", "acceptDecision", "noComment", "takeBlame", "deny", "confirm",
  "ambitious", "promiseImprovement", "promisePlayingTime", "blamePlayers", "criticizePlayer", "criticizeReferee",
];
/** Directrices por defecto del asistente: prudente. */
export const DEFAULT_DIRECTIVES = { refereeCriticism: false, criticizePlayers: false, promises: false, tone: "calm" } as const;

// ── Redes ──────────────────────────────────────────────────────────────────

/** Publicaciones que se guardan (las más antiguas se borran). */
export const POSTS_KEPT = 400;
/** Días entre dos artículos sobre la misma narrativa. */
export const ARTICLE_GAP = 3;
/** Calor mínimo de una narrativa para que la prensa le dedique un artículo. */
export const ARTICLE_MIN_HEAT = 0.35;
/** Puntuación de difusión a partir de la que algo es «medio» y «viral». */
export const REACH_MEDIUM = 0.45;
export const REACH_VIRAL = 0.75;
/** Ánimo de la afición por el resultado y por una decisión arbitral que les perjudicó. */
export const FAN_MOOD = { win: 0.05, draw: 0, loss: -0.06, robbed: -0.04, refCriticismUltras: 0.03 };

// ── Árbitros y polémicas ───────────────────────────────────────────────────

/** Probabilidad de que una jugada de cada tipo sea discutible (stream propio: no cambia el partido). */
export const CONTROVERSY_P = { penaltyGiven: 0.35, redCard: 0.3, offsideGoal: 0.07, penaltyDenied: 0.12 };
/** Probabilidad de que el árbitro acertara según lo clara que era la jugada. */
export const CORRECT_P = { clear: 0.92, debatable: 0.6, marginal: 0.45 };
/** Tensión con el árbitro aludido según el tono de la crítica; y bajada al aceptar o disculparse. */
export const CRITICISM_TENSION = { calm: 0.1, firm: 0.25, combative: 0.4 } as const;
export const ACCEPT_TENSION = -0.08;
/** La tensión se enfría cada mes. */
export const TENSION_MONTHLY_DECAY = 0.85;
/** Tensión a partir de la que el colectivo arbitral emite un comunicado. */
export const COLLECTIVE_STATEMENT_TENSION = 0.5;

// ── Comité de disciplina ───────────────────────────────────────────────────

/** Plazo de alegaciones y de recurso (días). */
export const ALLEGATION_DAYS = 5;
export const APPEAL_DAYS = 7;
/** Gravedad de una crítica al árbitro según el tono (+ tensión previa). */
export const CRITICISM_GRAVITY = { calm: 0, firm: 0.3, combative: 0.6 } as const;
/** Acta: probabilidad de expediente por conducta violenta tras una roja directa (+ tensión × peso). */
export const VIOLENT_BASE = 0.15;
export const VIOLENT_TENSION = 0.5;
/** Acta: probabilidad de expediente por protestas (tensión × peso), si la tensión supera el umbral. */
export const PROTEST_TENSION_MIN = 0.25;
export const PROTEST_WEIGHT = 0.4;
/** Multa base (€) por punto de gravedad, según los ingresos del club (millones) y mínimo. */
export const FINE_PER_REVENUE = 600;
export const FINE_MIN = 3000;
/** Gravedad a partir de la que la crítica al árbitro cuesta partidos sin banquillo. */
export const TOUCHLINE_GRAVITY = 0.45;
/** Modificadores de la sanción según las alegaciones. */
export const ALLEGATION_FACTOR = { none: 1, accept: 0.7, apologize: 0.8, contest: 1.15 } as const;
/** Alegar con pruebas (la decisión criticada fue un error del árbitro): probabilidad de archivo. */
export const CONTEST_DISMISS_WITH_EVIDENCE = 0.6;
/** Recurso: probabilidad de anular (con y sin pruebas) y de rebajar. */
export const APPEAL_ANNUL = { evidence: 0.35, none: 0.08 };
export const APPEAL_REDUCE = 0.3;
/** Partido con el estadio parcialmente cerrado: pérdida de ingresos (fracción de los ingresos anuales). */
export const CLOSURE_REVENUE_SHARE = 0.01;
