package hr.mrodek.apps.bela_turniri.filters;

import hr.mrodek.apps.bela_turniri.services.MessageService;
import hr.mrodek.apps.bela_turniri.services.RequestLocale;
import jakarta.inject.Inject;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.container.PreMatching;
import jakarta.ws.rs.ext.Provider;

import java.util.Locale;

/**
 * Resolves the language of every incoming request into the request-scoped
 * {@link RequestLocale}, which {@link MessageService#t(String, Object...)}
 * then uses for every lookup made while handling it — so error envelopes and
 * validation text come back in the caller's language with no change to any
 * individual controller.
 *
 * <p>Precedence:
 * <ol>
 *   <li>{@code X-Locale} — the explicit choice the SPA sends for whatever the
 *       user picked in the navbar switcher (see {@code frontend/src/api/http.ts}).
 *       This is the authoritative signal; it already reflects the user's saved
 *       profile preference.</li>
 *   <li>{@code Accept-Language} — for non-SPA callers (a shared link opened in
 *       a foreign browser, curl, a future public API consumer). Quality values
 *       are ignored; the header's own order is used, which is what browsers
 *       send anyway.</li>
 *   <li>{@link MessageService#DEFAULT_LOCALE} (Croatian).</li>
 * </ol>
 *
 * <p>Only languages we actually ship a bundle for
 * ({@link MessageService#SUPPORTED_LANGUAGES}) are accepted; anything else
 * falls through to the next step. Resolving to a real {@link Locale} here
 * rather than only picking a bundle also makes {@code MessageFormat}'s
 * locale-dependent number/date formatting correct.
 *
 * <p>{@code @PreMatching} — same reasoning as {@link RequestIdFilter}: the
 * locale must also be set for requests that never reach a resource method
 * (unknown path → 404, wrong content type → 415), because those produce
 * user-facing envelopes too.
 */
@Provider
@PreMatching
public class LocaleRequestFilter implements ContainerRequestFilter {

    public static final String HEADER = "X-Locale";

    private static final String ACCEPT_LANGUAGE = "Accept-Language";

    /** Defensive cap — both headers are attacker-controlled. */
    private static final int MAX_HEADER_LENGTH = 200;

    @Inject RequestLocale requestLocale;

    @Override
    public void filter(ContainerRequestContext ctx) {
        Locale resolved = fromExplicitHeader(ctx.getHeaderString(HEADER));
        if (resolved == null) resolved = fromAcceptLanguage(ctx.getHeaderString(ACCEPT_LANGUAGE));
        requestLocale.set(resolved != null ? resolved : MessageService.DEFAULT_LOCALE);
    }

    /** {@code X-Locale: sl} — a bare language tag, nothing else. */
    private static Locale fromExplicitHeader(String header) {
        if (header == null || header.isBlank() || header.length() > MAX_HEADER_LENGTH) return null;
        return toSupportedLocale(header.trim());
    }

    /** {@code Accept-Language: sl-SI,sl;q=0.9,en;q=0.8} — first supported base
     *  subtag wins. */
    private static Locale fromAcceptLanguage(String header) {
        if (header == null || header.isBlank() || header.length() > MAX_HEADER_LENGTH) return null;
        for (String part : header.split(",")) {
            String tag = part.trim();
            int semi = tag.indexOf(';');
            if (semi >= 0) tag = tag.substring(0, semi).trim();
            Locale hit = toSupportedLocale(tag);
            if (hit != null) return hit;
        }
        return null;
    }

    /** "sl-SI" / "SL" / "sl" → the "sl" locale, when supported; else null. */
    private static Locale toSupportedLocale(String tag) {
        if (tag.isEmpty()) return null;
        int dash = tag.indexOf('-');
        String base = (dash >= 0 ? tag.substring(0, dash) : tag).toLowerCase(Locale.ROOT);
        return MessageService.isSupported(base) ? Locale.forLanguageTag(base) : null;
    }
}
