package hr.mrodek.apps.bela_turniri.services;

import io.quarkus.cache.CacheKey;
import io.quarkus.cache.CacheResult;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.function.Supplier;

/**
 * Caffeine-backed memoiser for the rendered subscribable calendar feed
 * ({@code /api/calendar/tournaments.ics}).
 *
 * <p>Same wiring as {@link PreviewRenderService} and for the same two
 * reasons:
 * <ul>
 *   <li>{@code @CacheResult} only fires when the method is invoked through
 *       the CDI proxy — calling it on {@code this} from inside the same
 *       bean silently skips caching, so the controller must inject this
 *       service rather than annotate its own method.</li>
 *   <li>The cache stores the immutable rendered {@code String} only, never
 *       a JAX-RS {@code Response} — response filters
 *       ({@code SecurityHeadersFilter}, {@code RequestIdFilter}) write
 *       headers into a {@code Response} instance per request, so caching
 *       one would leak headers/state across concurrent callers. The
 *       controller builds a fresh {@code Response} (with a freshly computed
 *       {@code ETag}) around the cached body on every request.</li>
 * </ul>
 *
 * <p>Calendar clients (Google Calendar, Apple Calendar) poll this URL on
 * their own schedule, typically every few hours — a 15-minute TTL (see
 * {@code quarkus.cache.caffeine."calendar-feed"} in
 * {@code application.properties}) is more than fast enough for a newly
 * created tournament to show up, while sparing the DB from being hit on
 * every poll from every subscriber.
 *
 * <p>Anonymous by construction, like the preview pages: the feed lists only
 * public tournament fields, no caller-dependent content.
 */
@ApplicationScoped
public class CalendarFeedRenderService {

    /** Rendered VCALENDAR text. Key is the public base URL the feed was rendered against. */
    @CacheResult(cacheName = "calendar-feed")
    public String feed(@CacheKey String key, Supplier<String> render) {
        return render.get();
    }
}
