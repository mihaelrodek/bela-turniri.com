package hr.mrodek.apps.bela_turniri.services;

import io.quarkus.cache.CacheKey;
import io.quarkus.cache.CacheResult;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.function.Supplier;

/**
 * Caffeine-backed memoiser for the server-rendered SEO / link-preview pages
 * and the sitemap.
 *
 * <p>Why this exists at all: Caddy rewrites every crawler hit on {@code /},
 * {@code /turniri}, {@code /turniri/<slug>} and {@code /profil/<slug>} to the
 * matching {@code /api/preview/*} endpoint. Each of those rebuilds the whole
 * page from scratch — several queries plus a few kilobytes of string
 * concatenation — and crawlers hammer them in bursts (Googlebot re-crawling,
 * plus WhatsApp/Telegram/Slack unfurling the same shared link once per chat
 * member). The output is identical for every caller, so it is pure waste.
 *
 * <p>Why a memoiser rather than {@code @CacheResult} on the resource methods:
 * caching the {@code Response} object itself would hand the same mutable
 * instance to concurrent requests, and the response filters
 * ({@code SecurityHeadersFilter}, {@code RequestIdFilter}) write headers into
 * it. Only the immutable rendered body is cached here; every request still
 * builds its own fresh {@code Response} around it.
 *
 * <p>Why the {@link Supplier}: the render logic stays in the controller next
 * to the SEO comments that explain it, instead of being hoisted into a service
 * that would need every repository the controllers already hold. The
 * {@link CacheKey} annotation restricts the cache key to {@code key} — without
 * it the lambda (a fresh instance on every call) would be part of the key and
 * every lookup would miss.
 *
 * <p><b>Caller-identity safety:</b> every page memoised here is anonymous by
 * construction — the preview controllers inject no {@code JsonWebToken} /
 * {@code SecurityIdentity} and render nothing user-specific (profile previews
 * deliberately omit phone numbers for exactly this reason). Do not add a
 * caller-dependent field to a rendered page without removing it from the cache
 * first.
 *
 * <p>TTLs and sizes are configured in {@code application.properties} under
 * {@code quarkus.cache.caffeine."<name>"}.
 */
@ApplicationScoped
public class PreviewRenderService {

    /**
     * A rendered page plus the HTTP status it should be served with.
     *
     * @param status HTTP status (200, or 404 for the not-found page)
     * @param body   the fully rendered HTML
     */
    public record PreviewPage(int status, String body) {
        public static PreviewPage ok(String body) {
            return new PreviewPage(200, body);
        }

        public static PreviewPage notFound(String body) {
            return new PreviewPage(404, body);
        }
    }

    /**
     * Thrown out of a memoised supplier when the render produced a non-200
     * page (i.e. "not found"). Quarkus' cache interceptor propagates a failed
     * computation without storing it — {@code CaffeineCacheImpl} removes the
     * in-flight entry on any {@code Throwable} — so a dead link is never
     * memoised for the cache's 5-10 minute TTL. A tournament or profile that
     * appears a second later is therefore visible immediately.
     *
     * <p>Callers catch this via {@link #notFoundPageOf(Throwable)} and serve
     * the carried page with {@code Cache-Control: no-store}.
     */
    public static final class NotFoundSignal extends RuntimeException {
        private final transient PreviewPage page;

        NotFoundSignal(PreviewPage page) {
            // No message, no cause, no suppression, no stack trace: this is
            // control flow on a crawler-facing hot path, not an error.
            super(null, null, false, false);
            this.page = page;
        }

        public PreviewPage page() {
            return page;
        }
    }

    /**
     * Walk {@code t}'s cause chain for a {@link NotFoundSignal} and return the
     * page it carries, or {@code null} when this is a genuine failure that
     * must keep propagating.
     */
    public static PreviewPage notFoundPageOf(Throwable t) {
        for (Throwable c = t; c != null; c = c.getCause()) {
            if (c instanceof NotFoundSignal nf) return nf.page();
            if (c.getCause() == c) break;
        }
        return null;
    }

    /** Fail the computation (instead of caching it) when the page is not a 200. */
    private static PreviewPage okOrSignal(PreviewPage page) {
        if (page == null || page.status() != 200) {
            throw new NotFoundSignal(page != null ? page : PreviewPage.notFound(""));
        }
        return page;
    }

    /** Homepage and tournament-list previews. Key is the variant name. */
    @CacheResult(cacheName = "preview-home")
    public PreviewPage home(@CacheKey String key, Supplier<PreviewPage> render) {
        return okOrSignal(render.get());
    }

    /** Tournament preview. Key is the uuid-or-slug from the path. */
    @CacheResult(cacheName = "preview-tournament")
    public PreviewPage tournament(@CacheKey String key, Supplier<PreviewPage> render) {
        return okOrSignal(render.get());
    }

    /** Public profile preview. Key is the profile slug from the path. */
    @CacheResult(cacheName = "preview-profile")
    public PreviewPage profile(@CacheKey String key, Supplier<PreviewPage> render) {
        return okOrSignal(render.get());
    }

    /** sitemap.xml. Key is the public base URL it was rendered against. */
    @CacheResult(cacheName = "sitemap")
    public String sitemap(@CacheKey String key, Supplier<String> render) {
        return render.get();
    }
}
