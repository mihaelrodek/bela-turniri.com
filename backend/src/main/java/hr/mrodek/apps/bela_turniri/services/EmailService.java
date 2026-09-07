package hr.mrodek.apps.bela_turniri.services;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.runtime.LaunchMode;
import io.quarkus.runtime.StartupEvent;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import jakarta.transaction.Status;
import jakarta.transaction.Synchronization;
import jakarta.transaction.TransactionSynchronizationRegistry;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;
import org.jboss.logging.MDC;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Transactional e-mail, sent through the <a href="https://resend.com">Resend</a>
 * HTTP API.
 *
 * <p>Deliberately NOT {@code quarkus-mailer}: the only thing this app sends is
 * a handful of notification mails, and Resend's REST endpoint is one POST with
 * a JSON body — a plain {@link HttpClient} plus the Jackson
 * {@link ObjectMapper} that is already on the classpath does the job without
 * adding an SMTP stack, a reactive mailer and their transitive dependencies to
 * the build.
 *
 * <h2>Nothing here may ever break the caller</h2>
 * Every send is fire-and-forget and swallows its own failures, exactly like
 * {@link PushService}: a flaky third-party mail API must not turn a stored
 * contact message into a 500 for the visitor who wrote it. Concretely:
 * <ul>
 *   <li><b>Not configured → silent no-op.</b> With {@code RESEND_API_KEY}
 *       unset ({@link #isReady()} false) nothing is sent and nothing throws,
 *       so {@code quarkus:dev} and the test profile run with no mail
 *       credentials at all. The fact is logged once at boot, not once per
 *       send.</li>
 *   <li><b>After commit, off the request thread.</b> The HTTP round trip to
 *       Resend must not happen while the caller holds a transaction and a
 *       JDBC connection, and a mail must never announce a row that then rolls
 *       back. So the send is deferred to an interposed JTA
 *       {@link Synchronization} and only submitted on
 *       {@link Status#STATUS_COMMITTED} — the same idiom, and for the same
 *       reasons, as {@code PushService.dispatch}. With no transaction in
 *       progress the send is submitted immediately (still asynchronously).</li>
 *   <li><b>Bounded.</b> {@link #SEND_TIMEOUT_SECONDS} caps one request; the
 *       sender pool is small and daemon, so a hung Resend can neither pile up
 *       threads nor hold JVM shutdown.</li>
 * </ul>
 *
 * <h2>Language</h2>
 * Copy for a mail is composed by the CALLER, on the request thread, before
 * calling {@link #send}: this class receives finished strings. That is
 * deliberate — {@link MessageService#t(String, Object...)} reads the
 * request-scoped locale, which does not exist on the sender thread. A mail
 * written for someone other than the current caller must be resolved with
 * {@code messages.t(recipientLocale, key)} at the call site, exactly as push
 * payloads are.
 */
@ApplicationScoped
public class EmailService {

    private static final Logger LOG = Logger.getLogger(EmailService.class);

    /** Resend's transactional-send endpoint. */
    private static final String RESEND_ENDPOINT = "https://api.resend.com/emails";

    /** Hard deadline for one Resend round trip. */
    private static final int SEND_TIMEOUT_SECONDS = 8;

    /** Background senders. Two is plenty: the volume is a few mails a day. */
    private static final int SENDER_THREADS = 2;

    @Inject ObjectMapper objectMapper;

    /**
     * Lets us detect an in-flight JTA transaction and hook after-commit
     * without every caller having to pass anything in.
     */
    @Inject TransactionSynchronizationRegistry txRegistry;

    /**
     * {@code Optional<String>}, not a plain String with {@code defaultValue}:
     * SmallRye Config treats the empty string produced by {@code ${RESEND_API_KEY:}}
     * as a MISSING value and refuses to inject it — the same trap
     * {@code PushService} documents for the VAPID keys.
     */
    @ConfigProperty(name = "app.mail.resend-api-key")
    Optional<String> apiKeyOpt;

    @ConfigProperty(name = "app.mail.from", defaultValue = "Bela turniri <noreply@bela-turniri.com>")
    String from;

    /** Mailbox the contact form is delivered to. Empty = contact mail disabled. */
    @ConfigProperty(name = "app.mail.contact-to")
    Optional<String> contactToOpt;

    private String apiKey;
    private String contactTo;

    /** Built once — {@link HttpClient} is thread-safe and pools connections. */
    private HttpClient http;

    /** Daemon pool: never blocks JVM shutdown if Resend hangs. */
    private ExecutorService senders;

    @PostConstruct
    void init() {
        this.apiKey = apiKeyOpt.map(String::trim).filter(s -> !s.isEmpty()).orElse("");
        this.contactTo = contactToOpt.map(String::trim).filter(s -> !s.isEmpty()).orElse("");

        AtomicInteger seq = new AtomicInteger(1);
        ThreadFactory tf = r -> {
            Thread t = new Thread(r, "mail-sender-" + seq.getAndIncrement());
            t.setDaemon(true);
            return t;
        };
        this.senders = Executors.newFixedThreadPool(SENDER_THREADS, tf);

        this.http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(SEND_TIMEOUT_SECONDS))
                // Resend answers 3xx for nothing we send; following redirects
                // would only widen where an API key could be replayed to.
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
    }

    @PreDestroy
    void shutdown() {
        if (senders != null) senders.shutdownNow();
    }

    /**
     * One INFO line at boot saying whether mail is live, plus the prod-only
     * WARNs that would live in {@code StartupSanityCheck} if this service
     * were not the only thing that reads these two variables.
     */
    void onStart(@Observes StartupEvent ev) {
        if (!isReady()) {
            LOG.info("Mail: RESEND_API_KEY not configured — outgoing e-mail is disabled (every send is a no-op).");
        } else {
            LOG.infof("Mail: Resend configured, from=%s, contactTo=%s",
                    from, contactTo.isEmpty() ? "(unset)" : contactTo);
        }

        // Dev and test legitimately run without mail credentials; only nag in prod.
        if (LaunchMode.current() != LaunchMode.NORMAL) return;
        if (!isReady()) {
            LOG.warn("RESEND_API_KEY is unset in production. The contact form will still accept and "
                    + "store messages, but nobody will be e-mailed about them. Set RESEND_API_KEY "
                    + "(see DEPLOY.md → Email (Resend)).");
        }
        if (contactTo.isEmpty()) {
            LOG.warn("CONTACT_TO is unset in production. Contact-form submissions are stored but not "
                    + "forwarded to anyone. Set CONTACT_TO=you@your-domain.tld.");
        }
    }

    /** True when an API key is configured and mail can actually go out. */
    public boolean isReady() {
        return apiKey != null && !apiKey.isEmpty();
    }

    /** Mailbox the contact form delivers to, or {@code ""} when unset. */
    public String contactTo() {
        return contactTo;
    }

    /**
     * Queue one e-mail. Returns as soon as the payload has been serialised;
     * the HTTP call runs on the sender pool, after commit when the caller is
     * inside a transaction. Never throws.
     *
     * @param to       recipient address; the send is skipped when blank
     * @param subject  subject line, already in the recipient's language
     * @param html     HTML body — the caller is responsible for escaping any
     *                 user-supplied text interpolated into it
     * @param text     plain-text alternative; may be null
     * @param replyTo  address a reply goes to (the contact form puts the
     *                 sender here so the mailbox can just hit Reply); may be null
     */
    public void send(String to, String subject, String html, String text, String replyTo) {
        if (!isReady()) return;
        if (to == null || to.isBlank()) return;
        if (subject == null || subject.isBlank()) return;
        if ((html == null || html.isBlank()) && (text == null || text.isBlank())) return;

        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("from", from);
            payload.put("to", List.of(to.trim()));
            payload.put("subject", subject);
            if (html != null && !html.isBlank()) payload.put("html", html);
            if (text != null && !text.isBlank()) payload.put("text", text);
            if (replyTo != null && !replyTo.isBlank()) payload.put("reply_to", replyTo.trim());

            String body = objectMapper.writeValueAsString(payload);
            // Read the correlation id HERE: the MDC is bound to the request,
            // and the sender thread has none. Without it a failed send is an
            // orphan log line nobody can tie back to a report.
            String requestId = currentRequestId();
            dispatch(() -> post(to.trim(), body, requestId));
        } catch (Exception e) {
            LOG.warnf(e, "Mail: could not queue message to %s", to);
        }
    }

    /* ===================== dispatch ===================== */

    /**
     * Queue {@code task}. Sent immediately only when there is genuinely no JTA
     * transaction in progress; with an active transaction the send is deferred
     * to after a successful commit. Any other transaction state (marked for
     * rollback, rolling back, preparing, …) means the data the mail talks
     * about may never land, so the mail is dropped.
     *
     * <p>Mirrors {@code PushService.dispatch} deliberately — the two side
     * channels must behave identically around a rollback, or a user gets an
     * e-mail about a message that was never stored.
     */
    private void dispatch(Runnable task) {
        int status;
        try {
            status = (txRegistry == null)
                    ? Status.STATUS_NO_TRANSACTION
                    : txRegistry.getTransactionStatus();
        } catch (Exception e) {
            LOG.debugf(e, "Mail: transaction registry unavailable, sending without a commit hook");
            submit(task);
            return;
        }

        if (status == Status.STATUS_NO_TRANSACTION) {
            submit(task);
            return;
        }

        if (status != Status.STATUS_ACTIVE) {
            LOG.debugf("Mail: dropping message, transaction status %d", status);
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
                    if (st == Status.STATUS_COMMITTED) submit(task);
                }
            });
        } catch (Exception e) {
            // Could not hook the commit — dropping is safer than mailing about
            // something the transaction may still roll back.
            LOG.warnf(e, "Mail: could not register commit hook, dropping message");
        }
    }

    private void submit(Runnable task) {
        try {
            senders.submit(task);
        } catch (Exception e) {
            LOG.warnf(e, "Mail: sender pool rejected a message");
        }
    }

    /* ===================== sending ===================== */

    /**
     * The actual Resend call. Runs on a sender thread: no request scope, no
     * persistence context, nothing but the two strings it was handed.
     */
    private void post(String to, String body, String requestId) {
        try {
            HttpRequest req = HttpRequest.newBuilder(URI.create(RESEND_ENDPOINT))
                    .timeout(Duration.ofSeconds(SEND_TIMEOUT_SECONDS))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            int code = res.statusCode();
            if (code >= 200 && code < 300) {
                LOG.debugf("Mail: sent to %s [%s]", to, requestId);
                return;
            }
            // Resend answers with a JSON {name, message} on failure. It never
            // echoes the API key, but it can echo the address, so this stays
            // at WARN with the body trimmed rather than at ERROR with all of it.
            LOG.warnf("Mail: Resend returned HTTP %d for %s [%s]: %s",
                    code, to, requestId, trim(res.body()));
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        } catch (Exception e) {
            LOG.warnf(e, "Mail: send failed for %s [%s]", to, requestId);
        }
    }

    /** The {@code X-Request-Id} of the request that triggered this send, or "-". */
    private static String currentRequestId() {
        try {
            Object id = MDC.get("requestId");
            return id == null ? "-" : id.toString();
        } catch (Exception e) {
            return "-";
        }
    }

    private static String trim(String s) {
        if (s == null) return "";
        return s.length() <= 300 ? s : s.substring(0, 300) + "…";
    }

    /* ===================== helpers ===================== */

    /**
     * Minimal HTML escaping for user-supplied text interpolated into a mail
     * body. Local on purpose rather than reusing the preview renderer's
     * escaper: the two have different lifecycles and an e-mail must not break
     * because an SEO template was refactored.
     */
    public static String escapeHtml(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
