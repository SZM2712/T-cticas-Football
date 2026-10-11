// Identificadores nominales: strings con prefijo (pl_000123). El tipo de marca evita
// mezclar un ClubId con un PlayerId en tiempo de compilación.

declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type PlayerId = Brand<string, "PlayerId">;
export type ClubId = Brand<string, "ClubId">;
export type StaffId = Brand<string, "StaffId">;
export type MatchId = Brand<string, "MatchId">;
export type CompetitionId = Brand<string, "CompetitionId">;
export type LeagueId = Brand<string, "LeagueId">;
export type NationalTeamId = Brand<string, "NationalTeamId">;
/** Código de nación (ISO 3166-1 alfa-2 o subdivisión GB-ENG...). */
export type NationId = Brand<string, "NationId">;
/** Un equipo que juega partidos: club o selección. */
export type TeamId = ClubId | NationalTeamId;

/** Días desde el 1/1/2000 (ver time/calendar.ts). */
export type GameDay = Brand<number, "GameDay">;

/** 0..1 */
export type Unit = number;
/** -1..1 */
export type Signed = number;
/** 1..20 (float) */
export type Attr = number;

export const isNationalTeamId = (id: string): id is NationalTeamId => id.startsWith("nt_");
export const nationalTeamIdOf = (nation: NationId | string): NationalTeamId => `nt_${nation}` as NationalTeamId;
export const nationOfTeam = (id: NationalTeamId): NationId => id.slice(3) as NationId;
