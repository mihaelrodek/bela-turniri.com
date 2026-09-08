package hr.mrodek.apps.bela_turniri.dtos;

import jakarta.validation.constraints.NotNull;

/**
 * Body of {@code POST /blok-links}. See {@code BLOK-LINK.md} §2.2.
 *
 * <p>{@code matchId} is the match's global bigint id (the table number is
 * unique only within a round and is for humans); {@code usPairId} says which
 * of that match's two pairs is the requester's own side, which is the whole
 * reason the organiser can make sense of the number that arrives later.
 *
 * <p>{@code sessionId} is optional and is the client's own id for the blok
 * <em>series</em> being played at that table ({@code BLOK-LINK.md} §6.2) — the
 * same string {@code POST /user/me/blok-history} uses. It is what lets the
 * server mint the series' share token once a score is written, so the bracket
 * can offer {@code /blok/z/{token}}. Absent is fine: a link simply names no
 * shareable record, and the id may also arrive later on the first score push.
 * Not validated for length — the service treats a blank or over-long value as
 * absent rather than refusing the link over an identifier.
 *
 * <p>{@code requestedByName} is how a signed-out player signs the request
 * (§7.1). See its own note.
 *
 * <p>{@code message} values are {@code MessageService} bundle keys, resolved
 * into the caller's language by {@code ConstraintViolationExceptionMapper}.
 */
public record CreateBlokLinkRequest(
        @NotNull(message = "validation.blokLink.matchId.required")
        Long matchId,

        @NotNull(message = "validation.blokLink.usPairId.required")
        Long usPairId,

        /** Client id of the blok series at this table; optional (§6.2). */
        String sessionId,

        /**
         * Who is asking, in their own words — <b>required, 2–60 characters,
         * when the caller is not signed in</b> ({@code BLOK-LINK.md} §7.1),
         * and ignored when they are.
         *
         * <p>The organiser approves a <em>person</em>: their list reads
         * "Marko traži stol 4" and they decide from that. A signed-in caller
         * signs the request with their account's display name, which is what
         * has always been stored here. A signed-out one has no account to
         * take a name from, so a request without one is unapprovable — it
         * would reach the organiser as an anonymous claim on a table — and is
         * refused with {@code 400 NAME_REQUIRED}.
         *
         * <p>Validated in {@code BlokLinkService} rather than with
         * {@code @Size} here, because the rule is conditional: the same body
         * is legal without a name when there is an account behind it.
         */
        String requestedByName
) {}
