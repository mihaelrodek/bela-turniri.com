package hr.mrodek.apps.bela_turniri.services;

import hr.mrodek.apps.bela_turniri.dtos.PairDto;
import hr.mrodek.apps.bela_turniri.dtos.SelfRegisterPairRequest;
import hr.mrodek.apps.bela_turniri.enums.TournamentStatus;
import hr.mrodek.apps.bela_turniri.errors.ApiCodes;
import hr.mrodek.apps.bela_turniri.model.Pairs;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.model.UserPairPreset;
import hr.mrodek.apps.bela_turniri.repository.PairsRepository;
import hr.mrodek.apps.bela_turniri.repository.UserPairPresetRepository;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.time.Duration;

/**
 * "Prijavi para za turnir" — a player registering their own pair against a
 * tournament that hasn't started yet, signed in OR not.
 *
 * <p>The pair lands with {@code pendingApproval = true}, so the organiser
 * confirms or rejects it before it counts towards anything. Capacity is
 * deliberately NOT enforced here: the organiser reviews the pending list and
 * approves as many as their tournament actually fits.
 *
 * <p>Two callers, one flow:
 *
 * <ul>
 *   <li><b>Signed in</b> — {@code submittedByUid = caller}, profile ensured,
 *       the name remembered as a preset, duplicates rejected per (uid, name).
 *       Unchanged.</li>
 *   <li><b>Anonymous</b> — {@code submittedByUid = null} and a REQUIRED
 *       contact phone, because that number is then the only way the organiser
 *       can reach the pair: no profile, no email, no push. Duplicates are
 *       rejected per (tournament, name, phone) instead, since there is no uid
 *       to key on. The reply carries an absolute {@code /preuzmi-par/{token}}
 *       URL so the submitter can attach the pair to an account later.</li>
 * </ul>
 *
 * <p>See {@link TournamentPairService} for why this service is not
 * {@code @Transactional} — it runs inside the caller's transaction.
 */
@ApplicationScoped
public class SelfRegistrationService {

    /**
     * Anonymous registrations per (tournament, client IP) inside the window.
     *
     * <p>This is NOT the safety net — the organiser's approval step is: every
     * self-registered pair sits pending until a human confirms it, so a flood
     * can never reach the roster. This only stops a script from filling that
     * pending list faster than the organiser can clear it. Deliberately
     * in-memory and per-node: a throttle whose failure mode is "a determined
     * attacker gets a few more rows a human then deletes" does not deserve a
     * table. {@code static} so it survives however the bean is scoped;
     * {@code maximumSize} bounds it so spoofed IPs cannot turn the guard into
     * the leak it exists to prevent.
     */
    private static final Duration ANON_WINDOW = Duration.ofHours(1);
    private static final int ANON_MAX_PER_WINDOW = 5;
    private static final Cache<String, Integer> ANON_SUBMITS = Caffeine.newBuilder()
            .expireAfterWrite(ANON_WINDOW)
            .maximumSize(10_000)
            .build();

    @Inject PairsRepository pairRepo;
    @Inject UserPairPresetRepository userPairPresetRepo;
    @Inject SlugService slugService;
    @Inject TournamentPairService pairService;
    @Inject CurrentUser currentUser;

    @ConfigProperty(name = "app.public-base-url", defaultValue = "https://bela-turniri.com")
    String publicBaseUrl;

    @Inject hr.mrodek.apps.bela_turniri.realtime.LiveBroadcaster live;

    /**
     * Ping every open tournament page that something changed. The send is
     * deferred until the caller's transaction commits (see LiveBroadcaster).
     */
    private void broadcast(Tournaments t, String scope) {
        if (t == null || t.getUuid() == null) return;
        live.notifyTournament(t.getUuid().toString(), scope);
    }

    /** Backwards-compatible entry point for callers with no client IP to give. */
    public PairDto selfRegister(Tournaments t, SelfRegisterPairRequest body) {
        return selfRegister(t, body, null);
    }

    /**
     * @param clientIp first hop of {@code X-Forwarded-For}, or the socket
     *                 address — only used to throttle ANONYMOUS registrations
     */
    public PairDto selfRegister(Tournaments t, SelfRegisterPairRequest body, String clientIp) {
        if (t.getStatus() == TournamentStatus.STARTED || t.getStatus() == TournamentStatus.FINISHED) {
            throw ApiCodes.conflict("TOURNAMENT_ALREADY_STARTED");
        }

        // Nullable on purpose: this endpoint carries no @Authenticated, so an
        // anonymous caller is a supported case, not an error.
        String myUid = currentUser.uidOrNull();
        boolean anonymous = myUid == null;
        String trimmedName = body.name().trim();
        String phone = normalizePhone(body.contactPhone());

        if (anonymous) {
            if (phone == null) {
                // Without it the organiser is left with a row they cannot
                // confirm and cannot chase — a name alone is spam bait.
                throw ApiCodes.badRequest("CONTACT_PHONE_REQUIRED");
            }
            if (throttledAnonymous(t, clientIp)) {
                throw ApiCodes.conflict("RATE_LIMITED");
            }
        }

        // Duplicate check. Signed in there is a uid to key on; anonymously
        // there is not, so the (name, phone) pair stands in for an identity —
        // the same person tapping submit twice is caught, two different pairs
        // from one household phone are not.
        boolean alreadyRegistered = pairRepo.findByTournament_Id(t.getId()).stream()
                .anyMatch(existing -> {
                    if (existing.getName() == null || !existing.getName().equalsIgnoreCase(trimmedName)) {
                        return false;
                    }
                    return anonymous
                            ? existing.getSubmittedByUid() == null
                                    && phone.equals(normalizePhone(existing.getContactPhone()))
                            : myUid.equals(existing.getSubmittedByUid());
                });
        if (alreadyRegistered) {
            throw ApiCodes.conflict("ALREADY_REGISTERED");
        }

        // Make sure the user has a UserProfile row + slug *before* the pair
        // is persisted. Without it, pair-list enrichment renders the row
        // without "Prijavio: …" whenever the frontend's /user/me/sync hasn't
        // landed yet (a race between sign-in and the first self-register).
        // Skipped anonymously: there is no uid to key a profile to.
        if (!anonymous) {
            slugService.ensureProfile(myUid, currentUser.displayName());
        }

        Pairs p = new Pairs();
        p.setTournament(t);
        p.setName(trimmedName);
        p.setEliminated(false);
        p.setExtraLife(false);
        p.setWins(0);
        p.setLosses(0);
        p.setPaid(false);
        p.setSubmittedByUid(myUid);
        p.setContactPhone(phone);
        p.setPendingApproval(true);
        // Pair-level claim token — legacy for the signed-in path (sharing now
        // happens at the preset level), but load-bearing for the anonymous one:
        // it is the ONLY handle the submitter keeps on a row that belongs to no
        // account, and PairClaimController turns it into ownership.
        p.setClaimToken(ClaimTokens.generate());

        // Auto-inherit the co-owner from the user's matching preset. Once
        // "Marko & Pero" has been shared and the partner has claimed it,
        // every new pair self-registered under that name must also surface
        // on the partner's profile and notifications. The preset is the
        // source of truth for who the partner is.
        // Presets are per-account, so both the co-owner inheritance and the
        // address-book write are signed-in-only.
        if (!anonymous) {
            userPairPresetRepo.findByUserUidAndNameIgnoreCase(myUid, trimmedName)
                    .ifPresent(preset -> {
                        if (preset.getCoOwnerUid() != null && !preset.getCoOwnerUid().isBlank()) {
                            p.setCoSubmittedByUid(preset.getCoOwnerUid());
                        }
                    });
        }

        pairRepo.save(p);

        if (!anonymous) {
            rememberPairName(myUid, trimmedName);
        }

        broadcast(t, hr.mrodek.apps.bela_turniri.realtime.LiveBroadcaster.SCOPE_PAIRS);

        PairDto dto = pairService.toDto(p);
        // The anonymous submitter gets the claim link in the reply and nowhere
        // else — they have no profile page to find it on later.
        return anonymous ? dto.withClaimUrl(claimUrl(p.getClaimToken())) : dto;
    }

    /** Absolute {@code /preuzmi-par/{token}} link, the route ClaimPairPage serves. */
    private String claimUrl(String token) {
        return publicBaseUrl.replaceAll("/+$", "") + "/preuzmi-par/" + token;
    }

    /**
     * Digits plus an optional leading {@code +} — the same shape
     * {@code frontend/src/utils/phone.ts} produces once its country select and
     * local part are joined ("+385 91 234 5678" → "+385912345678"). Normalising
     * on the way in is what makes the duplicate check meaningful: "091 234 5678"
     * and "0912345678" are one number, and a raw string compare would say
     * otherwise. Returns null for blank/garbage input.
     */
    static String normalizePhone(String raw) {
        if (raw == null) return null;
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) return null;
        boolean plus = trimmed.startsWith("+");
        String digits = trimmed.replaceAll("\\D", "");
        if (digits.isEmpty()) return null;
        return plus ? "+" + digits : digits;
    }

    /**
     * True when this IP has already used its anonymous budget for this
     * tournament. Only counts allowed submissions, so a rejected caller does
     * not push their own reset further away forever.
     */
    private static boolean throttledAnonymous(Tournaments t, String clientIp) {
        String ip = (clientIp == null || clientIp.isBlank()) ? "unknown" : clientIp;
        String key = t.getId() + "|" + ip;
        Integer count = ANON_SUBMITS.getIfPresent(key);
        if (count != null && count >= ANON_MAX_PER_WINDOW) return true;
        // Re-put rather than mutate: the write is what re-arms Caffeine's
        // expireAfterWrite clock, which is what makes the window slide.
        ANON_SUBMITS.put(key, count == null ? 1 : count + 1);
        return false;
    }

    /**
     * Auto-save the typed name into the user's pair-name address book so
     * they don't retype it next time. Skipped when the same name
     * (case-insensitive) is already saved.
     */
    private void rememberPairName(String myUid, String trimmedName) {
        if (userPairPresetRepo.findByUserUidAndNameIgnoreCase(myUid, trimmedName).isPresent()) {
            return;
        }
        var preset = new UserPairPreset();
        preset.setUserUid(myUid);
        preset.setName(trimmedName);
        userPairPresetRepo.save(preset);
    }
}
