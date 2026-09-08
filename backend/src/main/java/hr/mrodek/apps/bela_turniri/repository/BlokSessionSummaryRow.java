package hr.mrodek.apps.bela_turniri.repository;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Internal projection row for {@link BlokSessionRepository#findSummaries} —
 * <b>not a wire shape</b>. It never leaves the repository package boundary in
 * a response; {@code BlokSessionSummaryDto} is what clients see.
 *
 * <p>It exists for one reason: the listing must not read the {@code payload}
 * column ({@code BLOK-HISTORY.md} §3.1), so the query is an explicit JPQL
 * constructor projection over the summary columns — and JPQL cannot construct
 * the nested {@code names} object the DTO carries. So the query builds this
 * flat record and the repository folds the two name columns into
 * {@code BlokNamesDto} afterwards, in Java, without touching the database
 * again.
 *
 * <p><b>Component order is part of the query.</b> Reordering these without
 * reordering the {@code select new …(…)} list in
 * {@link BlokSessionRepository#SUMMARY_JPQL} is a runtime failure, not a
 * compile error.
 */
public record BlokSessionSummaryRow(
        UUID uuid,
        String sessionId,
        OffsetDateTime startedAt,
        OffsetDateTime finishedAt,
        Integer target,
        /** {@code "dosta"} | {@code "prolaz"} — §5.5, a column so the listing
            can print "Do 1001 · prolaz" without reading the payload. */
        String gameEndRule,
        String nameUs,
        String nameThem,
        Integer gamesUs,
        Integer gamesThem,
        Integer gamesCount,
        OffsetDateTime createdAt
) {}
