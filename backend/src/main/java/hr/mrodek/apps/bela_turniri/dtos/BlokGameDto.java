package hr.mrodek.apps.bela_turniri.dtos;

import java.util.List;

/**
 * One game ({@code partija}) of a series: the deals played until a side
 * reached {@link #target}. {@code BLOK-HISTORY.md} §2.3.
 *
 * <p>Wire shape, unchanged between upload and read-back:
 * <pre>
 * {
 *   "id":         "9f1c…",          // the blok's own local id, for React keys
 *   "createdAt":  1757280000000,    // epoch ms — the client's clock
 *   "finishedAt": 1757283600000,    // epoch ms, or null while unfinished
 *   "target":      1001,
 *   "gameEndRule": "prolaz",        // "dosta" | "prolaz" — §5.5
 *   "winner":      "us",            // "us" | "them" | null
 *   "totals":      { "us": 1012, "them": 786 },
 *   "rounds":      [ … ]            // BlokRoundDto
 * }
 * </pre>
 *
 * <p><b>The two timestamps stay epoch ms</b>, unlike the session-level dates
 * which are real columns and therefore ISO-8601. They are part of the stored
 * payload and are handed back exactly as they were sent.
 *
 * <p>{@code winner} and {@code totals} are computed by the client through the
 * same {@code scoreManualDeal} that draws the screen, so the history shows
 * precisely what the player saw at the table (§2.3).
 *
 * <p>Which is exactly why {@link #gameEndRule} has to travel with them (§5.5):
 * two games with byte-identical deals have <b>different winners</b> under
 * {@code dosta} (first side past the target wins) and {@code prolaz} (the
 * crossing side must have called that deal and passed it). A {@code winner}
 * stored without the rule beside it is not checkable by anyone reading the
 * record afterwards — not on the profile, not through a shared link. It is
 * per game rather than only per series because the player can change the
 * setting between games of one series.
 */
public record BlokGameDto(
        /** The blok's local id for this game. Never used as a server key. */
        String id,
        /** Epoch ms. */
        Long createdAt,
        /** Epoch ms, or null when the game was abandoned mid-way. */
        Long finishedAt,
        Integer target,
        /**
         * {@code "dosta"} | {@code "prolaz"} — how this game ends (§5.5).
         * Never null on the way out: an absent or unrecognised value on the
         * way in reads back as {@code "prolaz"}, the default, rather than
         * failing the upload.
         */
        String gameEndRule,
        /** {@code "us"} | {@code "them"} | null (unfinished). */
        String winner,
        BlokScoresDto totals,
        List<BlokRoundDto> rounds
) {}
