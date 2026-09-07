package hr.mrodek.apps.bela_turniri.services;

import com.fasterxml.jackson.databind.ObjectMapper;
import hr.mrodek.apps.bela_turniri.repository.PushSubscriptionRepository;
import hr.mrodek.apps.bela_turniri.repository.UserProfileRepository;
import io.quarkus.runtime.StartupEvent;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import jakarta.transaction.Status;
import jakarta.transaction.Synchronization;
import jakarta.transaction.TransactionSynchronizationRegistry;
import nl.martijndwars.webpush.Encoding;
import nl.martijndwars.webpush.Notification;
import org.apache.http.HttpResponse;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.security.Security;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Function;

/**
 * Wraps {@code nl.martijndwars.webpush.PushService} so the rest of the app
 * can fire-and-forget notifications without touching VAPID, BouncyCastle,
 * or Base64URL details.
 *
 * <p>Lifecycle:
 * <ul>
 *   <li>On startup, registers BouncyCastle (web-push needs it for the
 *       per-message AES-GCM crypto) and constructs a singleton
 *       {@link PushService} pinned to the configured VAPID keys.</li>
 *   <li>Each {@code sendToUser(uid, payload)} call reads every
 *       subscription that user has registered (one per device) on the
 *       CALLING thread — cheap, and it has to happen inside whatever
 *       transaction the caller holds — then hands the actual HTTP work
 *       to a small background pool.</li>
 *   <li>On a 404 / 410 from the push service, the subscription is
 *       permanently dropped — that's the spec's way of saying "this
 *       browser uninstalled, stop sending".</li>
 * </ul>
 *
 * <h2>Why the sends are deferred</h2>
 * <p>Every caller (round draw, match scoring, pair approval) is inside an
 * open transaction on a request thread. Pushing in-line meant N blocking
 * HTTPS round-trips to Google/Mozilla/Apple while holding a DB connection
 * and the row locks the surrounding write had taken — a slow push service
 * would stall the whole request. So:
 * <ul>
 *   <li>Subscriptions are materialised into plain records ({@link Target})
 *       while the caller's persistence context is still alive.</li>
 *   <li>If a JTA transaction is active, an interposed
 *       {@link Synchronization} defers the fan-out until AFTER commit —
 *       we never notify about a state change that got rolled back.</li>
 *   <li>Otherwise the fan-out is submitted immediately.</li>
 * </ul>
 * Post-commit bookkeeping (lastSeenAt, dead-subscription deletes) runs in
 * its own short transaction via {@link PushSubscriptionCleaner}.
 *
 * <p>The web-push library exposes no timeout knob (its {@code send()} is
 * {@code sendAsync().get()} with no deadline), so we drive the async form
 * ourselves and cancel the request when it overruns {@link #SEND_TIMEOUT_SECONDS}.
 *
 * <p>Failures are logged at WARN with the uid and the endpoint HOST only —
 * the full endpoint URL is a bearer token and must never reach the logs.
 *
 * <h2>Language of the notification</h2>
 * <p>Notification copy is written for the RECIPIENT, never for the caller
 * whose request happens to trigger it, so it must not be resolved through
 * {@link MessageService#t(String, Object...)} (that reads the caller's
 * {@code X-Locale}). Use {@link #sendToUser(String, java.util.function.Function)}:
 * it resolves the recipient's stored {@code UserProfile.locale} on the
 * calling thread and hands it to the payload factory. Building one payload
 * and reusing it for several uids is a bug whenever those users may have
 * picked different languages.
 */
@ApplicationScoped
public class PushService {

    private static final Logger LOG = Logger.getLogger(PushService.class);

    /** Hard deadline for one push HTTP round-trip. */
    private static final int SEND_TIMEOUT_SECONDS = 8;

    /** Background senders. Small on purpose: the fan-out per event is tiny. */
    private static final int SENDER_THREADS = 4;

    @Inject PushSubscriptionRepository subRepo;
    @Inject ObjectMapper objectMapper;
    @Inject PushSubscriptionCleaner cleaner;
    @Inject UserProfileRepository profileRepo;
    @Inject MessageService messages;

    /**
     * Lets us detect an in-flight JTA transaction and hook after-commit
     * without the caller having to pass anything in.
     */
    @Inject TransactionSynchronizationRegistry txRegistry;

    // defaultValue="" so SmallRye Config doesn't bail at startup when the
    // VAPID env vars are unset (push is optional — backend boots without it
    // and /push/public-key reports ready=false).
    // Optional<String>: SmallRye treats an empty String ("" from `${VAPID_PUBLIC_KEY:}`)
    // as null and refuses to inject it into a plain String even with defaultValue.
    @ConfigProperty(name = "push.vapid.public-key")
    java.util.Optional<String> vapidPublicKeyOpt;

    @ConfigProperty(name = "push.vapid.private-key")
    java.util.Optional<String> vapidPrivateKeyOpt;

    private String vapidPublicKey;
    private String vapidPrivateKey;

    @ConfigProperty(name = "push.vapid.subject", defaultValue = "mailto:noreply@bela-turniri.com")
    String vapidSubject;

    /** Lazily-built singleton — null until VAPID config is present. */
    private volatile nl.martijndwars.webpush.PushService webPush;

    /** Daemon pool: never blocks JVM shutdown if a push service hangs. */
    private ExecutorService senders;

    @PostConstruct
    void initExecutor() {
        AtomicInteger seq = new AtomicInteger(1);
        ThreadFactory tf = r -> {
            Thread t = new Thread(r, "push-sender-" + seq.getAndIncrement());
            t.setDaemon(true);
            return t;
        };
        this.senders = Executors.newFixedThreadPool(SENDER_THREADS, tf);
        this.vapidPublicKey = vapidPublicKeyOpt.orElse("");
        this.vapidPrivateKey = vapidPrivateKeyOpt.orElse("");
    }

    @PreDestroy
    void shutdownExecutor() {
        if (senders != null) senders.shutdownNow();
    }

    void onStart(@Observes StartupEvent ev) {
        Security.addProvider(new org.bouncycastle.jce.provider.BouncyCastleProvider());
        if (vapidPublicKey == null || vapidPublicKey.isBlank()
                || vapidPrivateKey == null || vapidPrivateKey.isBlank()) {
            LOG.warn("Push: VAPID keys not configured — push notifications disabled.");
            return;
        }
        try {
            this.webPush = new nl.martijndwars.webpush.PushService(
                    vapidPublicKey, vapidPrivateKey, vapidSubject);
            LOG.info("Push: VAPID configured, subject=" + vapidSubject);
        } catch (Exception e) {
            LOG.error("Push: failed to initialise web-push service", e);
        }
    }

    /** Whether the service is configured and able to deliver pushes. */
    public boolean isReady() {
        return webPush != null;
    }

    /** Public VAPID key in base64url, served unauthenticated to subscribers. */
    public String publicKey() {
        return vapidPublicKey;
    }

    /**
     * Fan-out to every subscription registered by {@code userUid}.
     *
     * <p>Returns as soon as the subscription rows have been read: the HTTP
     * sends run on the background pool, after commit when the caller is in
     * a transaction. Nothing in here throws — the approve-pair flow that
     * calls this shouldn't fail because of a flaky push service.
     */
    public void sendToUser(String userUid, PushPayload payload) {
        if (userUid == null || userUid.isBlank()) return;
        if (payload == null) return;
        if (!isReady()) return;
        try {
            // Read on the caller's thread/transaction and detach immediately:
            // the background sender has no persistence context of its own.
            List<Target> targets = subRepo.findByUserUid(userUid).stream()
                    .map(s -> new Target(s.getId(), s.getEndpoint(), s.getP256dh(), s.getAuth()))
                    .toList();
            if (targets.isEmpty()) return;

            String json = objectMapper.writeValueAsString(toMap(payload));
            dispatch(userUid, targets, json);
        } catch (Exception e) {
            LOG.warnf(e, "Push: could not queue notification for uid %s", userUid);
        }
    }

    /**
     * Same fan-out as {@link #sendToUser(String, PushPayload)}, but composes
     * the payload in the RECIPIENT's own language.
     *
     * <p>Why this exists: a notification is always built while handling
     * <i>someone else's</i> request — the organiser draws a round, the push
     * goes to every player; the organiser scores a match, the bill goes to
     * the losing pair. {@link MessageService#t(String, Object...)} would use
     * the <b>organiser's</b> {@code X-Locale}, so a Slovenian player would be
     * told "Runda 3" because the organiser's browser is Croatian. Callers
     * therefore pass a factory and get handed the recipient's locale.
     *
     * <p>The lookup and the factory both run on the CALLING thread, i.e.
     * inside the caller's request and transaction — the background sender
     * thread has no request scope and no persistence context, so resolving a
     * locale (or touching any entity) there would fail at runtime while
     * compiling perfectly. Everything the sender needs is already flattened
     * into the JSON string by the time it is submitted.
     */
    public void sendToUser(String userUid, Function<Locale, PushPayload> payloadFactory) {
        if (userUid == null || userUid.isBlank()) return;
        if (payloadFactory == null) return;
        // Cheap exit before the profile query: nothing would be sent anyway.
        if (!isReady()) return;
        sendToUser(userUid, payloadFactory.apply(recipientLocale(userUid)));
    }

    /**
     * The language {@code userUid} chose, from their stored
     * {@code UserProfile.locale}; Croatian when there is no profile, no
     * stored value or an unsupported one.
     *
     * <p>Call on a request thread only — it hits the database. Exposed so a
     * caller that already needs the locale for something else (e.g. to build
     * one payload shared by both members of a pair) does not have to
     * re-implement the null/unsupported handling.
     */
    public Locale recipientLocale(String userUid) {
        if (userUid == null || userUid.isBlank()) return MessageService.DEFAULT_LOCALE;
        try {
            return profileRepo.findByUid(userUid)
                    .map(p -> messages.localeOf(p.getLocale()))
                    .orElse(MessageService.DEFAULT_LOCALE);
        } catch (RuntimeException e) {
            // A push must never be the reason a write fails.
            LOG.debugf(e, "Push: could not read locale for uid %s, using default", userUid);
            return MessageService.DEFAULT_LOCALE;
        }
    }

    /* ===================== dispatch ===================== */

    /**
     * Queue the fan-out. Sent immediately only when there is genuinely no JTA
     * transaction in progress; with an active transaction the send is deferred
     * to after a successful commit. Any other transaction state (marked for
     * rollback, rolling back, preparing, …) means the data behind the
     * notification may never land, so the push is dropped.
     */
    private void dispatch(String userUid, List<Target> targets, String json) {
        Runnable task = () -> {
            for (Target t : targets) sendOne(userUid, t, json);
        };

        int status;
        try {
            status = (txRegistry == null)
                    ? Status.STATUS_NO_TRANSACTION
                    : txRegistry.getTransactionStatus();
        } catch (Exception e) {
            // Registry unusable — treat as "no transaction" and send inline.
            LOG.debugf(e, "Push: transaction registry unavailable, sending inline");
            submit(task);
            return;
        }

        if (status == Status.STATUS_NO_TRANSACTION) {
            submit(task);
            return;
        }

        if (status != Status.STATUS_ACTIVE) {
            // MARKED_ROLLBACK / ROLLING_BACK / PREPARING / … — the write is not
            // going to survive, so never announce it.
            LOG.debugf("Push: dropping notification for uid %s, transaction status %d", userUid, status);
            return;
        }

        try {
            txRegistry.registerInterposedSynchronization(new Synchronization() {
                @Override
                public void beforeCompletion() {
                    // nothing — all the work is post-commit
                }

                @Override
                public void afterCompletion(int st) {
                    // Only notify about state that actually landed.
                    if (st == Status.STATUS_COMMITTED) submit(task);
                }
            });
        } catch (Exception e) {
            // Could not hook into the commit — dropping is safer than sending
            // something the transaction may still roll back.
            LOG.warnf(e, "Push: could not register commit hook for uid %s, dropping notification", userUid);
        }
    }

    private void submit(Runnable task) {
        try {
            senders.submit(task);
        } catch (Exception e) {
            // Pool shutting down: drop the push rather than fail the caller.
            LOG.warnf(e, "Push: sender pool rejected a notification");
        }
    }

    /* ===================== sending ===================== */

    private void sendOne(String userUid, Target target, String payloadJson) {
        String host = PushEndpointValidator.hostOf(target.endpoint());
        Future<HttpResponse> pending = null;
        try {
            var notification = new Notification(
                    target.endpoint(),
                    decodePublicKey(target.p256dh()),
                    Base64.getUrlDecoder().decode(padBase64(target.auth())),
                    payloadJson.getBytes(java.nio.charset.StandardCharsets.UTF_8));

            // The library's blocking send() has no deadline; drive the async
            // form so we can cancel a stuck request. AESGCM keeps the wire
            // format identical to what send(notification) used before.
            pending = webPush.sendAsync(notification, Encoding.AESGCM);
            HttpResponse response = pending.get(SEND_TIMEOUT_SECONDS, TimeUnit.SECONDS);

            int code = response.getStatusLine().getStatusCode();
            if (code >= 200 && code < 300) {
                cleaner.markSeen(target.id());
            } else if (code == 404 || code == 410) {
                // Subscription has expired / app uninstalled. Drop it.
                LOG.infof("Push: dropping expired subscription %d (HTTP %d, host %s)",
                        target.id(), code, host);
                cleaner.deleteById(target.id());
            } else {
                LOG.warnf("Push: unexpected response HTTP %d for uid %s (host %s)",
                        code, userUid, host);
            }
        } catch (TimeoutException te) {
            if (pending != null) pending.cancel(true);
            LOG.warnf("Push: send timed out after %ds for uid %s (host %s)",
                    SEND_TIMEOUT_SECONDS, userUid, host);
        } catch (InterruptedException ie) {
            if (pending != null) pending.cancel(true);
            Thread.currentThread().interrupt();
        } catch (Exception e) {
            LOG.warnf(e, "Push: send failed for uid %s (host %s)", userUid, host);
        }
    }

    private java.security.PublicKey decodePublicKey(String b64url) throws Exception {
        byte[] raw = Base64.getUrlDecoder().decode(padBase64(b64url));
        var params = org.bouncycastle.jce.ECNamedCurveTable.getParameterSpec("secp256r1");
        var pubPoint = params.getCurve().decodePoint(raw);
        var spec = new org.bouncycastle.jce.spec.ECPublicKeySpec(pubPoint, params);
        var kf = java.security.KeyFactory.getInstance("ECDH", "BC");
        return kf.generatePublic(spec);
    }

    private static String padBase64(String s) {
        int pad = (4 - (s.length() % 4)) % 4;
        return pad == 0 ? s : s + "=".repeat(pad);
    }

    private Map<String, Object> toMap(PushPayload payload) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("title", payload.title());
        m.put("body", payload.body());
        Optional.ofNullable(payload.url()).ifPresent(u -> m.put("url", u));
        Optional.ofNullable(payload.icon()).ifPresent(u -> m.put("icon", u));
        Optional.ofNullable(payload.tag()).ifPresent(t -> m.put("tag", t));
        return m;
    }

    /**
     * A subscription flattened out of the persistence context so the
     * background sender never touches a (possibly detached) entity.
     */
    private record Target(Long id, String endpoint, String p256dh, String auth) {}

    /**
     * Wire shape of a single push. The frontend service worker reads these
     * three fields from {@code event.data.json()} and forwards them to
     * {@code showNotification}; {@code url} is stamped onto the notification's
     * data so {@code notificationclick} can open the right page.
     */
    public record PushPayload(
            String title,
            String body,
            String url,
            String icon,
            String tag
    ) {
        public PushPayload(String title, String body, String url) {
            this(title, body, url, "/bela-turniri-symbol.png", null);
        }
    }
}
