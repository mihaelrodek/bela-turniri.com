package hr.mrodek.apps.bela_turniri.services;

import hr.mrodek.apps.bela_turniri.dtos.BlokLinkCreatedDto;
import hr.mrodek.apps.bela_turniri.dtos.BlokLinkDto;
import hr.mrodek.apps.bela_turniri.dtos.BlokLinkScoreRequest;
import hr.mrodek.apps.bela_turniri.dtos.BlokLinkSuggestionDto;
import hr.mrodek.apps.bela_turniri.dtos.BlokLinkTargetDto;
import hr.mrodek.apps.bela_turniri.dtos.CreateBlokLinkRequest;
import hr.mrodek.apps.bela_turniri.dtos.UpdateMatchRequest;
import hr.mrodek.apps.bela_turniri.enums.MatchScoreLinkStatus;
import hr.mrodek.apps.bela_turniri.enums.MatchStatus;
import hr.mrodek.apps.bela_turniri.enums.RoundStatus;
import hr.mrodek.apps.bela_turniri.enums.TournamentStatus;
import hr.mrodek.apps.bela_turniri.errors.ApiCodes;
import hr.mrodek.apps.bela_turniri.errors.ApiError;
import hr.mrodek.apps.bela_turniri.mappers.BlokLinkMapper;
import hr.mrodek.apps.bela_turniri.model.MatchScoreLink;
import hr.mrodek.apps.bela_turniri.model.Matches;
import hr.mrodek.apps.bela_turniri.model.Pairs;
import hr.mrodek.apps.bela_turniri.model.Rounds;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.realtime.LiveBroadcaster;
import hr.mrodek.apps.bela_turniri.repository.BlokSessionRepository;
import hr.mrodek.apps.bela_turniri.repository.MatchScoreLinkRepository;
import hr.mrodek.apps.bela_turniri.repository.MatchesRepository;
import hr.mrodek.apps.bela_turniri.repository.RoundsRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.NotAuthorizedException;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * "Poveži blok sa stolom" — the whole domain of {@code BLOK-LINK.md} §2.
 *
 * <p>A player running the local bela blok asks to be linked to one table of a
 * running tournament; the organiser approves; from then on the player's own
 * <b>series result</b> — how many games each side has won, the {@code 2 : 1} a
 * tournament match is scored in (§6.1) — lands in the organiser's score sheet.
 * The organiser's approval is the entire defence — this codebase has no notion
 * of a user belonging to a pair (see BLOK-LINK.md §5), so <em>anyone</em> may
 * ask.
 *
 * <h2>Asking does not need an account (§7.1)</h2>
 * Signing in used to be what told the server <b>who</b> may write into a given
 * match. §7 drops that requirement, and a per-link bearer secret takes over
 * the same job — the pattern this project already uses for venue staff with no
 * account ({@code WaiterAccessService}). Concretely:
 *
 * <ul>
 *   <li>{@link #request} accepts an anonymous caller, mints a
 *       {@code writeToken} through {@link ClaimTokens} and returns it
 *       <b>once</b>, inside {@link BlokLinkCreatedDto}. No other response
 *       carries it — see that record.</li>
 *   <li>An anonymous request must be <b>signed with a name</b> (2–60
 *       characters, {@code 400 NAME_REQUIRED} otherwise): the organiser
 *       approves a person, and a nameless, accountless claim on a table is
 *       not something they can decide about.</li>
 *   <li>{@link #submitScore}, {@link #getOne} and {@link #revoke} accept
 *       <b>either</b> the signed-in {@code requestedByUid} — unchanged, still
 *       compared by uid and never by token presence — <b>or</b> a matching
 *       {@code writeToken}. Anything else is 401.</li>
 * </ul>
 *
 * <p>A token is a permission, never an identity: {@link #authorise} does not
 * make its holder the link's {@code requestedByUid}, so nothing keyed on that
 * uid (the published scorepad of §6.2, {@link #listMine}, the decision push)
 * follows a stolen token anywhere. What it can do is exactly one thing —
 * write a score into the one match its link names, and only after an organiser
 * has approved that link.
 *
 * <h2>What signing in still buys (§7.2)</h2>
 * A public scorepad. Share tokens hang off {@code blok_sessions}, which is
 * owned by a Firebase uid, so an anonymous link carries a result to the
 * organiser and nothing else: {@code shareToken} stays null for it, by
 * construction rather than by a check.
 *

 * <h2>Linking is also consent to publish (§6.2)</h2>
 * A link may name the blok <em>series</em> being played at that table (the
 * client's own {@code sessionId}). Writing a score through an approved link
 * then makes that scorepad public: the series' share token is minted through
 * {@link BlokHistoryService#shareSeries}, so the organiser's bracket can offer
 * {@code /blok/z/{token}} during and after the tournament. Minting happens on
 * that one path and nowhere else, always for the link's own
 * {@code requestedByUid}, and every other method here only ever <em>reads</em>
 * tokens that already exist.
 *
 * <p>No {@code @Transactional} here, deliberately: the JAX-RS resource methods
 * are already transactional and hand in managed entities, exactly as
 * {@link TournamentPairService} documents. Opening a second transaction would
 * detach them and silently drop the writes.
 *
 * <h2>The score path is the sharp edge</h2>
 * This is the only place in the application where someone who is not the
 * organiser writes into a {@code Matches} row, so
 * {@link #submitScore(UUID, BlokLinkScoreRequest)} re-derives every
 * precondition on every call rather than trusting the approval it was granted
 * ten minutes ago: the round can complete, the tournament can finish, the
 * organiser can revoke, all between two pushes of the same game.
 */
@ApplicationScoped
public class BlokLinkService {

    private static final Logger LOG = Logger.getLogger(BlokLinkService.class);

    @Inject MatchScoreLinkRepository linkRepo;
    @Inject MatchesRepository matchesRepo;
    @Inject RoundsRepository roundsRepo;
    @Inject BlokLinkMapper mapper;

    @Inject TournamentAccess access;
    @Inject CurrentUser currentUser;
    @Inject MessageService messages;
    @Inject PushService pushService;
    @Inject SlugService slugService;
    @Inject RoundService roundService;
    @Inject LiveBroadcaster live;
    @Inject BlokHistoryService history;

    /* ===================== DTO assembly — §6.2 ===================== */

    /**
     * One link plus the share token of the series played at its table, if the
     * series has one.
     *
     * <p>Always a <b>read</b>: the token is minted on exactly one path, the
     * score write, because that is the moment the contract calls consent.
     * Everything else — requesting, approving, listing — reports whatever
     * token already exists and creates none.
     *
     * <p>The lookup is keyed on {@code (requestedByUid, sessionId)}, so a link
     * can only ever surface the token of a series belonging to the player who
     * made the link. A series id copied from somebody else resolves to
     * nothing.
     */
    private BlokLinkDto toDto(MatchScoreLink l) {
        String token = null;
        if (l.getSessionId() != null && !l.getSessionId().isBlank()) {
            token = history.lookupShareTokens(List.of(l.getSessionId()))
                    .get(BlokSessionRepository.shareTokenKey(l.getRequestedByUid(), l.getSessionId()));
        }
        return mapper.toDto(l, token);
    }

    /**
     * A whole listing, with the tokens resolved in <b>one</b> query rather
     * than one per row — the organiser's bracket renders every link of the
     * tournament at once.
     */
    private List<BlokLinkDto> toDtoList(List<MatchScoreLink> links) {
        List<String> sessionIds = links.stream()
                .map(MatchScoreLink::getSessionId)
                .filter(s -> s != null && !s.isBlank())
                .distinct()
                .toList();
        Map<String, String> tokens = history.lookupShareTokens(sessionIds);

        return links.stream()
                .map(l -> mapper.toDto(l, l.getSessionId() == null ? null
                        : tokens.get(BlokSessionRepository.shareTokenKey(
                                l.getRequestedByUid(), l.getSessionId()))))
                .toList();
    }

    /**
     * The client's series id as it is stored: trimmed, and <b>absent when it
     * is blank or wider than the column</b> rather than an error.
     *
     * <p>§6.2 makes the share token a consequence of writing a score, never a
     * condition for it, so a broken or over-long id must not cost the player
     * their result. An id over 64 characters could not match a
     * {@code blok_sessions} row in any case — {@code BlokHistoryService}
     * refuses to store one — so treating it as absent loses nothing that was
     * ever reachable.
     */
    private static String normaliseSessionId(String raw) {
        if (raw == null) return null;
        String s = raw.trim();
        if (s.isEmpty() || s.length() > MAX_SESSION_ID) return null;
        return s;
    }

    /** Width of {@code match_score_links.session_id}, and of its counterpart on {@code blok_sessions}. */
    private static final int MAX_SESSION_ID = 64;

    /**
     * Ping every open tournament page. Deferred until the caller's transaction
     * commits (see {@link LiveBroadcaster}). {@code SCOPE_MATCH} covers all of
     * it on purpose — the frontend refetches everything on any ping, and a new
     * scope would need whitelisting in the broadcaster for no gain.
     */
    private void broadcast(Tournaments t) {
        if (t == null || t.getUuid() == null) return;
        live.notifyTournament(t.getUuid().toString(), LiveBroadcaster.SCOPE_MATCH);
    }

    /* ===================== Targets ===================== */

    /**
     * The tables a blok could link to right now: every match of the
     * tournament's <em>active</em> round — the highest-numbered round that is
     * not {@code COMPLETED} (there is no "is active" flag; see §1).
     *
     * <p>Unlinkable rows are returned too, flagged, so the player sees the
     * whole round and is told why table 3 is greyed out. An empty list means
     * "nothing to link to": no rounds drawn yet, the last round is finished,
     * or the tournament is over.
     */
    public List<BlokLinkTargetDto> listTargets(String tournamentIdOrSlug) {
        Tournaments t = access.load(tournamentIdOrSlug);
        if (t.getStatus() == TournamentStatus.FINISHED) return List.of();

        Rounds active = activeRound(t);
        if (active == null) return List.of();

        Set<Long> alreadyLinked = new HashSet<>(linkRepo.findActiveMatchIdsByTournamentId(t.getId()));

        List<BlokLinkTargetDto> out = new ArrayList<>();
        for (Matches m : matchesRepo.findByRound_IdOrderByTableNoAsc(active.getId())) {
            String reason = null;
            if (m.getPair2() == null) {
                reason = "MATCH_HAS_BYE";
            } else if (alreadyLinked.contains(m.getId())) {
                reason = "LINK_EXISTS";
            }
            out.add(new BlokLinkTargetDto(
                    m.getId(),
                    m.getTableNo(),
                    active.getId(),
                    active.getNumber(),
                    pairRef(m.getPair1()),
                    pairRef(m.getPair2()),
                    reason == null,
                    reason));
        }
        return out;
    }

    private static BlokLinkTargetDto.PairRef pairRef(Pairs p) {
        return p == null ? null : new BlokLinkTargetDto.PairRef(p.getId(), p.getName());
    }

    /**
     * Highest-numbered round that is not COMPLETED, or null. Reads the whole
     * (small) round list rather than asking for "the last round" and then
     * checking its status: the newest round can legitimately be completed
     * while an older one was reopened by a re-score.
     */
    private Rounds activeRound(Tournaments t) {
        Rounds best = null;
        for (Rounds r : roundsRepo.findByTournament_Id(t.getId())) {
            if (r.getStatus() == RoundStatus.COMPLETED) continue;
            if (best == null || r.getNumber() > best.getNumber()) best = r;
        }
        return best;
    }

    /* ===================== Request ===================== */

    /**
     * Ask to be linked to a table. Lands in {@code PENDING} and pushes the
     * organiser; nothing reaches the score sheet until they approve.
     *
     * <p><b>No account required</b> (§7.1). A signed-in caller is stored
     * exactly as before — uid plus their account's display name — and a
     * signed-out one is stored with a null uid and the name they typed. Both
     * get a freshly minted {@code writeToken} back, once, in the returned
     * {@link BlokLinkCreatedDto}; it is generated here and never read out of
     * the database again by anything.
     *
     * <p>The name check runs <b>first</b>, before the match is even looked up.
     * It is the one condition that is about the caller rather than about the
     * table, and answering it first means an anonymous client learns nothing
     * about which match ids exist by watching which error comes back.
     *
     * <p>The optional {@code sessionId} names the blok series being played at
     * that table (§6.2). Storing it here is not itself publication — no token
     * is minted on this path — it only records which scorepad an approved link
     * will later publish. A link that arrives without one can still adopt it on
     * its first score push, so an older client is not shut out. For an
     * anonymous link it is stored and then never resolves to anything: a
     * scorepad lives on a profile, and there is no profile (§7.2).
     */
    public BlokLinkCreatedDto request(CreateBlokLinkRequest body) {
        String myUid = currentUser.uidOrNull();
        String name = requesterName(myUid, body.requestedByName());

        Matches m = matchesRepo.findByIdOptional(body.matchId())
                .orElseThrow(() -> new NotFoundException(messages.t("match.notFound")));

        Tournaments t = m.getTournament();
        Rounds r = m.getRound();

        assertLinkable(t, r);
        if (m.getPair2() == null) throw ApiCodes.conflict("MATCH_HAS_BYE");

        Pairs usPair = sideOf(m, body.usPairId());
        if (usPair == null) throw ApiCodes.conflict("PAIR_NOT_IN_MATCH");

        // Cheap pre-check with a friendly code; uq_msl_active_per_match is the
        // backstop if two players hit the same table in the same millisecond.
        if (linkRepo.findActiveByMatchId(m.getId()).isPresent()) {
            throw ApiCodes.conflict("LINK_EXISTS");
        }

        // Make sure the requester has a UserProfile before anything is stored:
        // the decision push resolves their language off that row, and without
        // it a Slovenian player would be answered in Croatian. Same reason
        // SelfRegistrationService does this. Skipped for an anonymous caller —
        // there is no uid to key a profile on, and nowhere to push a decision.
        if (myUid != null) slugService.ensureProfile(myUid, currentUser.displayName());

        MatchScoreLink link = new MatchScoreLink();
        link.setMatch(m);
        link.setTournament(t);
        link.setUsPair(usPair);
        link.setStatus(MatchScoreLinkStatus.PENDING);
        link.setRequestedByUid(myUid);
        link.setRequestedByName(name);
        link.setSessionId(normaliseSessionId(body.sessionId()));
        // §7.1: the device secret. Minted for every link, signed-in ones
        // included — a blok stores it the same way whoever is holding the
        // phone, and a player who signs out mid-tournament does not lose the
        // table they are already at.
        link.setWriteToken(ClaimTokens.generate());
        linkRepo.save(link);

        notifyOrganiserOfRequest(t, m, link);

        broadcast(t);
        return new BlokLinkCreatedDto(toDto(link), link.getWriteToken());
    }

    /* ---- §7.1: who is asking ---- */

    /** Shortest name the organiser could act on. */
    private static final int MIN_NAME = 2;
    /** Longest name accepted from an anonymous caller; the column holds 120. */
    private static final int MAX_NAME = 60;

    /**
     * The name to file the request under.
     *
     * <p>A signed-in caller signs with their account, exactly as before —
     * whatever they typed in the body is ignored, because the account name is
     * the one the organiser can actually check against the pair list. Only
     * when the account has no display name at all does the body's name stand
     * in, and then it is validated like an anonymous one.
     *
     * <p>A signed-out caller <b>must</b> supply one, 2–60 characters after
     * trimming, or the request is refused with the bare code
     * {@code NAME_REQUIRED} (400). §7.1 is explicit about why: the organiser
     * approves a person, and "someone at some table" is not a person. There is
     * no fallback to {@code blokLink.anonymousPlayer} here — that string is
     * for rendering an old row that has no name, not for minting new ones.
     */
    private String requesterName(String uid, String fromBody) {
        if (uid != null) {
            String fromAccount = trimTo(currentUser.displayName(), 120);
            if (fromAccount != null) return fromAccount;
        }
        String typed = fromBody == null ? "" : fromBody.trim();
        if (typed.length() < MIN_NAME || typed.length() > MAX_NAME) {
            if (uid == null) throw ApiCodes.badRequest("NAME_REQUIRED");
            // Signed in, no display name, nothing usable typed: the row can
            // carry no name, as it always could. Not an error — the account
            // itself is the signature.
            return null;
        }
        return typed;
    }

    /** The pair of {@code m} with this id, or null when the id is not in this match. */
    private static Pairs sideOf(Matches m, Long pairId) {
        if (pairId == null) return null;
        if (m.getPair1() != null && Objects.equals(m.getPair1().getId(), pairId)) return m.getPair1();
        if (m.getPair2() != null && Objects.equals(m.getPair2().getId(), pairId)) return m.getPair2();
        return null;
    }

    /**
     * Shared state gate: a link only makes sense on a live round of a live
     * tournament. Throws the bare codes the SPA compares literally.
     */
    private static void assertLinkable(Tournaments t, Rounds r) {
        if (t == null || t.getStatus() == TournamentStatus.FINISHED) {
            throw ApiCodes.conflict("TOURNAMENT_FINISHED");
        }
        if (r == null || r.getStatus() == RoundStatus.COMPLETED) {
            throw ApiCodes.conflict("ROUND_COMPLETED");
        }
    }

    /* ===================== Reads ===================== */

    /**
     * The caller's own links, newest first — the blok's view of its history.
     * Signed-in only, and unchanged by §7: an anonymous link has no uid to be
     * listed under, which is why {@link #getOne} exists.
     */
    public List<BlokLinkDto> listMine() {
        return toDtoList(linkRepo.findByRequestedByUid(currentUser.requireUid()));
    }

    /**
     * One link's current state, for a client that cannot use
     * {@link #listMine} — the signed-out blok of §7.1, polling to find out
     * whether the organiser has approved it yet.
     *
     * <p>Authorised exactly like the score write: the link's own
     * {@code requestedByUid}, or its {@code writeToken}. Anything else — a
     * guessed uuid, a wrong token, a stranger who is signed in — gets the same
     * 401, so the endpoint cannot be used to find out whether a uuid names a
     * real link.
     */
    public BlokLinkDto getOne(UUID linkUuid, String writeToken) {
        return toDto(authorise(linkUuid, writeToken, "read"));
    }

    /* ---- §8: the table you are already sitting at ---- */

    /**
     * Tables this signed-in player could be keeping the record of right now —
     * {@code BLOK-LINK.md} §8. Usually empty or one element.
     *
     * <p>All five conditions of §8.1 have to hold, and each is enforced in the
     * one place it can be:
     *
     * <ol>
     *   <li><b>signed in</b> — {@link CurrentUser#requireUid()};</li>
     *   <li><b>a pair of theirs</b> ({@code submittedByUid} or
     *       {@code coSubmittedByUid}, this codebase's only notion of "my pair",
     *       §5), <li><b>approved</b>, on a <b>{@code DRAFT}/{@code STARTED}</b>
     *       tournament, in a <b>non-completed round</b>, with <b>both pairs</b>
     *       present — all of that is
     *       {@link MatchesRepository#findLiveCandidateMatchesForUid};</li>
     *   <li><b>the ACTIVE round</b> — the highest-numbered non-completed round
     *       <em>of that tournament</em>, which the query above cannot know
     *       because it only sees the player's own rows. Resolved here, in one
     *       grouped query over every candidate tournament. This is the check
     *       that stops a stale offer: a player whose round 2 match is still
     *       open while round 3 has been drawn is no longer at that table;</li>
     *   <li><b>no active link on the match</b> — one batched query, so a table
     *       somebody has already claimed (including this same player, from
     *       another device) is not offered again.</li>
     * </ol>
     *
     * <p>Any failure means <b>no row</b>, never a flagged one: §8.1 ends "if
     * any of them fails, nothing is offered — a blok with no tournament stays
     * clean". That is the difference from {@link #listTargets}, which returns
     * unlinkable tables greyed out because the player is deliberately browsing
     * there.
     *
     * <p><b>It can only ever show the caller their own matches.</b> Every row
     * comes from a pair carrying their uid; there is no path from a tournament
     * id or a slug into this method, so it cannot be turned into a way to read
     * somebody else's draw.
     *
     * <p>Ordered by tournament name, then table number, then match id — a
     * player registered on two tournaments at once gets a stable list rather
     * than whatever order the join happened to produce.
     */
    public List<BlokLinkSuggestionDto> suggestions() {
        String uid = currentUser.requireUid();

        List<Matches> candidates = matchesRepo.findLiveCandidateMatchesForUid(uid);
        if (candidates.isEmpty()) return List.of();

        // §8.1(4): only the ACTIVE round of each tournament counts.
        Map<Long, Integer> activeNumbers = roundsRepo.findActiveRoundNumbers(
                candidates.stream().map(m -> m.getTournament().getId()).distinct().toList());

        List<Matches> inActiveRound = candidates.stream()
                .filter(m -> {
                    Integer active = activeNumbers.get(m.getTournament().getId());
                    return active != null && active == m.getRound().getNumber();
                })
                .toList();
        if (inActiveRound.isEmpty()) return List.of();

        // §8.1(5): a table someone already claimed is not on offer.
        Set<Long> linked = new HashSet<>(linkRepo.findActiveMatchIdsIn(
                inActiveRound.stream().map(Matches::getId).toList()));

        return inActiveRound.stream()
                .filter(m -> !linked.contains(m.getId()))
                .map(m -> suggestion(m, myPairOf(m, uid)))
                .filter(Objects::nonNull)
                .sorted(Comparator
                        .comparing((BlokLinkSuggestionDto s) ->
                                s.tournamentName() == null ? "" : s.tournamentName(),
                                String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(s -> s.tableNo() == null ? Integer.MAX_VALUE : s.tableNo())
                        .thenComparing(BlokLinkSuggestionDto::matchId))
                .toList();
    }

    /**
     * Which side of this match is the caller's. Re-derived rather than carried
     * out of the query, because the query's {@code or} does not say which
     * branch matched. {@code pair1} wins the (impossible in practice) case of
     * a player having submitted both pairs — an arbitrary but stable choice,
     * and the player can still pick the other side through the manual flow.
     */
    private static Pairs myPairOf(Matches m, String uid) {
        if (isMine(m.getPair1(), uid)) return m.getPair1();
        if (isMine(m.getPair2(), uid)) return m.getPair2();
        return null;
    }

    /** §8.1(2)+(3): an approved pair the player submitted or co-submitted. */
    private static boolean isMine(Pairs p, String uid) {
        if (p == null || p.isPendingApproval()) return false;
        return uid.equals(p.getSubmittedByUid()) || uid.equals(p.getCoSubmittedByUid());
    }

    private static BlokLinkSuggestionDto suggestion(Matches m, Pairs mine) {
        if (mine == null) return null;
        Pairs other = Objects.equals(m.getPair1().getId(), mine.getId())
                ? m.getPair2() : m.getPair1();
        if (other == null) return null;

        Tournaments t = m.getTournament();
        Rounds r = m.getRound();
        return new BlokLinkSuggestionDto(
                t.getUuid(), t.getSlug(), t.getName(),
                r.getId(), r.getNumber(),
                m.getId(), m.getTableNo(),
                mine.getId(), mine.getName(),
                other.getId(), other.getName());
    }

    /** Every link of one tournament, PENDING first. Organiser/admin only (gated at the controller). */
    public List<BlokLinkDto> listForTournament(Tournaments t) {
        return toDtoList(linkRepo.findByTournamentIdForOrganiser(t.getId()));
    }

    /* ===================== Decisions ===================== */

    /** Organiser approves: the requester may now write this match's score. */
    public BlokLinkDto approve(Tournaments t, UUID linkUuid) {
        MatchScoreLink link = requireLinkOfTournament(t, linkUuid);

        // Idempotent — a double-tap on "Odobri" must not 409.
        if (link.getStatus() == MatchScoreLinkStatus.APPROVED) return toDto(link);
        requirePending(link);

        // Approving into a finished round would hand out a write that the
        // score endpoint would refuse on its first use.
        assertLinkable(t, link.getMatch().getRound());

        decide(link, MatchScoreLinkStatus.APPROVED);
        notifyRequesterOfDecision(t, link, true);

        broadcast(t);
        return toDto(link);
    }

    /** Organiser declines. Terminal — the player has to ask again. */
    public BlokLinkDto reject(Tournaments t, UUID linkUuid) {
        MatchScoreLink link = requireLinkOfTournament(t, linkUuid);

        if (link.getStatus() == MatchScoreLinkStatus.REJECTED) return toDto(link);
        requirePending(link);

        decide(link, MatchScoreLinkStatus.REJECTED);
        notifyRequesterOfDecision(t, link, false);

        broadcast(t);
        return toDto(link);
    }

    /**
     * Break the link: the requester ("wrong table") or the organiser.
     *
     * <p>The requester proves themselves the same two ways they do on the
     * score endpoint (§7.1) — their uid, or the link's {@code writeToken}.
     * Without the token half, a signed-out player could create a link and then
     * never be able to break it, and since a link occupies its match's single
     * active slot ({@code uq_msl_active_per_match}) that would leave the table
     * stuck until the organiser cleared it by hand.
     *
     * <p>The organiser branch is untouched and is still a
     * {@link TournamentAccess#canManage} check on a signed-in caller; a write
     * token never grants it.
     *
     * <p>Idempotent and silent — an already-terminal link is simply left as it
     * is, so a blok retrying a revoke after losing connectivity does not get an
     * error it would have to explain to the player.
     */
    public void revoke(UUID linkUuid, String writeToken) {
        MatchScoreLink link = linkRepo.findByUuid(linkUuid)
                .orElseThrow(() -> new NotFoundException(messages.t("blokLink.notFound")));

        if (!isRequester(link, writeToken) && !access.canManage(link.getTournament())) {
            // 403 rather than 401 stays as it was: reaching this line means the
            // caller could name a real link, and the old behaviour for a
            // signed-in stranger should not change under §7.
            throw new ForbiddenException(messages.t("blokLink.forbidden"));
        }

        if (!link.isActive()) return;

        decide(link, MatchScoreLinkStatus.REVOKED);
        broadcast(link.getTournament());
    }

    /** Signed-in-only overload, kept for callers that never carry a token. */
    public void revoke(UUID linkUuid) {
        revoke(linkUuid, null);
    }

    /* ===================== Who may write — §7.1 ===================== */

    /**
     * True when the caller is this link's requester, proven either way §7.1
     * allows.
     *
     * <p>The uid branch runs first and is <b>unchanged</b>: a signed-in
     * requester is recognised by their uid, never by the presence of a token,
     * so nothing about the pre-§7 path got looser. The token branch is the
     * addition, and it can only ever match the one link it was minted for.
     *
     * <p>A link with no stored token (every link made before §7) can only be
     * used through its uid — {@code null} never matches, and neither does a
     * blank presented value.
     */
    private boolean isRequester(MatchScoreLink link, String presentedToken) {
        String uid = currentUser.uidOrNull();
        if (uid != null && uid.equals(link.getRequestedByUid())) return true;
        return tokenMatches(link.getWriteToken(), presentedToken);
    }

    /**
     * Constant-time comparison of a stored write token against a presented
     * one. {@link MessageDigest#isEqual} rather than {@code String.equals} for
     * the usual reason a bearer credential is compared that way — the cost is
     * nothing and the alternative leaks a prefix through timing.
     */
    private static boolean tokenMatches(String stored, String presented) {
        if (stored == null || stored.isBlank() || presented == null) return false;
        String p = presented.trim();
        if (p.isEmpty()) return false;
        return MessageDigest.isEqual(
                stored.getBytes(StandardCharsets.UTF_8),
                p.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Load the link named by {@code linkUuid} and insist the caller is its
     * requester — the gate {@link #getOne} and {@link #submitScore} share.
     *
     * <p><b>Every failure is the same 401</b>, whether the uuid is unknown,
     * the token is wrong, or a perfectly valid signed-in stranger asked. That
     * is §7.1's "wrong or absent token without a sign-in = 401", and it also
     * keeps the endpoint from confirming that a guessed uuid names a real
     * link — the same reasoning that made the old code answer a wrong caller
     * with 409 rather than 403.
     *
     * <p>It does <b>not</b> check the status: an approved-only rule belongs to
     * the score write, while {@link #getOne} exists precisely so a blok can
     * see that its link is still {@code PENDING}.
     *
     * <p>Rejections are logged in the same {@code AUTHZ} shape
     * {@code SecurityAuditMappers} and {@code WaiterAccessService} use, so a
     * run of guesses leaves a trail. Nothing identifying is logged: a uuid the
     * caller already supplied, and whether they were signed in.
     */
    private MatchScoreLink authorise(UUID linkUuid, String writeToken, String what) {
        MatchScoreLink link = linkRepo.findByUuid(linkUuid).orElse(null);
        if (link == null || !isRequester(link, writeToken)) {
            LOG.warnf("AUTHZ 401 BLOK_LINK %s link=%s reason=%s signedIn=%s",
                    what, linkUuid,
                    link == null ? "unknown link" : "not the requester",
                    currentUser.uidOrNull() != null);
            throw unauthorized();
        }
        return link;
    }

    /**
     * The 401 envelope {@link CurrentUser#requireUid()} produces, built the
     * same way and for the same reason: the single-String
     * {@code NotAuthorizedException} constructor treats its argument as a
     * {@code WWW-Authenticate} challenge and leaves the body empty, which the
     * SPA cannot render.
     */
    private NotAuthorizedException unauthorized() {
        return new NotAuthorizedException(
                Response.status(Response.Status.UNAUTHORIZED)
                        .type(MediaType.APPLICATION_JSON)
                        .entity(ApiError.of("UNAUTHORIZED", messages.t("error.unauthorized")))
                        .build());
    }

    private void requirePending(MatchScoreLink link) {
        if (link.getStatus() != MatchScoreLinkStatus.PENDING) {
            // Not a bare code: the SPA has nothing to branch on here, it just
            // shows the message. IllegalStateException maps to 409 + ApiError.
            throw new IllegalStateException(messages.t("blokLink.notPending"));
        }
    }

    /** Stamp the terminal/decided state. {@code decidedByUid} is whoever is calling. */
    private void decide(MatchScoreLink link, MatchScoreLinkStatus status) {
        link.setStatus(status);
        link.setDecidedAt(OffsetDateTime.now());
        link.setDecidedByUid(currentUser.uidOrNull());
        linkRepo.save(link);
    }

    /* ============ Score — BLOK-LINK.md §2.3, as revised by §6.1 / §6.2 ============ */

    /**
     * Write the blok's score into the match. The one non-organiser write path
     * in this application, so read §2.3 of the contract before touching it.
     *
     * <h2>What the two numbers are (§6.1)</h2>
     * {@code us} and {@code them} are <b>games won in the series at that
     * table</b> — the {@code 2 : 0} or {@code 2 : 1} a tournament match is
     * scored in. They are not point totals: {@code 543 : 149} is the
     * scorepad's own arithmetic and never reaches {@code Matches}. Nothing in
     * the mechanics below changed with that revision — it is the same column,
     * the same mapping and the same two branches — but it does change when the
     * blok calls: a provisional push happens when the <em>series result</em>
     * moves (at the end of a game), not on every deal.
     *
     * <ol>
     *   <li><b>Who (§7.1).</b> Two questions, answered separately. First,
     *       <em>is this the link's own device?</em> — its
     *       {@code requestedByUid} while signed in, or its {@code writeToken}
     *       otherwise; anything else, an unknown uuid included, is
     *       <b>401</b>, so a guessed uuid cannot be told from someone else's.
     *       Only then, <em>has the organiser approved it?</em> — if not,
     *       {@code 409 LINK_NOT_APPROVED}, the literal the SPA branches on.
     *       Splitting them is what §7 asks for and it also stops leaking:
     *       before, one code covered both, so a stranger who tried a uuid
     *       learned the same thing whether or not it existed. It still does —
     *       they now get 401 either way.</li>
     *   <li><b>When.</b> Round and tournament state are re-read on every call,
     *       because a series sends many scores and the round can complete
     *       between two of them. If it has, the link is <em>put out</em>
     *       ({@code REVOKED}) and the call answers 409 — the blok then stops
     *       trying instead of retrying forever.</li>
     *   <li><b>Which side.</b> {@code us}/{@code them} are mapped onto
     *       {@code score1}/{@code score2} through the link's stored
     *       {@code usPair}.</li>
     *   <li><b>{@code final: false} writes the two numbers and nothing else.</b>
     *       The match stays {@code SCHEDULED}, {@code winnerPair} stays null, no
     *       pair's statistics move, nobody is eliminated, nobody is notified.
     *       This is the point of the whole endpoint, and §6.1 does not soften
     *       it: the existing {@link RoundService#updateMatchScore} declares a
     *       match FINISHED the moment two different numbers land, and a series
     *       standing at 1 : 0 is not over. Routed through there, a pair would
     *       be knocked out after the first game and the round could close
     *       itself.</li>
     *   <li><b>{@code final: true} goes through {@link RoundService#updateMatchScore}</b>
     *       with everything that entails — winner, statistics, elimination, the
     *       loser's bill push, round auto-completion and its own broadcast.
     *       That logic is not duplicated here; it is called.</li>
     * </ol>
     *
     * <h2>Writing a score publishes the scorepad (§6.2)</h2>
     * Linking the blok to a table is the player's consent to publish that
     * record, so once the score is accepted the series' share token is ensured
     * through {@link BlokHistoryService#shareSeries} — issue-or-return, so a
     * token the player already handed out is reused and never replaced. Three
     * boundaries hold it in:
     *
     * <ul>
     *   <li>It runs only <b>after</b> the who/when gates above, so a caller
     *       who is not the requester of an approved live link mints nothing.
     *   </li>
     *   <li>The series is resolved as {@code (link.requestedByUid,
     *       link.sessionId)} — never the calling uid on its own, never a
     *       session id on its own — so a link can only publish its own
     *       player's scorepad.</li>
     *   <li>If that series has not been uploaded yet, <b>nothing happens and
     *       the score still goes in</b>. §6.2 is explicit: no session row, no
     *       token, carry on. The blok uploads as it plays, and the token
     *       appears on a later push.</li>
     * </ul>
     *
     * <p>Returns the link, not the match: the blok's local state is a
     * {@code BlokLink}, and getting the row back lets it notice a status change
     * — or a freshly minted {@code shareToken} — it had not heard about yet.
     */
    public BlokLinkDto submitScore(UUID linkUuid, BlokLinkScoreRequest body, String writeToken) {
        // §7.1: the requester, by uid or by write token, and a 401 for
        // anything else — including an unknown uuid, so a guess cannot be
        // told apart from somebody else's link.
        MatchScoreLink link = authorise(linkUuid, writeToken, "score");

        // Authorised, but the organiser has not (or no longer) said yes. This
        // one stays 409 LINK_NOT_APPROVED: the caller has proven the link is
        // theirs, so there is nothing left to hide, and the SPA branches on
        // this literal to put the blok's banner into "waiting"/"revoked".
        if (link.getStatus() != MatchScoreLinkStatus.APPROVED) {
            throw ApiCodes.conflict("LINK_NOT_APPROVED");
        }

        Matches m = link.getMatch();
        Rounds r = m.getRound();
        Tournaments t = link.getTournament();

        // Re-checked per call, and fatal to the link: see §2.3(2). The revoke
        // has to survive the 409, which is why the resource method carries
        // dontRollbackOn — see BlokLinkController.
        if (t.getStatus() == TournamentStatus.FINISHED) {
            autoRevoke(link);
            throw ApiCodes.conflict("TOURNAMENT_FINISHED");
        }
        if (r.getStatus() == RoundStatus.COMPLETED) {
            autoRevoke(link);
            throw ApiCodes.conflict("ROUND_COMPLETED");
        }

        // §6.2: a link made before the client knew how to send a series id can
        // still adopt one, here, on the first push that carries it. Only ever
        // fills a gap — like usPairId, the mapping is chosen once, so a link
        // that already names a series keeps that one and a player who linked
        // the wrong series revokes and asks again. Setting it does not publish
        // anything by itself; the mint below does, and only for an approved
        // link whose gates have just passed.
        if (link.getSessionId() == null || link.getSessionId().isBlank()) {
            String adopted = normaliseSessionId(body.sessionId());
            if (adopted != null) {
                link.setSessionId(adopted);
                linkRepo.save(link);
            }
        }

        // Consent, cashed in: the series behind this link becomes readable at
        // /blok/z/{token}. Issue-or-return, so a link that pushes a score
        // fifty times mints exactly one token — and never replaces one the
        // player minted themselves. Null when the series has not been uploaded
        // yet, which is not an error: the score below still goes in.
        history.shareSeries(link.getRequestedByUid(), link.getSessionId());

        boolean usIsPair1 = m.getPair1() != null
                && Objects.equals(m.getPair1().getId(), link.getUsPair().getId());
        // §6.1: these are GAMES WON by each side of the series, not points.
        Integer score1 = usIsPair1 ? body.us() : body.them();
        Integer score2 = usIsPair1 ? body.them() : body.us();

        if (body.isFinal()) {
            // Delegate wholesale. It is @Transactional(REQUIRED), so it joins
            // this request's transaction and mutates the same managed rows —
            // and it broadcasts SCOPE_MATCH itself, which is why there is no
            // second broadcast on this branch.
            roundService.updateMatchScore(t.getUuid().toString(), r.getId(), m.getId(),
                    new UpdateMatchRequest(score1, score2));
        } else if (m.getStatus() == MatchStatus.FINISHED) {
            // Defensive, and a small extension of the contract: the match has
            // already been settled (by the organiser, or by this blok's own
            // final push) and carries a winner. Overwriting the numbers while
            // leaving status and winnerPair alone — which is all a provisional
            // write is allowed to do — could leave the row saying "pair1 won"
            // above a score pair2 leads. So a provisional series result that
            // arrives after the match is settled is simply dropped. The blok
            // is answered 200 and stops
            // resending; only a `final: true` write can still correct a settled
            // match, and that goes through the path which fixes up everything.
            return toDto(link);
        } else {
            // §2.3(4): the two numbers, and strictly nothing else.
            m.setScore1(score1);
            m.setScore2(score2);
            matchesRepo.save(m);
            broadcast(t);
        }

        return toDto(link);
    }

    /**
     * Signed-in-only overload — the same write, with no token presented.
     * Kept because most callers (and every test that drives the service
     * directly) have a uid and nothing else.
     */
    public BlokLinkDto submitScore(UUID linkUuid, BlokLinkScoreRequest body) {
        return submitScore(linkUuid, body, null);
    }

    /**
     * Put out a link whose round or tournament has moved on. Distinct from
     * {@link #revoke(UUID, String)} in that it is the server's decision, not a user's —
     * but it is stamped with the caller's uid all the same, since that caller
     * is the requester.
     */
    private void autoRevoke(MatchScoreLink link) {
        link.setStatus(MatchScoreLinkStatus.REVOKED);
        link.setDecidedAt(OffsetDateTime.now());
        link.setDecidedByUid(currentUser.uidOrNull());
        linkRepo.save(link);
        broadcast(link.getTournament());
    }

    /* ===================== Notifications — §2.4 ===================== */

    /**
     * Tell the organiser someone is waiting. Composed in the ORGANISER's
     * stored language, not the requester's {@code X-Locale} — see
     * {@link PushService#sendToUser(String, java.util.function.Function)}.
     */
    private void notifyOrganiserOfRequest(Tournaments t, Matches m, MatchScoreLink link) {
        String organiserUid = t.getCreatedByUid();
        if (organiserUid == null || organiserUid.isBlank()) return;
        // Don't buzz the organiser about their own request.
        if (organiserUid.equals(link.getRequestedByUid())) return;

        // Deep-links into Ždrijeb with the row scrolled into view, the same
        // ?match= link RoundNotifier uses.
        String url = "/turniri/" + tournamentRef(t) + "?match=" + m.getId();
        String rawName = link.getRequestedByName();
        String table = tableLabel(m);
        String tournamentName = t.getName();

        pushService.sendToUser(organiserUid, locale -> {
            // Even the "some player" fallback is the RECIPIENT's word, so it
            // is resolved inside the factory rather than up here.
            String who = (rawName == null || rawName.isBlank())
                    ? messages.t(locale, "blokLink.anonymousPlayer")
                    : rawName;
            return new PushService.PushPayload(
                    messages.t(locale, "push.blokLinkRequest.title"),
                    messages.t(locale, "push.blokLinkRequest.body", who, table, tournamentName),
                    url);
        });
    }

    /** Tell the requester what the organiser decided, in the REQUESTER's language. */
    private void notifyRequesterOfDecision(Tournaments t, MatchScoreLink link, boolean approved) {
        String uid = link.getRequestedByUid();
        if (uid == null || uid.isBlank()) return;

        String url = "/turniri/" + tournamentRef(t) + "?match=" + link.getMatch().getId();
        String table = tableLabel(link.getMatch());
        String tournamentName = t.getName();
        String titleKey = approved ? "push.blokLinkApproved.title" : "push.blokLinkRejected.title";
        String bodyKey = approved ? "push.blokLinkApproved.body" : "push.blokLinkRejected.body";

        pushService.sendToUser(uid, locale -> new PushService.PushPayload(
                messages.t(locale, titleKey),
                messages.t(locale, bodyKey, table, tournamentName),
                url));
    }

    /**
     * "Stol 4", or the round number when the match was drawn without a table.
     * Resolved in the RECIPIENT's language, so it is built per-locale inside
     * the payload factory — hence the raw number here and the label key there.
     */
    private String tableLabel(Matches m) {
        return m.getTableNo() != null ? String.valueOf(m.getTableNo()) : "?";
    }

    /* ===================== Shared helpers ===================== */

    /**
     * Load a link and insist it belongs to {@code t}.
     *
     * <p>A uuid from another tournament answers 404, not 403 — the caller is
     * already authorised on {@code t}, so all that is wrong with
     * {@code /tournaments/{t}/blok-links/{uuid}} is that it names something
     * that does not exist. Same reasoning as
     * {@code TournamentPairService.requirePairOfTournament}.
     */
    private MatchScoreLink requireLinkOfTournament(Tournaments t, UUID linkUuid) {
        MatchScoreLink link = linkRepo.findByUuid(linkUuid)
                .orElseThrow(() -> new NotFoundException(messages.t("blokLink.notFound")));
        if (link.getTournament() == null
                || !Objects.equals(link.getTournament().getId(), t.getId())) {
            throw new NotFoundException(messages.t("blokLink.notFound"));
        }
        return link;
    }

    /** Slug when there is one, UUID otherwise — the SPA route accepts either. */
    private static String tournamentRef(Tournaments t) {
        if (t.getSlug() != null && !t.getSlug().isBlank()) return t.getSlug();
        return t.getUuid() != null ? t.getUuid().toString() : "";
    }

    private static String trimTo(String s, int max) {
        if (s == null) return null;
        String trimmed = s.trim();
        if (trimmed.isEmpty()) return null;
        return trimmed.length() <= max ? trimmed : trimmed.substring(0, max);
    }
}
