package hr.mrodek.apps.bela_turniri.enums;

/**
 * How late in the tournament a pair is allowed to buy a repassage
 * ("extra life") after their first loss. Stored as a string on the
 * tournament row so the column type doesn't change when new values
 * are added — only the enum + UI labels need updating.
 *
 * <p>Order is widest-to-narrowest in terms of when the repassage is
 * permitted:
 *   - {@code FINALS}     — available all the way up to the finals.
 *   - {@code SEMIFINALS} — available up to the semifinals; no
 *                          repassage once the semis are drawn.
 *   - {@code FIRST_ROUND}— available only after the first round; once
 *                          the second round starts, no more repassage.
 *                          Useful for shorter / smaller tournaments
 *                          where giving an extra life past round 1
 *                          would skew the bracket too much.
 */
public enum RepassageUntil {
    FINALS, SEMIFINALS, FIRST_ROUND
}