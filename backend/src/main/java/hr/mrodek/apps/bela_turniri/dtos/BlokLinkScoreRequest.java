package hr.mrodek.apps.bela_turniri.dtos;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * Body of {@code PUT /blok-links/{uuid}/score}:
 * {@code { us, them, final, sessionId }}. See {@code BLOK-LINK.md} §2.3 and
 * §6.1 / §6.2.
 *
 * <h2>{@code us} and {@code them} are GAMES WON (§6.1)</h2>
 * A tournament match is scored {@code 2 : 0}, {@code 2 : 1} — <b>how many
 * games each side has won in the series at that table</b>. They are not the
 * blok's point totals: {@code 543 : 149} is the scorepad's internal business
 * and never reaches {@code Matches}. A provisional push therefore happens
 * whenever the series result changes (at the end of a game), not on every
 * deal, and {@code final: true} arrives when the series is decided.
 *
 * <p>The blok speaks in "us" and "them"; the server maps those onto the
 * match's {@code score1}/{@code score2} through the link's stored
 * {@code usPairId}.
 *
 * <p><b>{@code final} is the whole safety story of this endpoint.</b>
 * {@code false} is a running series result pushed while the table is still
 * playing — it writes the two numbers and nothing else. {@code true} is the
 * settled result and goes through the organiser's own scoring path, with the
 * winner, statistics, elimination, loser notification and round
 * auto-completion that implies.
 *
 * <p>The Java component cannot be called {@code final}, hence
 * {@link JsonProperty}: the wire name stays {@code final}, per the contract.
 *
 * <p>Bounds mirror {@link UpdateMatchRequest} <b>on purpose, and are not
 * tightened to a plausible game count</b>: {@code final: true} is delegated
 * straight into the organiser's own {@code updateMatchScore}, so a stricter
 * cap here would make this endpoint refuse a number the score sheet itself
 * accepts — two different answers for one column. Games won is a small number
 * in practice; 100 000 is a typo/garbage guard, not a rule. Unlike that DTO
 * both values are required here: a blok always knows its own series result,
 * and a null would silently un-score a table.
 */
public record BlokLinkScoreRequest(
        @NotNull(message = "validation.blokLink.score.required")
        @Min(value = 0, message = "validation.blokLink.score.negative")
        @Max(value = 100_000, message = "validation.blokLink.score.tooHigh")
        Integer us,

        @NotNull(message = "validation.blokLink.score.required")
        @Min(value = 0, message = "validation.blokLink.score.negative")
        @Max(value = 100_000, message = "validation.blokLink.score.tooHigh")
        Integer them,

        @JsonProperty("final")
        boolean isFinal,

        /**
         * Client id of the blok series at this table (§6.2). Optional, and
         * accepted here as well as on {@code POST /blok-links} because a link
         * may predate the client that knows how to send one: the server adopts
         * it if the link still has none, and ignores it otherwise (the mapping
         * is chosen once, like {@code usPairId}).
         *
         * <p>Not length-validated. §6.2 makes the share token a
         * <em>consequence</em> of writing a score, never a condition for it,
         * so a blank or over-long id is treated as absent and the score still
         * goes in.
         */
        String sessionId
) {}
