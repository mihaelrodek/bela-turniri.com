package hr.mrodek.apps.bela_turniri.controller;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import hr.mrodek.apps.bela_turniri.dtos.ContactRequest;
import hr.mrodek.apps.bela_turniri.errors.ApiError;
import hr.mrodek.apps.bela_turniri.model.ContactMessage;
import hr.mrodek.apps.bela_turniri.repository.ContactMessageRepository;
import hr.mrodek.apps.bela_turniri.services.CurrentUser;
import hr.mrodek.apps.bela_turniri.services.EmailService;
import hr.mrodek.apps.bela_turniri.services.MessageService;
import hr.mrodek.apps.bela_turniri.services.RequestLocale;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;

import java.time.Duration;
import java.util.Locale;

/**
 * The public contact form: {@code POST /api/contact}.
 *
 * <p>Anonymous by design — someone who cannot sign in (forgotten password,
 * a bug in registration) is exactly the person who most needs to reach us.
 * A signed-in sender is simply enriched: their Firebase uid is stamped on the
 * row so an admin can see who wrote in, and nothing is authorised against it.
 *
 * <p>The submission is stored FIRST and mailed SECOND, both inside the same
 * transaction, with the mail deferred to after commit by {@code EmailService}.
 * So the row is the durable record and the mail is a convenience: a dead
 * Resend, a missing {@code CONTACT_TO}, or a mailbox that filters us loses a
 * notification, never the message itself.
 *
 * <h2>Spam guard</h2>
 * A public, unauthenticated endpoint that triggers an outbound e-mail is an
 * obvious amplification target, so:
 * <ul>
 *   <li>a <b>honeypot</b> field ({@code website}) that no real browser ever
 *       fills in — when it is non-blank the request is answered 202 and
 *       otherwise ignored, because a bot told it was rejected just learns to
 *       leave the field alone next time;</li>
 *   <li>an in-memory per-IP throttle of {@value #MAX_PER_WINDOW} submissions
 *       per {@link #WINDOW} → 429 {@code RATE_LIMITED}. Deliberately not a
 *       table: this is throttling, not an audit trail, and losing the counters
 *       on a redeploy costs at most a handful of extra allowed submissions.
 *       Caddy rate-limits the edge on top of this.</li>
 * </ul>
 */
@Path("/contact")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ContactController {

    private static final Logger LOG = Logger.getLogger(ContactController.class);

    /** Submissions one client IP may make inside {@link #WINDOW}. */
    private static final int MAX_PER_WINDOW = 5;

    /**
     * Rolling window the per-IP count is measured over. {@code expireAfterWrite}
     * is re-armed on every recorded submission, so the window slides with an
     * ongoing flood instead of handing it a clean slate every ten minutes.
     */
    private static final Duration WINDOW = Duration.ofMinutes(10);

    /**
     * client IP → submissions inside the window. {@code static} on purpose:
     * it must survive regardless of how the JAX-RS resource ends up scoped,
     * and there is exactly one process per node. {@code maximumSize} bounds
     * the guard's own memory so a flood from thousands of spoofed IPs cannot
     * turn it into the leak it exists to prevent.
     */
    private static final Cache<String, Integer> SUBMITS = Caffeine.newBuilder()
            .expireAfterWrite(WINDOW)
            .maximumSize(10_000)
            .build();

    @Inject ContactMessageRepository repo;
    @Inject EmailService email;
    @Inject MessageService messages;
    @Inject CurrentUser currentUser;
    @Inject RequestLocale requestLocale;

    /** Wire shape of a successful submit. The SPA only checks the status code. */
    public record ContactAccepted(String status) {}

    /**
     * Accept one message.
     *
     * @param forwardedFor {@code X-Forwarded-For} as set by Caddy in prod;
     *                     absent in local dev, where the throttle then keys on
     *                     a single shared bucket (acceptable: dev has one user)
     * @return 202 {@code {"status":"ACCEPTED"}}
     */
    @POST
    @Transactional
    public Response submit(@Valid ContactRequest req,
                           @HeaderParam("X-Forwarded-For") String forwardedFor) {
        // An absent body reaches the resource as null rather than as a
        // constraint violation, so it has to be rejected by hand.
        if (req == null) throw new IllegalArgumentException(messages.t("error.bodyRequired"));

        // Honeypot: answer exactly like a success, do nothing at all. Checked
        // before the throttle so a bot never even consumes a real budget.
        if (req.website() != null && !req.website().isBlank()) {
            LOG.debugf("Contact: honeypot tripped, dropping submission from %s", clientIp(forwardedFor));
            return accepted();
        }

        String ip = clientIp(forwardedFor);
        if (throttled(ip)) {
            throw rateLimited(messages.t("contact.tooManyRequests"));
        }

        String name = trimTo(req.name(), 120);
        String senderEmail = trimTo(req.email(), 200);
        String subject = trimTo(req.subject(), 200);
        String body = trimTo(req.message(), 4000);
        String lang = languageTag();

        ContactMessage msg = new ContactMessage();
        msg.setName(name);
        msg.setEmail(senderEmail);
        msg.setSubject(subject == null || subject.isEmpty() ? null : subject);
        msg.setMessage(body);
        msg.setUserUid(currentUser.uidOrNull());
        msg.setIp(ip);
        msg.setLocale(lang);
        repo.save(msg);

        notifyOwner(msg);

        return accepted();
    }

    private static Response accepted() {
        return Response.status(Response.Status.ACCEPTED)
                .entity(new ContactAccepted("ACCEPTED"))
                .build();
    }

    /* ───────────────────────────── mail ───────────────────────────── */

    /**
     * Mail the configured mailbox, with {@code Reply-To} set to the sender so
     * answering is one tap. Composed in {@link MessageService#DEFAULT_LOCALE},
     * not the caller's: the reader is the site owner, not the visitor — the
     * visitor's own language is recorded in the body instead, so a reply can
     * be written in it.
     *
     * <p>Never throws: {@code EmailService} already swallows its failures, and
     * anything this method could still trip over (a null field, a template
     * mistake) must not roll back the message that was just stored.
     */
    private void notifyOwner(ContactMessage msg) {
        try {
            String to = email.contactTo();
            if (to.isEmpty() || !email.isReady()) return;

            Locale hr = MessageService.DEFAULT_LOCALE;
            String headline = (msg.getSubject() == null || msg.getSubject().isBlank())
                    ? msg.getName()
                    : msg.getSubject();
            String mailSubject = "[bela-turniri] Kontakt: " + headline;

            String text = messages.t(hr, "contact.mail.name") + ": " + msg.getName() + "\n"
                    + messages.t(hr, "contact.mail.email") + ": " + msg.getEmail() + "\n"
                    + messages.t(hr, "contact.mail.subject") + ": "
                    + (msg.getSubject() == null ? "-" : msg.getSubject()) + "\n"
                    + messages.t(hr, "contact.mail.locale") + ": " + nz(msg.getLocale()) + "\n"
                    + messages.t(hr, "contact.mail.user") + ": " + nz(msg.getUserUid()) + "\n"
                    + messages.t(hr, "contact.mail.ip") + ": " + nz(msg.getIp()) + "\n\n"
                    + messages.t(hr, "contact.mail.message") + ":\n"
                    + msg.getMessage() + "\n";

            // Minimal, inline-styled markup — mail clients strip <style> and
            // external CSS, and this is an ops notification, not a newsletter.
            StringBuilder html = new StringBuilder(1024);
            html.append("<div style=\"font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;")
                    .append("font-size:14px;line-height:1.5;color:#111\">");
            html.append("<h2 style=\"margin:0 0 12px;font-size:16px\">")
                    .append(EmailService.escapeHtml(messages.t(hr, "contact.mail.heading")))
                    .append("</h2>");
            html.append("<table cellpadding=\"4\" cellspacing=\"0\" style=\"border-collapse:collapse\">");
            row(html, messages.t(hr, "contact.mail.name"), msg.getName());
            row(html, messages.t(hr, "contact.mail.email"), msg.getEmail());
            row(html, messages.t(hr, "contact.mail.subject"), msg.getSubject() == null ? "-" : msg.getSubject());
            row(html, messages.t(hr, "contact.mail.locale"), nz(msg.getLocale()));
            row(html, messages.t(hr, "contact.mail.user"), nz(msg.getUserUid()));
            row(html, messages.t(hr, "contact.mail.ip"), nz(msg.getIp()));
            html.append("</table>");
            html.append("<p style=\"margin:16px 0 4px;font-weight:600\">")
                    .append(EmailService.escapeHtml(messages.t(hr, "contact.mail.message")))
                    .append("</p>");
            // The body is the one genuinely free-form field: escape it, then
            // turn newlines into <br> so the mail reads like it was typed.
            html.append("<div style=\"white-space:pre-wrap;padding:12px;background:#f6f6f6;border-radius:8px\">")
                    .append(EmailService.escapeHtml(msg.getMessage()))
                    .append("</div>");
            html.append("</div>");

            email.send(to, mailSubject, html.toString(), text, msg.getEmail());
        } catch (Exception e) {
            LOG.warnf(e, "Contact: could not compose notification mail for %s", msg.getEmail());
        }
    }

    private static void row(StringBuilder sb, String label, String value) {
        sb.append("<tr><td style=\"color:#666;padding-right:12px\">")
                .append(EmailService.escapeHtml(label))
                .append("</td><td>")
                .append(EmailService.escapeHtml(value))
                .append("</td></tr>");
    }

    private static String nz(String s) {
        return (s == null || s.isBlank()) ? "-" : s;
    }

    /* ─────────────────────────── throttle ─────────────────────────── */

    /**
     * True when {@code ip} has already used its budget for this window. The
     * count is only incremented when the submission is allowed, so a rejected
     * caller does not push their own reset further away forever.
     */
    private static boolean throttled(String ip) {
        String key = (ip == null || ip.isBlank()) ? "unknown" : ip;
        Integer count = SUBMITS.getIfPresent(key);
        if (count != null && count >= MAX_PER_WINDOW) return true;
        // Re-put rather than mutate: it is the write that re-arms Caffeine's
        // expireAfterWrite clock, which is what makes the window slide.
        SUBMITS.put(key, count == null ? 1 : count + 1);
        return false;
    }

    /**
     * 429 in the standard {@link ApiError} envelope. Not {@code ApiCodes},
     * which emits a BARE code string for the handful of legacy endpoints the
     * SPA string-compares; this endpoint is new, so it gets the envelope every
     * other error already uses. Thrown rather than returned so it cannot be
     * mistaken for a success path — {@code GenericExceptionMapper} passes a
     * {@link WebApplicationException}'s response through untouched.
     */
    private static WebApplicationException rateLimited(String message) {
        return new WebApplicationException(
                Response.status(429)
                        .type(MediaType.APPLICATION_JSON)
                        .entity(ApiError.of("RATE_LIMITED", message))
                        .build());
    }

    /* ─────────────────────────── helpers ─────────────────────────── */

    /**
     * First hop of {@code X-Forwarded-For} — the original client as Caddy saw
     * it — or null when the header is absent (local dev talks straight to
     * Quarkus). Capped: the header is attacker-controlled and this value is
     * stored and logged.
     */
    private static String clientIp(String forwardedFor) {
        if (forwardedFor == null || forwardedFor.isBlank()) return null;
        int comma = forwardedFor.indexOf(',');
        String first = (comma >= 0 ? forwardedFor.substring(0, comma) : forwardedFor).trim();
        if (first.isEmpty()) return null;
        return first.length() > 64 ? first.substring(0, 64) : first;
    }

    /** The language of the request, as resolved by {@code LocaleRequestFilter}. */
    private String languageTag() {
        try {
            Locale locale = requestLocale.get();
            return locale == null ? MessageService.DEFAULT_LOCALE.getLanguage() : locale.getLanguage();
        } catch (RuntimeException e) {
            return MessageService.DEFAULT_LOCALE.getLanguage();
        }
    }

    /**
     * Bean validation has already rejected anything over the limit; this is
     * belt-and-braces so a column can never overflow if a constraint is
     * relaxed without the column following.
     */
    private static String trimTo(String s, int max) {
        if (s == null) return null;
        String t = s.trim();
        return t.length() <= max ? t : t.substring(0, max);
    }
}
