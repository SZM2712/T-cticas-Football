// API pública del núcleo.

export * from "./types/ids";
export * from "./types/domain";
export * from "./config/attributes";
export * from "./config/psych";
export * from "./config/generation";
export { Rng, splitmix32, seedToInt, type RngState } from "./rng/rng";
export * from "./rng/dist";
export { fnv1a32, cyrb53 } from "./rng/hash";
export * from "./time/calendar";
export { hashValue } from "./world/hash";
export { worldRng } from "./world/rng";
export { generateWorld, callUps, type GenerateOptions } from "./gen/world";
export { generatePsych, classifyArchetype } from "./gen/psych";
export { generateClubName } from "./gen/clubs";
export { currentAbility, bestAbility, attributeMap, abilityFor } from "./player/ability";
export { roundRobin } from "./competition/roundRobin";
export { leaguePhaseDraw, drawGroups, pairKnockout } from "./competition/draw";
export { knockoutPlan, playersThisRound } from "./competition/build";
export { groupTable, type TableRow } from "./competition/standings";
export { windowsOf, continentalDates, isInWindow, type InternationalWindow } from "./competition/seasonPlan";
export { TeamSchedule } from "./competition/schedule";
export { tournamentStart } from "./competition/international";
export { newGame, openGame, advanceDay, advanceDays, advanceSeasons, type Game } from "./engine/game";
export { playerView, clubSummary, displayName, type PlayerView, type ClubSummary } from "./views/player";
