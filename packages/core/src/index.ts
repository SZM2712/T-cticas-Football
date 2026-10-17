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
export * from "./config/match";
export { teamRating, squadRating, quickMatch, updateElo } from "./match/quick";
export * from "./match/types";
export { INSTRUCTION_KEYS } from "./types/tactics";
export { applyCommand, validatePlan, validateDevPlan, type Command, type CommandResult } from "./commands";
export * from "./types/development";
export * from "./config/development";
export { monthlyDevelopment, dailyDevelopment, devDayOf, curve, volatilityFor } from "./development/tick";
export { monthlyScouting, observe, scoutReportsView, starsOf, scoutBias, type ScoutReportView } from "./development/scouting";
export { seasonTurnover, type TurnoverSummary } from "./development/season";
export { planEffects, rollAdherence, staffQuality, activeParts, type PlanEffects, type StaffQuality } from "./development/plan";
export { simulateMatch, simulateWithInterventions, startMatch, type LiveMatch, type SimulateOptions } from "./match/engine";
export {
  buildMatchInput, pickLineup, teamSheet, coachAuthority, invalidateAbilityCache, fitnessOn, isInjured, isSuspended, skillsOf, familiarity, type Lineup,
} from "./match/lineup";
export {
  FORMATIONS, FORMATION_IDS, shapePosition, toAbsolute, aiTactics, teamStyle, defaultSetPieces, resolveTactics,
  instructionCompliance, type Slot,
} from "./match/tactics";
export { applyReport, resultFromReport } from "./match/apply";
export { playMatch, engineFor, type EngineMode, type PlayedMatch } from "./match/play";
export { migrateWorld } from "./world/migrations";
export {
  newGame, openGame, advanceDay, advanceDays, advanceSeasons, liveReport, liveIntervene, finishLive, type Game,
  type AdvanceOptions, type LiveSession,
} from "./engine/game";
export { playerView, clubSummary, displayName, type PlayerView, type ClubSummary } from "./views/player";
export * from "./views/game";
export { playerDevelopmentView, type PlayerDevelopmentView } from "./views/development";
export { monthlyRetirementCheck, retirementChance, retireNow } from "./development/retirement";
export * from "./types/social";
export { takeCharge, dailySocial, afterMatch } from "./social";
export { weeklySocial, initDressingRoom, louvain, recomputeStructure, squadPlayers, performance, participation, statusRank } from "./social/graph";
export { dailyEgo, EGO_DYNAMICS, symbolicOverlap, relieve, type EgoDynamic, type Trigger } from "./social/ego";
export { makeCommitment, reviewCommitments, measure, liveCommitments } from "./social/commitments";
export { talk, talkChance, managerAuthority, minutesDemand, type TalkArgs, type TalkResult } from "./social/talk";
export { teamMeeting, styleSuit, clubStanding, type MeetingArgs } from "./social/meeting";
export { fitOf, type FitBreakdown } from "./social/fit";
export { remember, salience, halfLife, valence, pairKey, trustOf, managerOf, notify } from "./social/store";
export * from "./views/social";
export { marketValue } from "./player/value";
export * from "./config/market";
