package hr.mrodek.apps.bela_turniri.services;

import hr.mrodek.apps.bela_turniri.model.Matches;
import hr.mrodek.apps.bela_turniri.model.Pairs;
import hr.mrodek.apps.bela_turniri.model.Rounds;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.repository.MatchDrinkRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

/**
 * Every push notification the round/match flow emits, in one place.
 *
 * <p>Split out of {@code RoundService}, which had grown two verbatim copies
 * of the round-draw push loop (one inline in {@code drawNextRound}, one in a
 * {@code notifyMatches} helper used by {@code drawManualRound}).
 *
 * <h2>Language rule</h2>
 * <p>Notification copy is written for the RECIPIENT, not for the organiser
 * whose request happens to trigger it, so every payload here is built through
 * {@link PushService#sendToUser(String, java.util.function.Function)}: that
 * resolves the recipient's stored {@code UserProfile.locale} on the request
 * thread and hands it to the factory, which then calls
 * {@code messages.t(locale, key, …)}. One payload per recipient — never build
 * one and reuse it for both members of a pair.
 *
 * <h2>Threading / transactions</h2>
 * <p>Every method here runs on the caller's request thread, inside the
 * caller's transaction, and touches managed entities freely. {@code PushService}
 * flattens the payload to JSON immediately and defers the actual HTTP sends
 * until after commit, so a rolled-back round never announces itself. Nothing
 * here opens a transaction of its own — the {@code @Transactional} boundary
 * stays on the calling service method.
 */
@ApplicationScoped
public class RoundNotifier {

    /** Notification icon, same for every payload the app sends. */
    private static final String ICON = "/bela-turniri-symbol.png";

    @Inject
    PushService pushService;
    @Inject
    MessageService messages;
    @Inject
    MatchDrinkRepository matchDrinkRepo;

    /**
     * Send a "Runda X" push notification to every UID linked to each pair
     * playing in {@code round}.
     *
     * <p>BYE rows ({@code pair2 == null}) are skipped — there's no opponent
     * to announce and no table to head to. Errors inside {@code sendToUser}
     * are swallowed by {@link PushService}, so a flaky push provider can
     * never roll back the round.
     */
    public void notifyMatches(Tournaments t, Rounds round, List<Matches> matches) {
        if (t == null || round == null || matches == null) return;
        String tournamentRef = tournamentRef(t);
        for (Matches m : matches) {
            if (m.getPair2() == null) continue; // BYE — no opponent
            Pairs p1 = m.getPair1();
            Pairs p2 = m.getPair2();
            if (p1 == null) continue;
            Integer tbl = m.getTableNo();
            // Deep-link to the specific match: TournamentDetailsPage reads
            // ?match={id} on mount, switches to the Ždrijeb tab, expands the
            // round, and scrolls the row into view (no modal opened — there's
            // no bill yet at this point in the tournament). SPA route is
            // /turniri/{slug} since the Croatian-routes refactor; emitting the
            // canonical URL means the SW notification-click handler navigates
            // without a redirect hop.
            String matchUrl = "/turniri/" + tournamentRef + "?match=" + m.getId();
            // Tag groups notifications per round so a re-draw or a follow-up
            // notification for the same player+round replaces the previous one
            // instead of stacking on the lock screen.
            String tag = "round-" + round.getId() + "-pair-";
            // Notify every UID linked to either pair (primary submitter and
            // co-owner from the share-link claim). Same information for both —
            // they both need to know which table to head to — but resolved
            // ONE PAYLOAD PER RECIPIENT, in that player's own language.
            for (String uid : pairUids(p1)) {
                pushService.sendToUser(uid, locale -> roundPayload(
                        locale, round, p1, p2, tbl, matchUrl,
                        tag + p1.getId() + "-" + uid));
            }
            for (String uid : pairUids(p2)) {
                pushService.sendToUser(uid, locale -> roundPayload(
                        locale, round, p1, p2, tbl, matchUrl,
                        tag + p2.getId() + "-" + uid));
            }
        }
    }

    /**
     * Push the loser of a freshly-finished match a notification with the
     * table's current bill total — they're the one who pays per Belot
     * tradition. Both the primary submitter AND the share-link co-owner get
     * it (each on their own devices, each in their own language).
     *
     * <p>Silent no-op when:
     * <ul>
     *   <li>BYE match (no opponent, nothing to settle)</li>
     *   <li>no winner decided yet</li>
     *   <li>neither side of the losing pair has a known user UID</li>
     * </ul>
     *
     * <p>Push failures are swallowed by {@link PushService} so a flaky
     * provider can't roll back the score update.
     */
    public void notifyLoser(Tournaments t, Matches m) {
        if (t == null || m == null) return;
        if (m.getPair2() == null) return; // BYE
        if (m.getWinnerPair() == null) return;
        if (m.getPair1() == null) return;

        Pairs loser = Objects.equals(m.getWinnerPair().getId(), m.getPair1().getId())
                ? m.getPair2() : m.getPair1();
        if (loser == null) return;
        var uids = pairUids(loser);
        if (uids.isEmpty()) return;

        // Compute current bill total. We don't bail on an empty bill — we
        // still tell the loser they lost, with 0,00 € as the body. That way
        // they know the match was scored even before any drinks were attached.
        BigDecimal total = BigDecimal.ZERO;
        for (var d : matchDrinkRepo.findByMatchId(m.getId())) {
            total = total.add(d.getPriceSnapshot()
                    .multiply(BigDecimal.valueOf(d.getQuantity())));
        }
        String totalStr = new DecimalFormat("0.00").format(total).replace('.', ',');

        String tournamentRef = tournamentRef(t);
        Integer tbl = m.getTableNo();
        // Tag scopes the notification to this match so a re-score doesn't
        // stack multiple notifications on the lock screen.
        String tag = "loss-match-" + m.getId();

        // Deep-link straight to the bill modal. TournamentDetailsPage reads
        // ?bill={matchId} on mount and (a) switches to the Ždrijeb tab,
        // (b) expands the round, (c) scrolls to the match, (d) auto-opens
        // the bill dialog.
        String billUrl = "/turniri/" + tournamentRef + "?bill=" + m.getId();
        // Per recipient, in the loser's own language — the organiser who
        // scored the match is a different person with a different X-Locale.
        for (String uid : uids) {
            pushService.sendToUser(uid, locale -> new PushService.PushPayload(
                    messages.t(locale, "push.matchLost.title"),
                    (tbl != null)
                            ? messages.t(locale, "push.bill.bodyWithTable",
                                    String.valueOf(tbl), totalStr)
                            : messages.t(locale, "push.bill.body", totalStr),
                    billUrl,
                    ICON,
                    tag + "-" + uid));
        }
    }

    /**
     * "Runda X" payload for ONE recipient, rendered in {@code locale} — the
     * language that recipient stored on their profile, handed in by
     * {@link PushService#sendToUser(String, java.util.function.Function)}.
     *
     * <p>Called on the request thread (never on the push sender pool), so
     * touching {@code round} / {@code p1} / {@code p2} here is safe.
     */
    private PushService.PushPayload roundPayload(
            Locale locale, Rounds round, Pairs p1, Pairs p2,
            Integer tbl, String matchUrl, String tag) {
        String title = messages.t(locale, "push.round.title", String.valueOf(round.getNumber()));
        String body = (tbl != null)
                ? messages.t(locale, "push.round.bodyWithTable",
                        p1.getName(), p2.getName(), String.valueOf(tbl))
                : messages.t(locale, "push.round.body", p1.getName(), p2.getName());
        return new PushService.PushPayload(title, body, matchUrl, ICON, tag);
    }

    /**
     * The path segment used in deep links: the slug when there is one,
     * otherwise the uuid (and "" for a tournament with neither, which
     * cannot happen for a persisted row).
     */
    static String tournamentRef(Tournaments t) {
        if (t == null) return "";
        if (t.getSlug() != null && !t.getSlug().isBlank()) return t.getSlug();
        return t.getUuid() != null ? t.getUuid().toString() : "";
    }

    /**
     * All UIDs linked to a pair — the primary submitter and (if claimed) the
     * share-link co-owner. Order is primary first, then co-owner.
     */
    static List<String> pairUids(Pairs p) {
        if (p == null) return List.of();
        List<String> out = new ArrayList<>(2);
        if (p.getSubmittedByUid() != null && !p.getSubmittedByUid().isBlank()) {
            out.add(p.getSubmittedByUid());
        }
        if (p.getCoSubmittedByUid() != null && !p.getCoSubmittedByUid().isBlank()) {
            out.add(p.getCoSubmittedByUid());
        }
        return out;
    }
}
