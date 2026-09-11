package hr.mrodek.apps.bela_turniri.services;

import com.google.api.core.ApiFuture;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.AndroidConfig;
import com.google.firebase.messaging.AndroidNotification;
import com.google.firebase.messaging.ApnsConfig;
import com.google.firebase.messaging.Aps;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.MessagingErrorCode;
import com.google.firebase.messaging.Notification;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * Firebase Cloud Messaging sender — the NATIVE half of push, next to
 * {@link PushService}'s Web Push half. A browser keeps getting a VAPID
 * push; an installed iOS/Android shell gets an FCM v1 message; a user with
 * both gets both, and neither branch can break the other.
 *
 * <h2>Configuration</h2>
 * <p>Credentials are a Firebase service account for the SAME project as
 * {@code FIREBASE_PROJECT_ID}, given either as raw JSON
 * ({@code FIREBASE_SERVICE_ACCOUNT_JSON}, which wins) or as a path to the
 * downloaded key file ({@code FIREBASE_SERVICE_ACCOUNT_FILE}). With neither
 * set the sender is DISABLED: {@link #isEnabled()} is false, {@link #send}
 * is a no-op, and the backend boots and registers devices exactly as
 * before — the tokens simply start being used the moment credentials land.
 *
 * <h2>Threading</h2>
 * <p>{@link #send} performs one blocking HTTPS round-trip and is therefore
 * called only from {@link PushService}'s background sender pool, after the
 * caller's transaction has committed. It never throws: an FCM outage must
 * not be able to reach the request that triggered the notification, nor the
 * Web Push branch that runs beside it.
 *
 * <p>The bean is normal-scoped with non-final methods on purpose, so a test
 * can swap it out with {@code QuarkusMock.installMockForType} — the same
 * pattern the blok tests use for {@link CurrentUser}.
 */
@ApplicationScoped
public class FcmSender {

    private static final Logger LOG = Logger.getLogger(FcmSender.class);

    /** Name of the private {@link FirebaseApp}; keeps us off the global default. */
    private static final String APP_NAME = "bela-fcm";

    /**
     * Hard deadline for one FCM round-trip — the same 8 s the Web Push branch
     * in {@link PushService} uses, and for the same reason: the sender pool is
     * small, so a hanging request must not hold a thread indefinitely.
     */
    private static final int SEND_TIMEOUT_SECONDS = 8;

    /** Outcome of one send, as far as the caller needs to care. */
    public enum Result {
        /** Accepted by FCM. */
        OK,
        /** FCM says this token is gone or malformed — delete the row. */
        DEAD_TOKEN,
        /** Anything else (outage, quota, network). Keep the token, try again next time. */
        FAILED,
        /** Sender is not configured; nothing was attempted. */
        DISABLED
    }

    // Optional<String>, not a defaulted String: SmallRye treats the empty
    // value coming out of `${FIREBASE_SERVICE_ACCOUNT_JSON:}` as "no value"
    // and refuses to inject it into a plain String. Same shape as the VAPID
    // properties in PushService.
    @ConfigProperty(name = "push.fcm.service-account-json")
    Optional<String> serviceAccountJson;

    @ConfigProperty(name = "push.fcm.service-account-file")
    Optional<String> serviceAccountFile;

    @ConfigProperty(name = "push.fcm.android-channel-id", defaultValue = "bela")
    String androidChannelId;

    /** Null until credentials are found; null forever when they never are. */
    private volatile FirebaseMessaging messaging;

    void onStart(@Observes StartupEvent ev) {
        try {
            InputStream credentials = readCredentials();
            if (credentials == null) {
                // Not an error: Web Push still works, device tokens are still
                // stored. StartupSanityCheck turns this into a prod warning.
                LOG.info("Push: FCM service account not configured — native push disabled.");
                return;
            }
            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(credentials))
                    .build();
            // A named app, and reused when it already exists: @QuarkusTest
            // restarts the CDI container within one JVM, and initializeApp
            // throws on a duplicate name.
            FirebaseApp app = FirebaseApp.getApps().stream()
                    .filter(a -> APP_NAME.equals(a.getName()))
                    .findFirst()
                    .orElseGet(() -> FirebaseApp.initializeApp(options, APP_NAME));
            this.messaging = FirebaseMessaging.getInstance(app);
            LOG.info("Push: FCM configured, native push enabled.");
        } catch (Exception e) {
            // A broken key file must not stop the application from booting —
            // same rule as the VAPID branch, and the same consequence: one
            // delivery path is off, everything else runs.
            LOG.error("Push: failed to initialise FCM, native push disabled", e);
        }
    }

    /** Whether a service account was found and FCM can actually deliver. */
    public boolean isEnabled() {
        return messaging != null;
    }

    /**
     * Deliver one notification to one device token.
     *
     * <p>Never throws. Call from a background thread only.
     *
     * @param platform {@code ios} / {@code android}; only used for logging —
     *                 the message carries both platform blocks regardless, as
     *                 FCM ignores the one that does not apply.
     */
    public Result send(String token, String platform, PushService.PushPayload payload) {
        if (!isEnabled()) return Result.DISABLED;
        if (token == null || token.isBlank() || payload == null) return Result.FAILED;
        ApiFuture<String> pending = null;
        try {
            // Same discipline as the web-push branch: the blocking send() has
            // no deadline of its own, so drive the async form and cancel a
            // stuck request rather than pinning a sender thread on it.
            pending = messaging.sendAsync(buildMessage(token, payload));
            pending.get(SEND_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            return Result.OK;
        } catch (TimeoutException te) {
            pending.cancel(true);
            LOG.warnf("Push: FCM send timed out after %ds (platform %s)", SEND_TIMEOUT_SECONDS, platform);
            return Result.FAILED;
        } catch (InterruptedException ie) {
            if (pending != null) pending.cancel(true);
            Thread.currentThread().interrupt();
            return Result.FAILED;
        } catch (ExecutionException ee) {
            return classify(ee.getCause(), platform);
        } catch (Exception e) {
            LOG.warnf(e, "Push: FCM send failed (platform %s)", platform);
            return Result.FAILED;
        }
    }

    /** Maps the cause the async send failed with onto a {@link Result}. */
    private Result classify(Throwable cause, String platform) {
        if (cause instanceof FirebaseMessagingException e) {
            MessagingErrorCode code = e.getMessagingErrorCode();
            if (code == MessagingErrorCode.UNREGISTERED || code == MessagingErrorCode.INVALID_ARGUMENT) {
                // The app was uninstalled, or the token was rotated/garbled.
                // FCM's equivalent of Web Push's 404/410 — drop the row.
                LOG.infof("Push: FCM reports dead token (%s, platform %s), dropping device", code, platform);
                return Result.DEAD_TOKEN;
            }
            LOG.warnf(e, "Push: FCM send failed (%s, platform %s)", code, platform);
            return Result.FAILED;
        }
        LOG.warnf(cause, "Push: FCM send failed (platform %s)", platform);
        return Result.FAILED;
    }

    /* ===================== message shape ===================== */

    /**
     * Builds the FCM v1 message.
     *
     * <p>The {@code data} map deliberately mirrors, key for key, the JSON the
     * service worker reads in {@code frontend/public/sw.js} —
     * {@code {title, body, url, icon, tag}} — so the native tap-handler can
     * reuse the web deep-link logic verbatim. FCM data values must be strings,
     * so absent fields are simply omitted rather than sent as null.
     *
     * <p>{@code notification} carries title/body as well: that is what makes
     * the OS draw the banner while the app is backgrounded, without the app
     * having to be woken at all.
     */
    Message buildMessage(String token, PushService.PushPayload payload) {
        Map<String, String> data = dataOf(payload);

        boolean silent = isBlank(payload.title()) && isBlank(payload.body());

        Aps.Builder aps = Aps.builder();
        if (silent) {
            // No visible copy to show: a background wake-up, not a banner.
            aps.setContentAvailable(true);
        } else {
            aps.setSound("default");
        }

        Message.Builder b = Message.builder()
                .setToken(token)
                .putAllData(data)
                .setApnsConfig(ApnsConfig.builder()
                        .setAps(aps.build())
                        .build())
                .setAndroidConfig(AndroidConfig.builder()
                        // Tournament pushes are time-critical ("Runda 3, stol 4")
                        // and must survive Doze.
                        .setPriority(AndroidConfig.Priority.HIGH)
                        .setNotification(AndroidNotification.builder()
                                // Android 8+ silently drops a notification whose
                                // channel does not exist — the shell creates this
                                // one on first run.
                                .setChannelId(androidChannelId)
                                .build())
                        .build());

        if (!silent) {
            b.setNotification(Notification.builder()
                    // Already localised for the RECIPIENT by PushService before
                    // it ever reaches this method.
                    .setTitle(payload.title() == null ? "" : payload.title())
                    .setBody(payload.body() == null ? "" : payload.body())
                    .build());
        }

        return b.build();
    }

    /** The web payload's fields, flattened to the strings FCM data allows. */
    private static Map<String, String> dataOf(PushService.PushPayload payload) {
        Map<String, String> data = new LinkedHashMap<>();
        put(data, "title", payload.title());
        put(data, "body", payload.body());
        put(data, "url", payload.url());
        put(data, "icon", payload.icon());
        put(data, "tag", payload.tag());
        return data;
    }

    private static void put(Map<String, String> map, String key, String value) {
        if (value != null && !value.isBlank()) map.put(key, value);
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    /* ===================== credentials ===================== */

    /** Raw JSON wins over the file path; null when neither is usable. */
    private InputStream readCredentials() throws Exception {
        String json = serviceAccountJson.orElse("").trim();
        if (!json.isEmpty()) {
            return new ByteArrayInputStream(json.getBytes(StandardCharsets.UTF_8));
        }
        String file = serviceAccountFile.orElse("").trim();
        if (!file.isEmpty()) {
            Path path = Path.of(file);
            if (!Files.isReadable(path)) {
                LOG.errorf("Push: FIREBASE_SERVICE_ACCOUNT_FILE '%s' is not readable — native push disabled.", file);
                return null;
            }
            return Files.newInputStream(path);
        }
        return null;
    }
}
