package hr.mrodek.apps.bela_turniri.dtos;

import java.util.UUID;

/**
 * "You are sitting at this table right now" — one answer of
 * {@code GET /blok-links/suggestions} ({@code BLOK-LINK.md} §8.2).
 *
 * <pre>
 * {
 *   "tournamentUuid": "…", "tournamentSlug": "…|null", "tournamentName": "…",
 *   "roundId": 5, "roundNumber": 3,
 *   "matchId": 12, "tableNo": 4,
 *   "myPairId": 34, "myPairName": "Ivan i Marko",
 *   "opponentPairId": 35, "opponentPairName": "Ana i Petra"
 * }
 * </pre>
 *
 * <p>Every field is exactly what the blok needs to skip the three-step
 * "which tournament / which table / which side are you" dialog of §7.3 and
 * send the request straight off: {@code matchId} and {@code myPairId} are the
 * two values {@link CreateBlokLinkRequest} takes, and the rest is the sentence
 * the offer is worded with ("Igraš na turniru X — Runda 3, stol 4").
 *
 * <p>{@code tableNo} is nullable — a match can be drawn without one — and
 * {@code tournamentSlug} is nullable on rows that predate slugs. Nothing else
 * here can be null: the query only ever produces matches with both pairs
 * present, which is also why there is no "BYE" case to render.
 *
 * <p>Deliberately <b>not</b> {@link BlokLinkTargetDto}. That shape describes
 * a table the player is choosing from a list and carries a {@code linkable}
 * flag with the reason it is greyed out; a suggestion is a table the server
 * has already decided is theirs, so an unlinkable one is simply not returned.
 * Sharing one record would have meant a flag that is always true and a pair
 * of fields ("us"/"them") that do not yet mean anything at suggestion time.
 */
public record BlokLinkSuggestionDto(
        UUID tournamentUuid,
        /** Pretty URL slug; null on legacy tournaments without one. */
        String tournamentSlug,
        String tournamentName,

        Long roundId,
        Integer roundNumber,

        Long matchId,
        /** Table number shown to humans; null on the rare match drawn without one. */
        Integer tableNo,

        /** The caller's own pair — the one they submitted or co-submitted. */
        Long myPairId,
        String myPairName,

        /** The other side. Never null: a BYE is never suggested. */
        Long opponentPairId,
        String opponentPairName
) {}
