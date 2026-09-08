package hr.mrodek.apps.bela_turniri.dtos;

import jakarta.validation.constraints.NotNull;

import java.util.List;

/**
 * Body of {@code POST /user/me/blok-history} — {@code BLOK-HISTORY.md} §2.3.
 *
 * <pre>
 * {
 *   "sessionId":   "b7c0…",                    // idempotency key, ≤ 64 chars
 *   "target":      1001,
 *   "gameEndRule": "prolaz",                   // OPTIONAL — see below
 *   "names":       { "us": "", "them": "" },   // "" = render the translation
 *   "startedAt":   1757280000000,              // epoch ms
 *   "finishedAt":  1757298000000,              // epoch ms
 *   "games":       [ … ]                       // BlokGameDto, each with its
 *                                              //   own gameEndRule (§5.5)
 * }
 * </pre>
 *
 * <p><b>The rule lives per game (§5.5).</b> Each entry of {@link #games}
 * carries its own {@code gameEndRule}, because the player can change the
 * setting between games of one series and a game's {@code winner} is only
 * checkable against the rule it was played under. The optional top-level
 * {@link #gameEndRule} is only the <em>series-level</em> value stored in the
 * column the listing reads; leave it out and the server takes the newest
 * game's, which is the same thing said twice for a client that keeps its
 * games in order.
 *
 * <p><b>No {@code gamesUs} / {@code gamesThem}.</b> The series result is
 * counted on the server from the per-game {@code winner} values — the contract
 * defines no such field, and tallying winners duplicates no scoring rule.
 *
 * <p><b>No uid.</b> Ownership comes from {@code currentUser.requireUid()} and
 * from nothing in this body.
 *
 * <h2>Why almost nothing here is bean-validated</h2>
 * §3.3 requires the input limits to answer a <em>bare machine code</em>
 * ({@code INVALID_SESSION_ID}, {@code TOO_MANY_GAMES}, …) that the SPA
 * compares literally. Bean validation answers the {@code ApiError} envelope
 * instead, and it runs first, so a {@code @Size(max = 64)} on
 * {@link #sessionId} would shadow the contract's {@code INVALID_SESSION_ID}.
 * Everything §3.3 names is therefore checked in {@code BlokHistoryService} and
 * thrown through {@code ApiCodes.badRequest}. {@code games} is the one field
 * §3.3 does not speak for, so it carries the constraint here; the service
 * still defends against null on its own.
 */
public record SaveBlokSessionRequest(
        /** The blok's {@code crypto.randomUUID()} for this series. */
        String sessionId,

        /** Points a game is played to. */
        Integer target,

        /**
         * Optional series-level {@code "dosta"} | {@code "prolaz"} (§5.5).
         * Absent, blank or unrecognised falls back to the newest game's rule,
         * and that in turn defaults to {@code "prolaz"} — <b>never a 400</b>.
         * The rule is a label on a record the server does not act on, so
         * rejecting an unknown value would only break an older client.
         */
        String gameEndRule,

        /** Side names; {@code ""} or null means "show the translated MI / VI". */
        BlokNamesDto names,

        /** Epoch ms; null tolerated. */
        Long startedAt,

        /** Epoch ms; null tolerated. */
        Long finishedAt,

        @NotNull(message = "validation.blokSession.games.required")
        List<BlokGameDto> games
) {}
