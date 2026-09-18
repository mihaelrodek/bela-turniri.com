package hr.mrodek.apps.bela_turniri.services;

import com.google.firebase.FirebaseApp;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import hr.mrodek.apps.bela_turniri.model.Pairs;
import hr.mrodek.apps.bela_turniri.model.Resources;
import hr.mrodek.apps.bela_turniri.model.UserProfile;
import hr.mrodek.apps.bela_turniri.repository.GameNameRepository;
import hr.mrodek.apps.bela_turniri.repository.PairsRepository;
import hr.mrodek.apps.bela_turniri.repository.PushDeviceRepository;
import hr.mrodek.apps.bela_turniri.repository.PushSubscriptionRepository;
import hr.mrodek.apps.bela_turniri.repository.UserBlockRepository;
import hr.mrodek.apps.bela_turniri.repository.UserProfileRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import org.jboss.logging.Logger;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * "Obriši račun" — {@code DELETE /user/me}.
 *
 * <h2>Anonymisation, not erasure</h2>
 * The owner's decision, and the only one that survives contact with the
 * domain: a tournament is SHARED history. Deleting the pairs and matches a
 * leaving user took part in would silently rewrite the results of everybody
 * who played against them, and an organiser would watch their finished
 * tournament lose rows. So the PERSON disappears and the play stays:
 *
 * <table>
 *   <caption>Per-table effect of one deletion</caption>
 *   <tr><th>table</th><th>what happens</th></tr>
 *   <tr><td>{@code user_profiles}</td>
 *       <td>row KEPT; {@code deleted_at} stamped; display name, phone,
 *           phone country, avatar preset, locale and colour mode nulled; the
 *           avatar {@code Resources} row unlinked and released if orphaned.
 *           {@code slug} KEPT — see below.</td></tr>
 *   <tr><td>{@code game_names}</td><td>row DELETED (the name above the seat).</td></tr>
 *   <tr><td>{@code push_subscriptions}, {@code push_devices}</td>
 *       <td>rows DELETED — no more notifications, on any device.</td></tr>
 *   <tr><td>{@code blok_sessions}</td>
 *       <td>rows DELETED: the personal scorepad history is the user's alone,
 *           nobody else's record depends on it.</td></tr>
 *   <tr><td>{@code user_blocks}</td>
 *       <td>edges in BOTH directions DELETED — a block is a setting, and
 *           settings go with the account.</td></tr>
 *   <tr><td>{@code pairs}</td>
 *       <td>{@code contact_phone} nulled on every pair they submitted.
 *           {@code submitted_by_uid} / {@code co_submitted_by_uid} KEPT.</td></tr>
 *   <tr><td>{@code tournaments}</td>
 *       <td>{@code created_by_uid} KEPT — an orphaned tournament still needs
 *           an owner uid for admin overrides to key on.</td></tr>
 *   <tr><td>{@code contact_messages}, {@code game_results},
 *           {@code content_reports}</td>
 *       <td>KEPT. The first has its own retention job, the second is match
 *           history like any other, the third is the moderation record and is
 *           exactly what must not vanish when the reported party leaves.</td></tr>
 * </table>
 *
 * <h2>Why the row and the slug are kept</h2>
 * Two reasons, and the second is the important one. The opaque uid stays on
 * every pair the user submitted, so the "Prijavio: …" enrichment still finds a
 * row and renders {@code profile.deletedUser} through {@link DisplayNames}
 * rather than a blank or an NPE. And dropping the row would put the SLUG back
 * in the pool: the next person whose name normalises to {@code marko-markovic}
 * would inherit every old link, QR code and shared URL that pointed at the
 * deleted account. A kept row makes those links a clean 404 instead.
 *
 * <h2>Firebase</h2>
 * The Firebase Auth user is deleted server-side, best-effort, and only when an
 * FCM service account is configured (that is the only thing that initialises a
 * {@link FirebaseApp} in this process — see {@link FcmSender}). Without one,
 * one WARN is logged and the request still returns 204: the frontend also
 * calls the client-side {@code deleteUser()}, so the Auth record has a second
 * path out, and a missing credential must never leave a user unable to delete
 * their data. The local anonymisation above is the part that actually matters
 * and it has already committed by then.
 */
@ApplicationScoped
public class AccountDeletionService {

    private static final Logger LOG = Logger.getLogger(AccountDeletionService.class);

    @Inject UserProfileRepository profileRepo;
    @Inject PushSubscriptionRepository pushSubscriptionRepo;
    @Inject PushDeviceRepository pushDeviceRepo;
    @Inject GameNameRepository gameNameRepo;
    @Inject UserBlockRepository blockRepo;
    @Inject PairsRepository pairRepo;
    @Inject StorageService storageService;
    @Inject FcmSender fcm;
    @Inject EntityManager em;

    /** Outcome of one deletion, so the controller can pick its status code. */
    public enum Outcome {
        /** There was a live account and it is now anonymised. */
        DELETED,
        /** The account was already deleted (or never had a profile row) — nothing to do. */
        ALREADY_GONE
    }

    /**
     * Anonymise everything belonging to {@code uid}.
     *
     * <p>Runs inside the caller's transaction (the controller carries
     * {@code @Transactional}, per CLAUDE.md), so either the whole checklist
     * lands or none of it does. The two best-effort steps that reach outside
     * the database — releasing the avatar's MinIO object and deleting the
     * Firebase Auth user — are explicitly allowed to fail without failing the
     * request.
     *
     * <p>IDEMPOTENT: calling it a second time returns
     * {@link Outcome#ALREADY_GONE} and writes nothing. The controller answers
     * 204 either way — see {@code UserMeController#deleteAccount} for why a
     * second DELETE is not a 404.
     */
    public Outcome deleteAccount(String uid) {
        if (uid == null || uid.isBlank()) return Outcome.ALREADY_GONE;

        UserProfile profile = profileRepo.findByUid(uid).orElse(null);
        boolean alreadyDeleted = profile != null && profile.isDeleted();

        // The side tables are cleared unconditionally, even when the profile
        // row is missing or already stamped: profiles are created lazily, so a
        // user can perfectly well own push devices and a game name without
        // ever having had one, and a half-finished earlier attempt must be
        // finishable.
        pushSubscriptionRepo.delete("userUid", uid);
        pushDeviceRepo.delete("userUid", uid);
        gameNameRepo.delete("gameUid", uid);
        blockRepo.deleteInvolving(uid);

        // Personal scorepad history. Native query rather than the repository:
        // BlokSessionRepository is scoped by (uid, uuid) per series by design
        // and has no "everything this user ever played" delete, which is the
        // right shape for every other caller.
        em.createNativeQuery("delete from blok_sessions where user_uid = :uid")
                .setParameter("uid", uid)
                .executeUpdate();

        // The one PII field on a row we are keeping. Both submitter columns,
        // because a co-owner's phone is on the pair just the same.
        List<Pairs> myPairs = pairRepo.list("submittedByUid = ?1 or coSubmittedByUid = ?1", uid);
        for (Pairs p : myPairs) {
            p.setContactPhone(null);
        }

        anonymisePairPresets(uid);

        Resources oldAvatar = null;
        if (profile != null && !alreadyDeleted) {
            oldAvatar = profile.getAvatar();
            profile.setDeletedAt(OffsetDateTime.now());
            profile.setDisplayName(null);
            profile.setPhone(null);
            profile.setPhoneCountry(null);
            profile.setAvatar(null);
            profile.setAvatarPreset(null);
            profile.setLocale(null);
            profile.setColorMode(null);
            // slug deliberately untouched — see the class javadoc.
            profileRepo.persist(profile);
        }

        if (oldAvatar != null) {
            // Best-effort and already guarded internally: deletes the MinIO
            // object and the Resources row only if nothing else points at them.
            storageService.releaseIfOrphaned(oldAvatar);
        }

        deleteFirebaseUser(uid);

        return alreadyDeleted || profile == null ? Outcome.ALREADY_GONE : Outcome.DELETED;
    }

    /**
     * Saved pair presets ("Marko &amp; Pero") are user-authored names keyed on
     * the uid — the last table carrying the person's own words. They are
     * SHARED with a co-owner, so the rule is ownership-aware rather than a
     * blanket delete (2026-09-13):
     *
     * <ul>
     *   <li>preset owned by the deleter alone → deleted (its claim token
     *       with it, so a pending share link dies rather than resurrecting
     *       a name the owner asked to forget);</li>
     *   <li>preset owned by the deleter WITH a co-owner → handed to the
     *       co-owner outright: they typed half of it and still use it;</li>
     *   <li>preset somebody else owns where the deleter is co-owner → the
     *       co-owner link is dropped, the preset stays theirs;</li>
     *   <li>a pending archive request by the deleter → cleared.</li>
     * </ul>
     *
     * Native SQL for the same reason as the blok history above: the preset
     * repository is shaped around one viewer's list, not around "everything
     * this uid touches".
     */
    private void anonymisePairPresets(String uid) {
        em.createNativeQuery(
                        "update user_pair_presets set user_uid = co_owner_uid, co_owner_uid = null"
                                + " where user_uid = :uid and co_owner_uid is not null")
                .setParameter("uid", uid)
                .executeUpdate();
        em.createNativeQuery("delete from user_pair_presets where user_uid = :uid and co_owner_uid is null")
                .setParameter("uid", uid)
                .executeUpdate();
        em.createNativeQuery("update user_pair_presets set co_owner_uid = null where co_owner_uid = :uid")
                .setParameter("uid", uid)
                .executeUpdate();
        em.createNativeQuery(
                        "update user_pair_presets set archive_request_by_uid = null"
                                + " where archive_request_by_uid = :uid")
                .setParameter("uid", uid)
                .executeUpdate();
    }

    /**
     * Remove the Firebase Auth record so the credentials stop working.
     *
     * <p>Never throws. A missing service account, a Firebase outage or a user
     * that Firebase has already forgotten all end the same way: one log line,
     * and the request still succeeds.
     */
    private void deleteFirebaseUser(String uid) {
        FirebaseApp app = fcm.firebaseApp();
        if (app == null) {
            LOG.warnf("Account deletion: no Firebase service account configured — Firebase Auth user %s "
                    + "was NOT deleted server-side; the client-side deleteUser() call is the only path. "
                    + "Local data has still been anonymised.", uid);
            return;
        }
        try {
            FirebaseAuth.getInstance(app).deleteUser(uid);
            LOG.infof("Account deletion: Firebase Auth user %s deleted.", uid);
        } catch (FirebaseAuthException e) {
            // USER_NOT_FOUND included: the client may have deleted itself first.
            LOG.warnf(e, "Account deletion: could not delete Firebase Auth user %s (ignored, best-effort).", uid);
        } catch (Exception e) {
            LOG.warnf(e, "Account deletion: unexpected failure deleting Firebase Auth user %s (ignored).", uid);
        }
    }
}
