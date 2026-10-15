// Diales del vestuario (Fase 4, DISEÑO §5). Valores de partida a calibrar con los escenarios
// guionizados de packages/core/test/social.test.ts.

import type { MemoryKind, Publicness } from "../types/social";

// ── Grafo: afinidad de partida (§5.1) ───────────────────────────────────────
export const BASE_COMMON_LANGUAGE = 0.15;
export const BASE_SAME_NATION = 0.1;
/** Edad cercana (≤ 3 años). */
export const BASE_CLOSE_AGE = 0.05;
/** Ruido de la afinidad de partida (química personal). */
export const BASE_NOISE_SD = 0.12;
/** Rivalidad de partida por compartir puesto, escalada por la competitividad de ambos. */
export const BASE_RIVALRY = 0.35;

// ── Grafo: tick semanal (§5.2) ──────────────────────────────────────────────
export const K_LANGUAGE = 0.006;
export const K_SOCIABILITY = 0.012;
/** Química de campo: goles con asistencia entre ambos (impulso inmediato). */
export const K_SHARED_GOAL = 0.04;
export const K_RIVALRY = 0.02;
/** Envidia por salario (ratio − 1) × diferencia de rendimiento. */
export const K_ENVY_WAGE = 0.05;
/** Envidia por estatus (titularidad) mayor. */
export const K_ENVY_STATUS = 0.02;
export const K_RESPECT_PERF = 0.03;
export const K_RESPECT_PROF = 0.01;
/** Decaimiento semanal hacia la línea base. */
export const RELATION_DECAY = 0.04;
/** Pesos de la valencia mostrada (§3). */
export const VALENCE_WEIGHTS = { affinity: 0.5, respect: 0.25, envy: 0.35, rivalryOverRespect: 0.2 };

// ── Camarillas y jerarquía ──────────────────────────────────────────────────
/** Solo cuentan para las camarillas las aristas con valencia mayor que esto. */
export const CLIQUE_MIN_VALENCE = 0.15;
export const CLIQUE_MIN_SIZE = 3;
/** Influencia real = pesos (§5.2). */
export const INFLUENCE_WEIGHTS = { trait: 0.35, pagerank: 0.25, seniority: 0.15, status: 0.15, reputation: 0.1 };
/** Años en el club para la antigüedad máxima. */
export const SENIORITY_YEARS = 6;
export const MAX_LEADERS = 3;
/** Percentiles de influencia: influyentes por encima de 0,7; núcleo por encima de 0,35. */
export const LEVEL_PERCENTILES = { influential: 0.7, core: 0.35 };
/** Marginado: valencia media por debajo o sin ninguna arista positiva. */
export const OUTCAST_VALENCE = -0.2;

// ── Moral y contagio ───────────────────────────────────────────────────────
/** Contagio emocional semanal (α). */
export const CONTAGION = 0.25;
/** Moral tras un partido: victoria / derrota, escalada por los minutos. */
export const MORALE_RESULT = 0.06;
/** Decaimiento semanal de la moral hacia la felicidad en el club. */
export const MORALE_DECAY = 0.15;

// ── Estatus percibido ──────────────────────────────────────────────────────
/** Partidos oficiales recientes que cuentan para el estatus percibido. */
export const STATUS_WINDOW = 8;
/** Cuota de titularidades mínima para cada estatus. */
export const STATUS_STARTS = { keyPlayer: 0.8, firstTeam: 0.55, rotation: 0.3, backup: 0.1 };

// ── Memoria episódica (§3) ──────────────────────────────────────────────────
/** Semivida base en días por tipo de recuerdo. */
export const MEMORY_HALF_LIFE: Record<MemoryKind, number> = {
  privatePraise: 30, publicPraise: 60, privateCriticism: 45, publicCriticism: 150,
  benched: 20, subbedOff: 14, statusSnub: 60,
  promiseMade: 60, promiseKept: 240, promiseBroken: 400, witnessedBrokenPromise: 200, promiseRenegotiated: 120,
  salaryInsult: 300, renewed: 200, captaincyGiven: 300, captaincyRemoved: 500, roleGiven: 120, roleTaken: 250,
  goodTalk: 40, badTalk: 80, dressingRoomRow: 180, sharedGoal: 45,
};
/** Multiplicador por lo público que fue. */
export const PUBLICNESS_MULT: Record<Publicness, number> = { private: 1, squad: 1.3, public: 1.8 };
/** Por debajo de esta prominencia el recuerdo se poda (mensual). */
export const MEMORY_PRUNE = 0.02;
/** Máximo de recuerdos vivos por jugador (se poda el de menor prominencia). */
export const MEMORY_MAX_PER_PLAYER = 40;

// ── Confianza en el mánager ────────────────────────────────────────────────
export const TRUST_START = 0.1;
export const TRUST_PROMISE_KEPT = 0.15;
export const TRUST_PROMISE_BROKEN = -0.35;
/** Testigos de una promesa rota (según `witnesses`). */
export const TRUST_WITNESS_BROKEN = -0.1;
export const TRUST_RENEGOTIATED = -0.08;
/** Autoridad: peso de la confianza sobre la reputación. */
export const AUTHORITY_TRUST = 0.25;

// ── Dinámicas de ego: escalera común (§5.3) ────────────────────────────────
/** Umbrales de tensión de cada escalón: señales, pide hablar, agente/indirecta, queja pública, petición de salida. */
export const LADDER = [0.25, 0.45, 0.65, 0.8, 0.95] as const;
/** Por debajo de esto un escalón se puede volver a disparar (histéresis). */
export const LADDER_RESET = 0.1;
/** Pérdida de moral al cruzar el escalón 4 (rendimiento cae). */
export const PUBLIC_COMPLAINT_MORALE = -0.25;
/** Decaimiento diario de la tensión cuando ya no hay disparador. */
export const TENSION_DECAY = 0.02;

// Celos salariales (§5.4.1)
export const ENVY_MIN_EGO = 0.55;
export const ENVY_WAGE_RATIO = 1.15;
/** Solo envidia quien juega con regularidad (participación reciente mínima). */
export const ENVY_MIN_PARTICIPATION = 0.3;
/** Escala de la acumulación diaria: ego · (ratio − 1) · (0,5 + reconocimiento) · (1 − 0,5·lealtad) · esto. */
export const ENVY_RATE = 0.07;
export const ENVY_LEADER_MULT = 1.3;
/** Renovación que la desactiva: ≥ 90 % del salario del compañero. */
export const ENVY_RENEW_SHARE = 0.9;

// Estatus prometido frente a real (§5.4.2)
export const STATUS_RATE = 0.011;
/** Con una promesa de minutos en riesgo, la tensión sube más rápido. */
export const STATUS_PROMISE_MULT = 1.8;

// Dos gallos (§5.4.3)
export const ROOSTER_MIN_EGO = 0.65;
export const ROOSTER_RATE = 0.03;
/** Impulso cuando uno le quita un papel simbólico al otro. */
export const ROOSTER_ROLE_IMPULSE = 0.2;

// ── Promesas (§3) ──────────────────────────────────────────────────────────
/** Plazo por defecto de una promesa de minutos, en días. */
export const PROMISE_DAYS = 70;
/** Margen por debajo del objetivo en el que la promesa pasa a "en riesgo". */
export const AT_RISK_MARGIN = 0.15;

// ── Conversaciones ─────────────────────────────────────────────────────────
/** Días entre dos conversaciones con el mismo jugador. */
export const TALK_COOLDOWN = 7;
/** Base de éxito y pesos (autoridad, confianza, ego, inseguridad). */
export const TALK = { base: 0.55, authority: 0.35, trust: 0.3, ego: -0.25, insecurity: 0.1, tension: -0.2 };
/** Cuánto baja la tensión una conversación que sale bien. */
export const TALK_TENSION_RELIEF = 0.3;

// ── Encaje (§5.5) ──────────────────────────────────────────────────────────
export const FIT_WEIGHTS = { tactical: 0.35, cultural: 0.25, social: 0.25, manager: 0.15 };
/** Efecto en partido: ±5 % de rendimiento con encaje −1..1. */
export const FIT_MATCH_EFFECT = 0.05;
