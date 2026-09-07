package hr.mrodek.apps.bela_turniri.services;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import hr.mrodek.apps.bela_turniri.errors.ApiError;
import hr.mrodek.apps.bela_turniri.model.TournamentWaiter;
import hr.mrodek.apps.bela_turniri.model.TournamentWaiterSession;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.repository.TournamentWaiterRepository;
import hr.mrodek.apps.bela_turniri.repository.TournamentWaiterSessionRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.NotAuthorizedException;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Objects;

/**
 * Issues, lists, revokes and redeems waiter ("konobar") credentials.
 *
 * <p>The problem this solves is social, not technical: at a real tournament
 * the drinks are recorded by whoever is behind the bar, and today that
 * means the organiser hands over their unlocked phone — with full editing
 * rights over the draw, the scores and the pairs. A waiter needs exactly
 * one thing, the bills, and needs it on their own device, without an
 * account, in the ten seconds between two rounds.
 *
 * <p>A tournament can have several of them at once — several people behind
 * the bar, or a shift change mid-evening — so this is a LIST of named
 * credentials, not one shared code:
 *
 * <ul>
 *   <li><b>Four letters, no I and no O.</b> Read aloud across a noisy room
 *       and typed on a phone keyboard; {@code I}/{@code 1} and {@code O}/
 *       {@code 0} are the two confusions that actually happen. 24 letters to
 *       the fourth is ~332k codes per tournament, but several waiters can be
 *       active at once now — each ADDS a valid answer to that space, so a
 *       tournament with N active codes is N times easier to hit by guessing
 *       than the single-code design this replaced. {@link #redeem} therefore
 *       throttles failed attempts per tournament (see {@link #failedRedeems}):
 *       the codespace alone is no longer the whole story.</li>
 *   <li><b>Sessions in a table, one revoke per waiter.</b> Each credential's
 *       devices are withdrawn independently: revoking Ivan's code drops
 *       only Ivan's sessions, everyone else's bar staff keep working.
 *       {@link #revokeAll} exists too, for "shut the whole thing down".
 *       There is no expiry (a timer would kill a waiter mid-shift).</li>
 *   <li><b>The token is never a claim about identity.</b> It says "this
 *       device may see and settle bills for tournament X", nothing more —
 *       the {@code name} on the row is for the organiser's list, not
 *       something the waiter's session carries or proves.</li>
 * </ul>
 */
@ApplicationScoped
public class WaiterAccessService {

    private static final Logger LOG = Logger.getLogger(WaiterAccessService.class);

    /**
     * Uppercase A–Z minus {@code I} and {@code O}: read-aloud and typed-in
     * confusion with {@code 1} and {@code 0} is the single most likely way
     * a correct code gets rejected.
     */
    private static final char[] ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ".toCharArray();

    private static final int CODE_LENGTH = 4;

    /** Give up rather than loop forever if the active-code space is somehow exhausted. */
    private static final int MAX_CODE_ATTEMPTS = 20;

    /**
     * How stale {@code last_used_at} may get before we bother writing it.
     * A waiter's tablet polls the bill list constantly; without this every
     * read would drag a write behind it for no operational gain.
     */
    private static final long TOUCH_INTERVAL_SECONDS = 60;

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    /**
     * How many wrong codes a tournament tolerates before {@link #redeem}
     * refuses everyone — right or wrong — for that tournament until the
     * window below lapses.
     *
     * <p>Sized against Caddy's existing rate-limit zone (3000 req/min/IP),
     * which alone would let a single IP sweep the ~332k-code space of a
     * SINGLE active code in under two hours — and with several waiters
     * active at once, several codes are simultaneously valid, shrinking
     * that further. This cap makes the per-tournament redeem endpoint the
     * actual bottleneck: at most {@link #MAX_FAILED_REDEEMS} guesses per
     * {@link #FAILED_REDEEM_WINDOW}, no matter how many source IPs are
     * involved, which puts a real brute force back into the range of days
     * rather than hours regardless of how many codes happen to be live.
     */
    private static final int MAX_FAILED_REDEEMS = 20;

    /**
     * Rolling window a tournament's failed-attempt count is measured over.
     * {@link #recordFailedRedeem} re-{@code put}s on every failure, which
     * resets Caffeine's {@code expireAfterWrite} clock — so the window
     * slides with an ongoing attack instead of handing it a clean slate
     * every ten minutes, but a tournament that stops seeing wrong guesses
     * is back to normal ten minutes after the last one.
     */
    private static final Duration FAILED_REDEEM_WINDOW = Duration.ofMinutes(10);

    /**
     * In-memory, per-tournament count of failed {@link #redeem} attempts —
     * deliberately not a database table. This is throttling, not an audit
     * trail: losing it on a restart (a redeploy mid-attack, say) is a
     * harmless reset, not a correctness bug, and a table would add a write
     * to the hottest, most adversarial path in this feature for no benefit
     * over an in-process cache.
     */
    private final Cache<Long, Integer> failedRedeems = Caffeine.newBuilder()
            .expireAfterWrite(FAILED_REDEEM_WINDOW)
            .maximumSize(10_000)
            .build();

    @Inject TournamentAccess access;
    @Inject TournamentWaiterRepository waiterRepo;
    @Inject TournamentWaiterSessionRepository sessionRepo;
    @Inject MessageService messages;

    /** What {@link #redeem} hands back: the fresh credential and the tournament it opens. */
    public record WaiterRedeemResult(String token, Tournaments tournament, boolean canEditCjenik) {}

    /* ===================== organiser: manage ===================== */

    /** Every active waiter of the tournament, oldest invite first. */
    public List<TournamentWaiter> listWaiters(Tournaments t) {
        Objects.requireNonNull(t, "tournament");
        return waiterRepo.findActiveByTournamentId(t.getId());
    }

    /**
     * Hand a new, named credential to venue staff.
     *
     * <p>The code is generated here rather than left for the caller to
     * supply — a self-chosen code is a self-chosen password, and this one
     * is read aloud, not typed by its owner. Uniqueness is only checked
     * against this tournament's OTHER active codes: two different
     * tournaments (or a revoked row here) may share four letters without
     * ambiguity, since redemption is always scoped by tournament.
     *
     * @param canEditCjenik makes this ONE credential a "head waiter" —
     *                      unlocks the price list too, on top of the bills
     *                      every waiter can already read and settle. See
     *                      {@link #authorizeCjenikAccess}.
     *
     * <p>Caller must be transactional — this inserts.
     */
    public TournamentWaiter inviteWaiter(Tournaments t, String name, boolean canEditCjenik) {
        Objects.requireNonNull(t, "tournament");
        String trimmed = name == null ? "" : name.trim();

        TournamentWaiter row = new TournamentWaiter();
        row.setTournamentId(t.getId());
        row.setName(trimmed);
        row.setCode(freshCode(t.getId()));
        row.setCreatedAt(OffsetDateTime.now());
        row.setCanEditCjenik(canEditCjenik);
        waiterRepo.persist(row);
        return row;
    }

    /**
     * Withdraw one waiter's access. Sets {@code revokedAt} and drops only
     * THEIR sessions — every other waiter of this tournament is untouched.
     *
     * <p>404, not 403, on an id that doesn't belong to this tournament or
     * is already revoked: {@link TournamentWaiterRepository#findActiveByIdAndTournamentId}
     * is the IDOR guard, same shape as {@code MatchBillService.requireMatchOfTournament}.
     *
     * <p>Caller must be transactional.
     */
    public void revokeWaiter(Tournaments t, Long waiterId) {
        Objects.requireNonNull(t, "tournament");
        TournamentWaiter row = waiterRepo.findActiveByIdAndTournamentId(waiterId, t.getId())
                .orElseThrow(() -> new NotFoundException(messages.t("waiter.notFound")));
        row.setRevokedAt(OffsetDateTime.now());
        long dropped = sessionRepo.deleteByWaiterId(row.getId());
        LOG.infof("Waiter %d ('%s') revoked for tournament %d — %d session(s) dropped",
                row.getId(), row.getName(), t.getId(), dropped);
    }

    /**
     * Withdraw every active waiter of the tournament at once — the "shut it
     * all down" button, for when the organiser doesn't want to revoke one
     * name at a time. Caller must be transactional.
     */
    public void revokeAll(Tournaments t) {
        Objects.requireNonNull(t, "tournament");
        OffsetDateTime now = OffsetDateTime.now();
        long revoked = waiterRepo.revokeAllByTournamentId(t.getId(), now);
        long dropped = sessionRepo.deleteByTournamentId(t.getId());
        if (revoked > 0 || dropped > 0) {
            LOG.infof("All waiter access revoked for tournament %d — %d waiter(s), %d session(s)",
                    t.getId(), revoked, dropped);
        }
    }

    /* ===================== redeeming ===================== */

    /**
     * Trade a typed code for a session token.
     *
     * <p>The tournament is resolved through {@link TournamentAccess#load}
     * so an unknown id/slug 404s exactly as everywhere else — a waiter
     * endpoint must not become a way to probe which tournaments exist.
     *
     * <p>A wrong code is an {@link IllegalArgumentException}, which the
     * existing mapper turns into the standard 400 {@link ApiError}
     * envelope. No machine code: there is nothing for the SPA to branch on,
     * it just shows the message under the input.
     *
     * <p>Caller must be transactional — this inserts a session.
     */
    public WaiterRedeemResult redeem(String idOrSlug, String rawCode) {
        Tournaments t = access.load(idOrSlug);

        // Checked before the code is even looked up: a locked-out tournament
        // refuses a CORRECT code too, or the check would be pointless —
        // the whole point is capping total guesses, not just wrong ones.
        if (isLockedOut(t.getId())) {
            throw tooManyAttempts(idOrSlug);
        }

        String code = normalise(rawCode);
        TournamentWaiter waiter = waiterRepo.findActiveByTournamentIdAndCode(t.getId(), code).orElse(null);

        // No matching active code is indistinguishable to the caller from a
        // wrong one, on purpose: "this tournament has no waiter access"
        // would tell an outsider something about how it is being run.
        if (waiter == null) {
            recordFailedRedeem(t.getId());
            LOG.warnf("AUTHZ 400 WAITER redeem tournament=%s reason=invalid code", idOrSlug);
            throw new IllegalArgumentException(messages.t("waiter.invalidCode"));
        }

        // A real code landed — this tournament's count was never an attack,
        // or the attack just ended by succeeding. Either way there is
        // nothing left to throttle against until the next wrong guess.
        failedRedeems.invalidate(t.getId());

        TournamentWaiterSession session = new TournamentWaiterSession();
        session.setTournamentId(t.getId());
        session.setWaiterId(waiter.getId());
        session.setToken(ClaimTokens.generate());
        session.setCreatedAt(OffsetDateTime.now());
        sessionRepo.persist(session);

        return new WaiterRedeemResult(session.getToken(), t, waiter.isCanEditCjenik());
    }

    /* ===================== bill access ===================== */

    /**
     * Who {@link #authorizeBillAccess} / {@link #authorizeCjenikAccess} let
     * through: the tournament, and — when the caller is a waiter rather
     * than the organiser — which one. {@link #waiter} is null for the
     * organiser branch; {@link #isOrganiser} reads better than a null
     * check at call sites.
     */
    public record Caller(Tournaments tournament, TournamentWaiter waiter) {
        public boolean isOrganiser() {
            return waiter == null;
        }
    }

    /**
     * The gate {@code WaiterBillController} runs first: either the caller
     * is signed in and manages this tournament (the organiser acts as a
     * bartender too, with their own Firebase session — no waiter code of
     * their own needed), or they present a live waiter token scoped to
     * exactly this tournament.
     *
     * <p>The organiser branch runs before the token is even inspected:
     * checking {@code access.canManage} first means an organiser who
     * happens to also be holding someone else's waiter link on the same
     * device isn't routed down the token path by accident.
     */
    public Caller authorizeBillAccess(String idOrSlug, String token) {
        Tournaments t = access.load(idOrSlug);
        if (access.canManage(t)) return new Caller(t, null);
        TournamentWaiter w = requireActiveSession(t, idOrSlug, token);
        return new Caller(t, w);
    }

    /**
     * Same organiser-or-waiter gate as {@link #authorizeBillAccess}, but for
     * {@code PUT /tournaments/{idOrSlug}/cjenik}: a waiter also needs
     * {@link TournamentWaiter#isCanEditCjenik()} set, or a valid token still
     * 403s. Distinct from the 401 a bad/foreign/revoked token gets — this
     * caller genuinely IS an active waiter of this tournament, just not one
     * with the price list handed to them.
     */
    public Tournaments authorizeCjenikAccess(String idOrSlug, String token) {
        Tournaments t = access.load(idOrSlug);
        if (access.canManage(t)) return t;
        TournamentWaiter w = requireActiveSession(t, idOrSlug, token);
        if (!w.isCanEditCjenik()) {
            LOG.warnf("AUTHZ 403 WAITER cjenik tournament=%s waiter=%d reason=not head waiter",
                    idOrSlug, w.getId());
            throw new ForbiddenException(messages.t("waiter.cjenikForbidden"));
        }
        return t;
    }

    /**
     * Prove the presented token belongs to an ACTIVE waiter of exactly this
     * tournament — the cross-tournament and revoked-waiter checks that
     * matter, and hand back the row itself (its name, for bill attribution;
     * its {@code canEditCjenik} flag, for the cjenik gate). Without the
     * first check, a waiter at tonight's tournament could read — and
     * settle — the bills of any other tournament by changing the path
     * segment, since the token would still be valid on its own terms.
     * Without the second, revoking one waiter would not actually revoke
     * them: their already-minted session row would keep working until a
     * regenerate wiped every session, defeating the whole point of a
     * per-waiter revoke.
     *
     * <p>Every rejection is logged at WARN in the same {@code AUTHZ} shape
     * as {@code GenericExceptionMapper} / {@code SecurityAuditMappers}: a
     * stolen or guessed token leaves a trail. Only the last six characters
     * of the token are logged — enough to correlate a run of attempts,
     * useless to anyone reading the log later.
     */
    private TournamentWaiter requireActiveSession(Tournaments t, String idOrSlug, String token) {
        if (token == null || token.isBlank()) {
            throw rejectSession(idOrSlug, token, "missing token");
        }
        TournamentWaiterSession session = sessionRepo.findByToken(token.trim()).orElse(null);
        if (session == null) {
            // Unknown token: either revoked, or fabricated.
            throw rejectSession(idOrSlug, token, "unknown token");
        }
        if (!Objects.equals(session.getTournamentId(), t.getId())) {
            throw rejectSession(idOrSlug, token, "token belongs to another tournament");
        }
        // Every session minted by `redeem` carries a waiterId; a null one
        // here would mean a row this code no longer knows how to produce —
        // treat it the same as a revoked waiter rather than let a caller
        // through with nothing to attribute the action to.
        TournamentWaiter waiter = session.getWaiterId() == null
                ? null
                : waiterRepo.findActiveByIdAndTournamentId(session.getWaiterId(), t.getId()).orElse(null);
        if (waiter == null) {
            throw rejectSession(idOrSlug, token, "waiter revoked");
        }

        touch(session);
        return waiter;
    }

    /* ===================== internals ===================== */

    /**
     * A code not already held by an active waiter of this tournament.
     * Collisions are astronomically unlikely at ~332k possibilities, but
     * two different people reading the same four letters aloud at the same
     * bar is exactly the confusion this whole feature exists to prevent.
     */
    private String freshCode(Long tournamentId) {
        for (int attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
            String candidate = generateCode();
            if (!waiterRepo.activeCodeInUse(tournamentId, candidate)) return candidate;
        }
        // Practically unreachable (see class javadoc), but a silent
        // duplicate code would be a real bug, not a cosmetic one.
        throw new IllegalStateException(messages.t("waiter.codeSpaceExhausted"));
    }

    /** True once this tournament has hit {@link #MAX_FAILED_REDEEMS} wrong guesses in the current window. */
    private boolean isLockedOut(Long tournamentId) {
        Integer count = failedRedeems.getIfPresent(tournamentId);
        return count != null && count >= MAX_FAILED_REDEEMS;
    }

    /**
     * One more wrong guess against this tournament. A read-then-{@code put}
     * rather than an atomic increment on purpose: an undercount by one under
     * concurrent guesses is harmless for a rate limiter (the attacker still
     * hits the cap within a request or two), and {@code put} is what
     * actually resets Caffeine's {@code expireAfterWrite} clock — mutating a
     * shared counter object in place would not.
     */
    private void recordFailedRedeem(Long tournamentId) {
        Integer count = failedRedeems.getIfPresent(tournamentId);
        failedRedeems.put(tournamentId, (count == null ? 0 : count) + 1);
    }

    /**
     * 429 with the {@link ApiError} envelope, same explicit-{@code Response}
     * shape as {@link #rejectSession} and for the same reason: a bodyless
     * response is one the SPA cannot render a message from.
     */
    private WebApplicationException tooManyAttempts(String idOrSlug) {
        LOG.warnf("AUTHZ 429 WAITER redeem tournament=%s reason=too many failed attempts", idOrSlug);
        return new WebApplicationException(
                Response.status(429)
                        .type(MediaType.APPLICATION_JSON)
                        .entity(ApiError.of("TOO_MANY_REQUESTS", messages.t("waiter.tooManyAttempts")))
                        .build());
    }

    /**
     * 401 with the {@link ApiError} envelope, after the audit line.
     *
     * <p>Built explicitly rather than via {@code new
     * NotAuthorizedException(String)}: that constructor reads its argument
     * as a {@code WWW-Authenticate} challenge and leaves the body empty, so
     * the SPA would get a 401 it cannot render — the same trap
     * {@code CurrentUser.requireUid} documents.
     *
     * <p>Returns the exception instead of throwing it so the call sites
     * read {@code throw rejectSession(...)} — a void thrower would leave
     * the compiler thinking execution continues past a rejected token, and
     * the null-dereference right after would look like a real bug.
     */
    private NotAuthorizedException rejectSession(String idOrSlug, String token, String reason) {
        LOG.warnf("AUTHZ 401 WAITER tournament=%s token=…%s reason=%s",
                idOrSlug, tokenTail(token), reason);
        return new NotAuthorizedException(
                Response.status(Response.Status.UNAUTHORIZED)
                        .type(MediaType.APPLICATION_JSON)
                        .entity(ApiError.of("UNAUTHORIZED", messages.t("waiter.invalidToken")))
                        .build());
    }

    /**
     * Last six characters of the presented token, for correlating repeated
     * attempts without ever writing a working credential to a log file that
     * gets shipped, tailed and pasted into chat.
     */
    private static String tokenTail(String token) {
        if (token == null || token.isBlank()) return "none";
        String s = token.trim();
        return s.length() <= 6 ? "short" : s.substring(s.length() - 6);
    }

    /** Write {@code last_used_at} only when it is already stale — see {@link #TOUCH_INTERVAL_SECONDS}. */
    private void touch(TournamentWaiterSession session) {
        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime last = session.getLastUsedAt();
        if (last != null && last.plusSeconds(TOUCH_INTERVAL_SECONDS).isAfter(now)) return;
        try {
            sessionRepo.touchLastUsed(session.getId(), now);
        } catch (RuntimeException e) {
            // Activity bookkeeping must never cost the waiter their request.
            LOG.debugf(e, "Could not stamp last_used_at on waiter session %d", session.getId());
        }
    }

    /** Uppercase, whitespace-free. The code is copied off a screen; be generous. */
    private static String normalise(String raw) {
        return raw == null ? "" : raw.trim().toUpperCase(java.util.Locale.ROOT);
    }

    private static String generateCode() {
        StringBuilder sb = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            sb.append(ALPHABET[SECURE_RANDOM.nextInt(ALPHABET.length)]);
        }
        return sb.toString();
    }
}
