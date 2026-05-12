package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.dtos.MyTournamentParticipationDto;
import hr.mrodek.apps.bela_turniri.dtos.PairMatchHistoryDto;
import hr.mrodek.apps.bela_turniri.dtos.PublicProfileDto;
import hr.mrodek.apps.bela_turniri.model.Matches;
import hr.mrodek.apps.bela_turniri.model.Pairs;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.model.UserPairPreset;
import hr.mrodek.apps.bela_turniri.repository.MatchesRepository;
import hr.mrodek.apps.bela_turniri.repository.PairsRepository;
import hr.mrodek.apps.bela_turniri.repository.UserPairPresetRepository;
import hr.mrodek.apps.bela_turniri.repository.UserProfileRepository;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.jwt.JsonWebToken;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Anonymous-readable profile pages. Anyone can hit these — there is no
 * {@code @Authenticated} on the class — because the product decision is
 * that profile *pages* are publicly visible (so people can share a link to
 * their tournament history).
 *
 * <p>Phone numbers, however, are redacted for unauthenticated callers so the
 * endpoint can't be used as an anonymous PII scraper. Logged-in users see
 * the full profile.
 *
 * Routes:
 *   GET /public/users/{slug}                              — profile + pairs + tournaments
 *   GET /public/users/{slug}/pairs/{pairId}/matches       — match-by-match history for one pair
 */
@Path("/public/users")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class PublicProfileController {

    @Inject UserProfileRepository profileRepo;
    @Inject UserPairPresetRepository presetRepo;
    @Inject PairsRepository pairRepo;
    @Inject MatchesRepository matchRepo;
    @Inject SecurityIdentity identity;
    @Inject JsonWebToken jwt;

    /**
     * True when no Firebase ID token was presented (or it didn't verify).
     * Quarkus OIDC runs in lazy mode (proactive=false), so anonymous
     * traffic still gets a SecurityIdentity — just one marked anonymous.
     */
    private boolean isAnonymous() {
        return identity == null || identity.isAnonymous();
    }

    @GET
    @Path("/{slug}")
    public PublicProfileDto getBySlug(@PathParam("slug") String slug) {
        var profile = profileRepo.findBySlug(slug)
                .orElseThrow(() -> new NotFoundException("Profil nije pronađen: " + slug));

        String uid = profile.getUserUid();

        // Owner viewing own profile sees everything; visitors see only
        // pairs whose name isn't on a hidden preset. We need the full
        // preset list either way — for the broadened participation query
        // AND to compute the hidden-name set.
        var allPresets = presetRepo.findByUserUid(uid);
        var presetNames = allPresets.stream()
                .map(UserPairPreset::getName)
                .toList();

        // Determine viewer identity. Owner-of-this-profile sees everything;
        // anonymous + everyone else gets hidden-pair-name filtering.
        String viewerUid = (jwt != null) ? jwt.getSubject() : null;
        boolean viewerIsOwner = viewerUid != null && viewerUid.equals(uid);

        Set<String> hiddenLowered = new HashSet<>();
        if (!viewerIsOwner) {
            for (var pp : allPresets) {
                if (pp.isHidden() && pp.getName() != null) {
                    hiddenLowered.add(pp.getName().trim().toLowerCase(Locale.ROOT));
                }
            }
        }

        // Reuse the same broadened "my participations" query so an organizer
        // who manually added their pair shows up too.
        var participations = pairRepo.findMyParticipations(uid, presetNames);

        var participationDtos = participations.stream()
                .map(PublicProfileController::toParticipationDto)
                .filter(p -> {
                    // Filter out hidden-name participations for non-owner viewers.
                    if (viewerIsOwner) return true;
                    if (p.pairName() == null) return true;
                    String key = p.pairName().trim().toLowerCase(Locale.ROOT);
                    return !hiddenLowered.contains(key);
                })
                .toList();

        // Build pair summary by collapsing on lower-cased trimmed name and
        // counting tournaments + wins per group.
        Map<String, int[]> agg = new LinkedHashMap<>(); // key = lowercased name → [count, wins], value preserves first-seen pretty name via name map
        Map<String, String> prettyName = new LinkedHashMap<>();
        for (var p : participationDtos) {
            String key = p.pairName() == null ? "" : p.pairName().trim().toLowerCase(Locale.ROOT);
            if (key.isEmpty()) continue;
            prettyName.putIfAbsent(key, p.pairName().trim());
            int[] cur = agg.computeIfAbsent(key, k -> new int[]{0, 0});
            cur[0] += 1;
            if (p.isWinner()) cur[1] += 1;
        }

        var pairs = new ArrayList<PublicProfileDto.PairSummary>(agg.size());
        for (var e : agg.entrySet()) {
            pairs.add(new PublicProfileDto.PairSummary(
                    prettyName.get(e.getKey()),
                    e.getValue()[0],
                    e.getValue()[1]
            ));
        }
        // Most-played pair first so the UI default selection is the strongest signal.
        pairs.sort((a, b) -> Integer.compare(b.tournamentCount(), a.tournamentCount()));

        // Phone is hidden from anonymous callers so this endpoint can't be
        // used as a one-click PII scraper. Logged-in users get the real
        // value; anonymous callers see nulls AND a hasPhone=true flag so the
        // SPA can render a blurred placeholder that links to /login.
        boolean anon = isAnonymous();
        boolean hasPhone = profile.getPhone() != null && !profile.getPhone().isBlank();
        String phoneCountry = anon ? null : profile.getPhoneCountry();
        String phone = anon ? null : profile.getPhone();

        // Avatar — proxied URL pattern, same as posters. Public per product
        // decision (the page itself is anonymous-readable). Touching the
        // lazy association requires an active transaction; the surrounding
        // request scope provides one.
        String avatarUrl = null;
        if (profile.getAvatar() != null && profile.getAvatar().getId() != null) {
            avatarUrl = "/api/resources/" + profile.getAvatar().getId() + "/image";
        }

        return new PublicProfileDto(
                profile.getSlug(),
                profile.getDisplayName(),
                phoneCountry,
                phone,
                hasPhone,
                avatarUrl,
                pairs,
                participationDtos
        );
    }

    @GET
    @Path("/{slug}/pairs/{pairId}/matches")
    public PairMatchHistoryDto getPairMatches(
            @PathParam("slug") String slug,
            @PathParam("pairId") Long pairId
    ) {
        var profile = profileRepo.findBySlug(slug)
                .orElseThrow(() -> new NotFoundException("Profil nije pronađen: " + slug));

        var pair = pairRepo.findByIdOptional(pairId)
                .orElseThrow(() -> new NotFoundException("Par nije pronađen: " + pairId));

        // Make sure this pair actually belongs to that profile — either by uid
        // or by preset-name fallback. Prevents anyone from drilling into other
        // people's pairs by guessing pairId via someone else's slug.
        boolean ownsByUid = pair.getSubmittedByUid() != null
                && pair.getSubmittedByUid().equals(profile.getUserUid());
        boolean ownsByPreset = false;
        if (!ownsByUid && pair.getSubmittedByUid() == null) {
            String pairName = pair.getName() == null ? "" : pair.getName().trim().toLowerCase(Locale.ROOT);
            ownsByPreset = presetRepo.findByUserUid(profile.getUserUid()).stream()
                    .map(UserPairPreset::getName)
                    .anyMatch(n -> n != null && n.trim().toLowerCase(Locale.ROOT).equals(pairName));
        }
        if (!ownsByUid && !ownsByPreset) {
            // Treat as missing — same shape as a wrong slug so we don't leak
            // existence-by-id.
            throw new NotFoundException("Par nije pronađen za ovaj profil.");
        }

        Tournaments t = pair.getTournament();
        var rows = new ArrayList<PairMatchHistoryDto.Row>();
        for (Matches m : matchRepo.findByPairId(pair.getId())) {
            boolean isPair1 = m.getPair1() != null && m.getPair1().getId().equals(pair.getId());
            Pairs opponent = isPair1 ? m.getPair2() : m.getPair1();
            Integer ourScore  = isPair1 ? m.getScore1() : m.getScore2();
            Integer oppScore  = isPair1 ? m.getScore2() : m.getScore1();
            Boolean won = null;
            if (m.getWinnerPair() != null) {
                won = m.getWinnerPair().getId().equals(pair.getId());
            }
            boolean isBye = opponent == null;

            rows.add(new PairMatchHistoryDto.Row(
                    m.getRound() == null ? null : m.getRound().getNumber(),
                    m.getTableNo(),
                    opponent == null ? null : opponent.getName(),
                    ourScore,
                    oppScore,
                    m.getStatus() == null ? null : m.getStatus().name(),
                    won,
                    isBye
            ));
        }

        return new PairMatchHistoryDto(
                pair.getId(),
                pair.getName(),
                t == null ? null : t.getName(),
                rows
        );
    }

    private static MyTournamentParticipationDto toParticipationDto(Pairs p) {
        Tournaments t = p.getTournament();
        boolean isWinner =
                t.getWinnerName() != null
                        && p.getName() != null
                        && t.getWinnerName().trim().equalsIgnoreCase(p.getName().trim());
        return new MyTournamentParticipationDto(
                t.getUuid(),
                t.getSlug(),
                t.getName(),
                t.getLocation(),
                t.getStartAt(),
                t.getStatus() == null ? null : t.getStatus().name(),
                t.getWinnerName(),
                p.getId(),
                p.getName(),
                p.isPendingApproval(),
                p.isEliminated(),
                p.isExtraLife(),
                p.getWins(),
                p.getLosses(),
                isWinner
        );
    }
}
