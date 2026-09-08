package hr.mrodek.apps.bela_turniri.repository;

import hr.mrodek.apps.bela_turniri.dtos.BlokNamesDto;
import hr.mrodek.apps.bela_turniri.dtos.BlokSessionSummaryDto;
import hr.mrodek.apps.bela_turniri.model.BlokSession;
import io.quarkus.panache.common.Parameters;
import jakarta.enterprise.context.ApplicationScoped;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Blok history — one row per series (see {@code BLOK-HISTORY.md} §3).
 *
 * <p><b>Every method here is scoped by {@code userUid}.</b> There is no
 * "find by uuid" that ignores the owner, on purpose: the contract wants a
 * foreign uuid to answer 404 rather than 403, and the cheapest way to
 * guarantee that is to make the un-scoped lookup impossible to call by
 * mistake. A row that belongs to someone else simply is not found.
 */
@ApplicationScoped
public class BlokSessionRepository implements AppRepository<BlokSession, Long> {

    /**
     * The listing query, exposed so a test can run it under a Hibernate
     * {@code StatementInspector} and assert that the generated SQL never
     * mentions {@code payload} — see
     * {@code BlokHistoryControllerTest.listingSqlNeverSelectsThePayload}. A
     * regression here is invisible at runtime (the DTO would look identical)
     * and expensive, so it is asserted rather than trusted.
     */
    public static final String SUMMARY_JPQL = """
            select new hr.mrodek.apps.bela_turniri.repository.BlokSessionSummaryRow(
                s.uuid, s.sessionId, s.startedAt, s.finishedAt, s.target, s.gameEndRule,
                s.nameUs, s.nameThem, s.gamesUs, s.gamesThem, s.gamesCount, s.createdAt)
            from BlokSession s
            where s.userUid = :uid
            order by s.createdAt desc, s.id desc
            """;

    /**
     * Separator inside {@link #shareTokenKey(String, String)}. A NUL, because
     * neither a Firebase uid nor a {@code crypto.randomUUID()} can contain one
     * — so no two (uid, sessionId) pairs can fold into the same key.
     */
    private static final char SESSION_KEY_SEP = '\0';

    /**
     * The history listing, newest first — <b>without the jsonb payload</b>.
     *
     * <p>This is an explicit constructor projection over the summary columns,
     * which is the whole reason those columns exist (§3.1). It is not a
     * "select the entity and hope the payload is lazy": a {@code @Basic(fetch
     * = LAZY)} attribute only really defers under bytecode enhancement, which
     * this build does not enable, so an entity query would have pulled every
     * series' full games blob into memory to render a list of scores. The
     * generated SQL selects exactly the twelve columns named below.
     *
     * <p>The component order of {@link BlokSessionSummaryDto} is part of this
     * query — see that record's javadoc.
     *
     * @param limit  already clamped by the service
     * @param offset already clamped by the service
     */
    public List<BlokSessionSummaryDto> findSummaries(String userUid, int limit, int offset) {
        if (userUid == null || userUid.isBlank()) return List.of();
        List<BlokSessionSummaryRow> rows = getEntityManager()
                .createQuery(SUMMARY_JPQL, BlokSessionSummaryRow.class)
                .setParameter("uid", userUid)
                .setFirstResult(offset)
                .setMaxResults(limit)
                .getResultList();

        // Fold the two name columns into the nested `names` object the wire
        // shape uses. Pure in-memory reshaping — no second query, and nothing
        // here can reach the payload column.
        return rows.stream()
                .map(r -> new BlokSessionSummaryDto(
                        r.uuid(), r.sessionId(), r.startedAt(), r.finishedAt(), r.target(),
                        r.gameEndRule(),
                        BlokNamesDto.of(r.nameUs(), r.nameThem()),
                        r.gamesUs(), r.gamesThem(), r.gamesCount(), r.createdAt()))
                .toList();
    }

    /**
     * One series with its payload, but only if it belongs to {@code userUid}.
     * Empty for an unknown uuid AND for someone else's — the caller cannot
     * tell the two apart, which is exactly §3.2's requirement.
     */
    public Optional<BlokSession> findOwn(String userUid, UUID uuid) {
        if (userUid == null || userUid.isBlank() || uuid == null) return Optional.empty();
        return find("userUid = :uid and uuid = :uuid",
                Parameters.with("uid", userUid).and("uuid", uuid))
                .firstResultOptional();
    }

    /**
     * The row for this client series id, if the upload already landed. The
     * read half of the idempotent save — see
     * {@code BlokHistoryService.save}.
     */
    public Optional<BlokSession> findBySessionId(String userUid, String sessionId) {
        if (userUid == null || userUid.isBlank() || sessionId == null || sessionId.isBlank()) {
            return Optional.empty();
        }
        return find("userUid = :uid and sessionId = :sid",
                Parameters.with("uid", userUid).and("sid", sessionId))
                .firstResultOptional();
    }

    /**
     * The record behind a live share link, whoever owns it.
     *
     * <p><b>The one method here that is not scoped by {@code userUid}</b>, and
     * the only one that may be — {@code GET /blok-share/{token}} is public and
     * has no caller to scope by. What makes that safe is that the key is the
     * {@code share_token}: a column that is NULL until the owner explicitly
     * shares the record and NULL again the moment they revoke, so a lookup
     * here can only ever reach a record whose owner asked for it to be
     * reachable. Note that it matches on {@code shareToken} alone and never
     * looks at {@code uuid} — a uuid handed to this method finds nothing, by
     * construction rather than by a check that could be forgotten.
     *
     * <p>A blank token short-circuits to empty rather than querying: a
     * {@code null} parameter against a unique column would match nothing
     * anyway, but every un-shared row has {@code share_token IS NULL} and it
     * costs one {@code if} to make that impossible to get wrong later.
     */
    public Optional<BlokSession> findByShareToken(String shareToken) {
        if (shareToken == null || shareToken.isBlank()) return Optional.empty();
        return find("shareToken = :t", Parameters.with("t", shareToken.trim()))
                .firstResultOptional();
    }

    /**
     * Whether {@code shareToken} currently names a shared series — the
     * existence half of {@link #findByShareToken}, for callers that only need
     * a boolean.
     *
     * <p>Its one caller is the {@code /live/blok/{token}} websocket handshake
     * ({@code realtime.BlokShareResolver}), which must refuse an invented or
     * revoked token before the upgrade completes and would otherwise pay for
     * loading a series' whole jsonb payload to learn one bit. Scoped by the
     * token exactly like {@link #findByShareToken}, and safe for the same
     * reason: the column is NULL until the owner shares and NULL again the
     * moment they revoke.
     */
    public boolean existsByShareToken(String shareToken) {
        if (shareToken == null || shareToken.isBlank()) return false;
        return count("shareToken = :t", Parameters.with("t", shareToken.trim())) > 0;
    }

    /**
     * Live share tokens for a batch of client series ids, keyed by
     * {@link #shareTokenKey(String, String)} — the owner's uid <em>and</em> the
     * series id together.
     *
     * <p>Behind {@code BLOK-LINK.md} §6.2: the organiser's bracket lists many
     * links at once and each needs the token of the series played at its table,
     * so this is one indexed read instead of a query per row.
     *
     * <p><b>Never a lookup by {@code sessionId} alone.</b> The query filters on
     * the id (that is the indexed part) but the result is keyed on the pair, so
     * a caller can only ever resolve a token for the uid it already holds — a
     * client series id guessed or copied from someone else matches a row filed
     * under a different uid and produces a different key, which nothing asks
     * for. Rows without a token are excluded, so "no entry" and "not shared"
     * are the same answer.
     */
    public Map<String, String> findShareTokensBySessionIds(Collection<String> sessionIds) {
        if (sessionIds == null || sessionIds.isEmpty()) return Map.of();
        List<Object[]> rows = getEntityManager().createQuery("""
                        select s.userUid, s.sessionId, s.shareToken from BlokSession s
                        where s.sessionId in :sids and s.shareToken is not null
                        """, Object[].class)
                .setParameter("sids", sessionIds)
                .getResultList();

        Map<String, String> out = new HashMap<>(rows.size());
        for (Object[] r : rows) {
            out.put(shareTokenKey((String) r[0], (String) r[1]), (String) r[2]);
        }
        return out;
    }

    /**
     * Key of {@link #findShareTokensBySessionIds}'s map: the owner's Firebase
     * uid and the client's series id, which is exactly what
     * {@code uq_blok_sessions_user_session} identifies a series by. The
     * separator is a NUL, which neither a Firebase uid nor a
     * {@code crypto.randomUUID()} can contain, so two different pairs cannot
     * collide into one key.
     */
    public static String shareTokenKey(String userUid, String sessionId) {
        return userUid + SESSION_KEY_SEP + sessionId;
    }

    /**
     * Write the series and hand back the stored row: insert it, or refresh the
     * one already filed under {@code (user_uid, session_id)}.
     *
     * <h2>Why this updates now (BLOK-HISTORY.md §5.1)</h2>
     * This used to be {@code ON CONFLICT DO NOTHING}, and correctly so: a
     * series was uploaded exactly once, when the player pressed "Resetiraj",
     * so a second POST could only ever be a retry of an identical body. Since
     * §5.1 the player chooses "Spremi i započni novu" at the start of every
     * game, so the <b>same series is uploaded again and again, one game longer
     * each time</b>. Skipping the conflict would freeze the profile on the
     * first game of the series.
     *
     * <h2>What the conflict does and does not touch</h2>
     * The SET list carries everything the client can change — payload, both
     * game tallies, {@code games_count}, {@code finished_at}, the two names,
     * {@code target}, {@code game_end_rule} — and deliberately omits {@code uuid},
     * {@code created_at}, {@code started_at} and {@code share_token}:
     * <ul>
     *   <li>{@code uuid} and {@code share_token} are what a link already sent
     *       to someone points at. Rewriting either would break every link
     *       mid-series, which §5.1 forbids in as many words.</li>
     *   <li>{@code created_at} is when the series first reached the server and
     *       is the history listing's sort key; refreshing it would reshuffle
     *       the profile every time the player starts a game.</li>
     *   <li>{@code started_at} is when the series began — a fact about the
     *       first game, which a later upload cannot know better.</li>
     * </ul>
     *
     * <h2>Why it is race-free</h2>
     * One statement, so there is no read-then-write window to lose. Postgres
     * resolves {@code ON CONFLICT} against the unique index itself: a
     * concurrent double-submit has one insert win, and the loser blocks on the
     * winner's row lock until that transaction ends and then applies its
     * UPDATE to the committed row. Neither caller sees an exception — which is
     * the second reason this is native SQL rather than {@code persist()}, the
     * same reason {@code IdempotencyService} gives: a JPA unique-constraint
     * violation dooms the persistence context, and the code has to keep
     * reading afterwards to answer 200.
     *
     * <p>{@code uuid} and {@code created_at} are passed explicitly because the
     * entity's {@code @PrePersist} and {@code @CreationTimestamp} do not run on
     * this path; on the conflict path Postgres discards both. {@code payload}
     * is cast to jsonb in SQL, so the JSON text is bound as a plain string and
     * no Hibernate type mapping is involved in the write at all.
     *
     * <p>The read-back is refreshed, and the flush before the write is what
     * makes that safe. Native SQL bypasses the persistence context, so an
     * entity loaded earlier in the same transaction — exactly what a second
     * {@code save()} inside one request produces — would otherwise be handed
     * back with its stale pre-update state. {@code refresh} fixes that, but
     * {@code refresh} also discards pending changes, so anything already
     * dirty (a share token minted a moment ago, say) is flushed to the
     * database first rather than left to Hibernate's auto-flush heuristics for
     * native queries.
     *
     * @return the stored row, or empty only if it vanished between the write
     *         and the read (a concurrent DELETE)
     */
    public Optional<BlokSession> upsertAndRead(BlokSession s) {
        getEntityManager().flush();
        getEntityManager().createNativeQuery("""
                        insert into blok_sessions
                            (id, uuid, session_id, user_uid, started_at, finished_at, target,
                             game_end_rule, name_us, name_them, games_us, games_them, games_count,
                             payload, created_at)
                        values (nextval('seq_blok_sessions_id'), :uuid, :sessionId, :userUid,
                                :startedAt, :finishedAt, :target, :gameEndRule,
                                :nameUs, :nameThem, :gamesUs, :gamesThem, :gamesCount,
                                cast(:payload as jsonb), :createdAt)
                        on conflict (user_uid, session_id) do update set
                            finished_at   = excluded.finished_at,
                            target        = excluded.target,
                            game_end_rule = excluded.game_end_rule,
                            name_us       = excluded.name_us,
                            name_them     = excluded.name_them,
                            games_us      = excluded.games_us,
                            games_them    = excluded.games_them,
                            games_count   = excluded.games_count,
                            payload       = excluded.payload
                        """)
                .setParameter("uuid", s.getUuid())
                .setParameter("sessionId", s.getSessionId())
                .setParameter("userUid", s.getUserUid())
                .setParameter("startedAt", s.getStartedAt())
                .setParameter("finishedAt", s.getFinishedAt())
                .setParameter("target", s.getTarget())
                .setParameter("gameEndRule", s.getGameEndRule())
                .setParameter("nameUs", s.getNameUs())
                .setParameter("nameThem", s.getNameThem())
                .setParameter("gamesUs", s.getGamesUs())
                .setParameter("gamesThem", s.getGamesThem())
                .setParameter("gamesCount", s.getGamesCount())
                .setParameter("payload", s.getPayload())
                .setParameter("createdAt", s.getCreatedAt() != null ? s.getCreatedAt() : OffsetDateTime.now())
                .executeUpdate();

        Optional<BlokSession> stored = findBySessionId(s.getUserUid(), s.getSessionId());
        stored.ifPresent(getEntityManager()::refresh);
        return stored;
    }

    /**
     * Delete one of the caller's own series.
     *
     * @return the number of rows removed — 0 means "not yours, or not there",
     *         which the service turns into a 404
     */
    public long deleteOwn(String userUid, UUID uuid) {
        if (userUid == null || userUid.isBlank() || uuid == null) return 0;
        return delete("userUid = :uid and uuid = :uuid",
                Parameters.with("uid", userUid).and("uuid", uuid));
    }
}
