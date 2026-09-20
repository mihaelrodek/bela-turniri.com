import type { GameStatRecord, PlayerGameStats } from "@bela/protocol"

/** Belot's four disciplines, in the order the lobby's stat row and the
 *  create-room target-score picker both use. "163" ("Brza 163") is the
 *  quick-play discipline and sorts first, matching the game engine's own
 *  `TargetScore` union (`game/packages/engine/src/types.ts`). */
export const STAT_TARGET_SCORES = ["163", "501", "701", "1001"] as const
export type StatTargetScore = (typeof STAT_TARGET_SCORES)[number]

/** Finished games that earn one karma point back — mirrors the backend's
 *  `GameReliabilityService.GAMES_PER_RECOVERY`. */
export const KARMA_RECOVERY_GAMES = 3

const EMPTY_RECORD: GameStatRecord = { games: 0, wins: 0, losses: 0, winRate: 0 }

/** `stats.global`, defaulted to zero so callers never have to null-check. */
export function overallRecord(stats: PlayerGameStats | null | undefined): GameStatRecord {
    return stats?.global ?? EMPTY_RECORD
}

/** `stats.byTargetScore[target]`, defaulted to zero — a player may simply
 *  never have played that discipline. */
export function targetRecord(stats: PlayerGameStats | null | undefined, target: StatTargetScore): GameStatRecord {
    return stats?.byTargetScore[target] ?? EMPTY_RECORD
}

/** Round once, in the one place every stat pill reads a percentage from. */
export function winPercent(record: GameStatRecord): number {
    return Math.round(record.winRate * 100)
}
