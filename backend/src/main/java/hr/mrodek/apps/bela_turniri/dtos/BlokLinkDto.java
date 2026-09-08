package hr.mrodek.apps.bela_turniri.dtos;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Wire shape of one blok ↔ table link. See {@code BLOK-LINK.md} §2.2 / §3.2.
 *
 * <p>One shape serves both audiences on purpose:
 * <ul>
 *   <li>the <b>blok</b> (`GET /blok-links/mine`) reads status, tournament,
 *       round/table and the two pair names — everything its local
 *       {@code BlokLink} state needs, minus the two client-only fields
 *       ({@code syncedTotals}, {@code pendingSince}) which never leave the
 *       device;</li>
 *   <li>the <b>organiser</b> (`GET /tournaments/{id}/blok-links`) additionally
 *       reads who asked and when it was decided.</li>
 * </ul>
 * Keeping them identical means one mapper, one cache shape, and no chance of
 * the two screens disagreeing about what a link is.
 *
 * <p>{@code themPairId}/{@code themPairName} are derived, not stored: the
 * "them" side is whichever of the match's two pairs is not {@link #usPairId}.
 *
 * <p>{@code shareToken} is derived too — it lives on the linked
 * {@code blok_sessions} row, not on the link — and is the one field here that
 * is about publication rather than about the link itself. See its own note.
 */
public record BlokLinkDto(
        UUID uuid,
        /** PENDING | APPROVED | REJECTED | REVOKED */
        String status,

        UUID tournamentUuid,
        /** Pretty URL slug for deep links; null on legacy rows without one. */
        String tournamentSlug,
        String tournamentName,

        Long roundId,
        Integer roundNumber,
        /** Table number shown to humans; null on the rare match drawn without one. */
        Integer tableNo,
        Long matchId,

        /** The requester's own side of the match. */
        Long usPairId,
        String usPairName,
        /** The opponents. Never null: a BYE match cannot be linked. */
        Long themPairId,
        String themPairName,

        /** Firebase UID of the player who asked — the only one allowed to write the score. */
        String requestedByUid,
        /** Their display name as of the request. */
        String requestedByName,

        /**
         * The client's id for the blok series played at this table (§6.2), or
         * null when the link names none. Only the requester's own device has
         * any use for it; it is here so a blok that lost its local state can
         * tell whether the link it is looking at is the series it is running.
         */
        String sessionId,

        /**
         * Share token of the linked series' scorepad — the {@code {token}} in
         * {@code /blok/z/{token}} — or <b>null until one exists</b>
         * ({@code BLOK-LINK.md} §6.2).
         *
         * <p>Linking a blok to a table IS the consent to publish that record,
         * so the token is minted when a score is first written through an
         * {@code APPROVED} link and stays null before that, for a link whose
         * series was never uploaded, and for a link that names no series at
         * all. It is read from the series' own {@code share_token}, so a
         * player who shared the scorepad themselves sees the same token here —
         * and revoking the share (DELETE .../share) empties this field too.
         *
         * <p>It is never minted as a side effect of any other path, and it is
         * only ever the token of a series owned by this link's
         * {@code requestedByUid}.
         */
        String shareToken,

        OffsetDateTime createdAt,
        /** When it left PENDING; null while still waiting. */
        OffsetDateTime decidedAt,
        String decidedByUid
) {}
