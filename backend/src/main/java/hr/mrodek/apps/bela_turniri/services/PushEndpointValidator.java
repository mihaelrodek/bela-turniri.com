package hr.mrodek.apps.bela_turniri.services;

import org.jboss.logging.Logger;

import java.net.URI;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Allowlist gate for Web Push endpoint URLs submitted by browsers.
 *
 * <p>The endpoint is an opaque URL the backend later POSTs to, so an
 * unvalidated value turns {@code POST /push/subscribe} into a
 * server-side request forgery primitive: anyone signed in could point us
 * at an internal host and have the push worker hit it on a schedule.
 * We therefore accept only https URLs whose host belongs to one of the
 * real browser push services.
 *
 * <p>Matching is a host-suffix match (so {@code *.push.apple.com} and
 * friends work) and literal IP hosts are rejected outright — a browser
 * vendor never hands out an IP-literal endpoint.
 */
public final class PushEndpointValidator {

    private PushEndpointValidator() {}

    private static final Logger LOG = Logger.getLogger(PushEndpointValidator.class);

    /**
     * Known push services. Entries starting with "." are suffix matches
     * (any sub-domain); the rest must match the host exactly.
     */
    private static final List<String> ALLOWED_HOSTS = List.of(
            "fcm.googleapis.com",
            "web.push.apple.com",
            // Mozilla autopush is `updates.push.services.mozilla.com` today,
            // but the suffix covers the regional/stage variants too.
            ".push.services.mozilla.com",
            ".notify.windows.com",
            ".push.apple.com",
            ".pushnotifications.googleapis.com"
    );

    /** IPv4 dotted-quad. IPv6 literals arrive bracketed and are caught separately. */
    private static final Pattern IPV4 = Pattern.compile("^\\d{1,3}(\\.\\d{1,3}){3}$");

    /**
     * Throws {@link IllegalArgumentException} (→ HTTP 400) unless the
     * endpoint is an https URL served by a known push service.
     *
     * <p>{@code rejectMessage} is passed in rather than held as a constant
     * here: this class is a static utility with no CDI, so it cannot inject
     * {@code MessageService}. The caller (a bean) resolves
     * {@code push.endpoint.unsupported} in the request's language and hands
     * the finished text over, keeping the 400 body localised.
     */
    public static void assertAllowed(String endpoint, String rejectMessage) {
        if (!isAllowed(endpoint)) {
            throw new IllegalArgumentException(rejectMessage);
        }
    }

    /**
     * Non-throwing form of {@link #assertAllowed(String)}.
     *
     * <p>Rejections are logged at WARN (host only — the full endpoint is a
     * bearer token) so that a browser vendor moving to a new push host shows
     * up as a burst of warnings instead of silently breaking notifications
     * for everyone on that browser.
     */
    public static boolean isAllowed(String endpoint) {
        String host = hostOf(endpoint, true);
        if (host != null) {
            for (String allowed : ALLOWED_HOSTS) {
                if (allowed.startsWith(".")) {
                    if (host.endsWith(allowed)) return true;
                } else if (host.equals(allowed)) {
                    return true;
                }
            }
        }
        LOG.warnf("Push endpoint rejected: host=%s", host == null ? "<unparseable>" : host);
        return false;
    }

    /**
     * Host of an endpoint URL, lowercased, or {@code null} when the URL is
     * unparseable. Used both for validation and for safe logging — we log
     * the host but never the full endpoint, which is itself a bearer token.
     */
    public static String hostOf(String endpoint) {
        return hostOf(endpoint, false);
    }

    private static String hostOf(String endpoint, boolean requireHttps) {
        if (endpoint == null || endpoint.isBlank()) return null;
        final URI uri;
        try {
            uri = URI.create(endpoint.trim());
        } catch (IllegalArgumentException e) {
            return null;
        }
        String scheme = uri.getScheme();
        if (requireHttps && (scheme == null || !scheme.equalsIgnoreCase("https"))) return null;
        String host = uri.getHost();
        if (host == null || host.isBlank()) return null;
        host = host.toLowerCase(Locale.ROOT);
        if (requireHttps && isIpLiteral(host)) return null;
        return host;
    }

    /** True for IPv4 dotted-quads and (bracketed) IPv6 literals. */
    private static boolean isIpLiteral(String host) {
        if (host.startsWith("[")) return true;      // URI.getHost keeps the brackets for IPv6
        if (host.indexOf(':') >= 0) return true;    // bare IPv6, defensive
        return IPV4.matcher(host).matches();
    }
}
