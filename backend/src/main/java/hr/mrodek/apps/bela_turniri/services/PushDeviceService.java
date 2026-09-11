package hr.mrodek.apps.bela_turniri.services;

import hr.mrodek.apps.bela_turniri.model.PushDevice;
import hr.mrodek.apps.bela_turniri.repository.PushDeviceRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.NotFoundException;
import org.jboss.logging.Logger;

import java.time.OffsetDateTime;
import java.util.Locale;
import java.util.Set;

/**
 * Registration side of native push: who owns which FCM token.
 *
 * <p>Lives in a service rather than in the controller because two resources
 * expose the same two operations — {@code /push/device}, next to the Web Push
 * endpoints it parallels, and {@code /user/me/push/device}, next to the rest
 * of the "my account" surface the native shells talk to. One implementation,
 * two paths, no chance of them drifting.
 *
 * <p><b>Guests have no native push.</b> Both operations need a Firebase UID
 * to key the row on, and a guest (no account, no bearer token) has none — so
 * the endpoints are {@code @Authenticated} and a guest simply never registers.
 * That is the same rule Web Push already follows.
 *
 * <p>Callers must supply the transaction ({@code @Transactional} stays on the
 * controller methods, per CLAUDE.md).
 */
@ApplicationScoped
public class PushDeviceService {

    private static final Logger LOG = Logger.getLogger(PushDeviceService.class);

    /** The only platforms the shells register as. */
    private static final Set<String> PLATFORMS =
            Set.of(PushDevice.PLATFORM_IOS, PushDevice.PLATFORM_ANDROID);

    @Inject PushDeviceRepository deviceRepo;
    @Inject MessageService messages;

    /**
     * Upsert the calling user's registration for {@code token}.
     *
     * <p>Keyed on the token, not on (user, token): an FCM token identifies an
     * app INSTALL, and one install has one current owner. A token that shows
     * up under a second account means the phone was handed over or a second
     * person signed in on it, so the row is REASSIGNED — the previous owner
     * must stop receiving on that device immediately.
     *
     * @return true when a new row was created, false when an existing one was refreshed
     */
    public boolean register(String uid, String token, String platform, String locale, String appVersion) {
        String normalisedPlatform = normalisePlatform(platform);

        PushDevice device = deviceRepo.findByToken(token).orElse(null);
        boolean created = device == null;
        if (created) {
            device = new PushDevice();
            device.setToken(token);
            device.setCreatedAt(OffsetDateTime.now());
        } else if (!uid.equals(device.getUserUid())) {
            // Audible, like the Web Push equivalent — never log the token itself.
            LOG.infof("Push: device %d changes owner %s -> %s", device.getId(), device.getUserUid(), uid);
        }

        device.setUserUid(uid);
        device.setPlatform(normalisedPlatform);
        device.setLocale(trimToNull(locale, 8));
        device.setAppVersion(trimToNull(appVersion, 32));
        device.setLastSeenAt(OffsetDateTime.now());
        deviceRepo.persist(device);
        return created;
    }

    /**
     * Drop one of the calling user's registrations.
     *
     * <p>404 when the token is unknown OR belongs to someone else: the two are
     * deliberately indistinguishable, so the response never confirms that a
     * token exists under another account.
     */
    public void unregister(String uid, String token) {
        if (deviceRepo.deleteByTokenAndUser(token, uid) == 0) {
            throw new NotFoundException(messages.t("push.device.notFound"));
        }
    }

    /** {@code ios} / {@code android}, case-insensitively; anything else is a 400. */
    private String normalisePlatform(String platform) {
        String p = platform == null ? "" : platform.trim().toLowerCase(Locale.ROOT);
        if (!PLATFORMS.contains(p)) {
            throw new IllegalArgumentException(messages.t("push.device.platform.unsupported"));
        }
        return p;
    }

    /** Column widths are the second line of defence; trim rather than 500 on overflow. */
    private static String trimToNull(String s, int max) {
        if (s == null) return null;
        String t = s.trim();
        if (t.isEmpty()) return null;
        return t.length() <= max ? t : t.substring(0, max);
    }
}
