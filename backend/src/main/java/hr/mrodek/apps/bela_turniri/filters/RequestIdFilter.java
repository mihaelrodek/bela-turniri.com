package hr.mrodek.apps.bela_turniri.filters;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.container.ContainerResponseContext;
import jakarta.ws.rs.container.ContainerResponseFilter;
import jakarta.ws.rs.container.PreMatching;
import jakarta.ws.rs.ext.Provider;
import org.jboss.logging.MDC;

import java.security.SecureRandom;

/**
 * Gives every request a correlation id and puts it where both the logs and
 * the caller can see it.
 *
 * <p>Why: with several controllers, a handful of services and a SPA that
 * auto-toasts every failure, "the app said something went wrong at 19:42"
 * is the whole bug report we usually get. A request id turns that into a
 * single grep. Three places carry it:
 *
 * <ul>
 *   <li>the {@code X-Request-Id} <b>response</b> header, so the id is visible
 *       in the browser devtools network tab and can be pasted into a bug
 *       report;</li>
 *   <li>the {@code requestId} MDC key, rendered by
 *       {@code quarkus.log.console.format} in front of every log line
 *       produced while handling the request;</li>
 *   <li>the prod access log, via {@code %&#123;o,X-Request-Id&#125;} in
 *       {@code quarkus.http.access-log.pattern}.</li>
 * </ul>
 *
 * <p>An inbound {@code X-Request-Id} wins over a generated one: Caddy (or any
 * future edge/CDN) may already stamp one, and re-generating would break the
 * chain between the proxy's access log and ours. Inbound values are sanitised
 * — they are attacker-controlled and end up in log lines, so anything that
 * isn't a short alphanumeric token is discarded rather than trusted.
 *
 * <p>{@code @PreMatching} so the id exists even for requests that never reach
 * a resource method (unknown path → 404, bad content type → 415); those are
 * exactly the ones worth correlating.
 */
@Provider
@PreMatching
public class RequestIdFilter implements ContainerRequestFilter, ContainerResponseFilter {

    public static final String HEADER = "X-Request-Id";
    public static final String MDC_KEY = "requestId";

    /** 12 hex chars ≈ 48 bits — plenty to disambiguate within a log retention window, and short enough to read aloud. */
    private static final int ID_BYTES = 6;

    /** Cap on an inbound id we are willing to echo and log. */
    private static final int MAX_INBOUND_LENGTH = 64;

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final char[] HEX = "0123456789abcdef".toCharArray();

    @Override
    public void filter(ContainerRequestContext req) {
        String id = sanitise(req.getHeaderString(HEADER));
        if (id == null) id = generate();
        // Stash on the request so the response filter doesn't have to re-read
        // (and re-sanitise) the inbound header.
        req.setProperty(MDC_KEY, id);
        MDC.put(MDC_KEY, id);
    }

    @Override
    public void filter(ContainerRequestContext req, ContainerResponseContext res) {
        Object id = req.getProperty(MDC_KEY);
        if (id != null && !res.getHeaders().containsKey(HEADER)) {
            res.getHeaders().putSingle(HEADER, id);
        }
        // Quarkus backs org.jboss.logging.MDC with the per-request Vert.x
        // duplicated context, so this is belt-and-braces rather than strictly
        // required — but it keeps the key from surviving onto a pooled worker
        // thread in any execution model that does not isolate the context.
        MDC.remove(MDC_KEY);
    }

    /**
     * Accept an inbound id only when it is a short, boring token. Anything
     * else (newlines that would forge extra log lines, control characters,
     * megabyte-long headers) is dropped and replaced by a generated id.
     */
    private static String sanitise(String raw) {
        if (raw == null) return null;
        String trimmed = raw.trim();
        if (trimmed.isEmpty() || trimmed.length() > MAX_INBOUND_LENGTH) return null;
        for (int i = 0; i < trimmed.length(); i++) {
            char c = trimmed.charAt(i);
            boolean ok = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
                    || (c >= '0' && c <= '9') || c == '-' || c == '_';
            if (!ok) return null;
        }
        return trimmed;
    }

    private static String generate() {
        byte[] buf = new byte[ID_BYTES];
        RANDOM.nextBytes(buf);
        char[] out = new char[ID_BYTES * 2];
        for (int i = 0; i < ID_BYTES; i++) {
            out[i * 2] = HEX[(buf[i] >> 4) & 0xF];
            out[i * 2 + 1] = HEX[buf[i] & 0xF];
        }
        return new String(out);
    }
}
