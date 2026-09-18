package hr.mrodek.apps.bela_turniri.services;

import hr.mrodek.apps.bela_turniri.dtos.TournamentCardDto;
import hr.mrodek.apps.bela_turniri.dtos.TournamentDetailsResponse;
import hr.mrodek.apps.bela_turniri.mappers.TournamentMapper;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.repository.PairsRepository;
import hr.mrodek.apps.bela_turniri.repository.TournamentsRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotFoundException;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * "SSR-lite" data seed for the SPA's first screen.
 *
 * <p>The problem it solves: on a cold load the browser parses
 * {@code index.html}, downloads the JS bundle, boots React, mounts
 * {@code TournamentsPage} and only THEN issues three REST calls. Everything
 * the user came for is behind that waterfall. The seed cuts the tail off it:
 * an inline classic {@code <script>} at the top of {@code index.html} fires
 * {@code GET /api/seed?path=<location.pathname>} in the very first
 * milliseconds, in parallel with the module graph, and {@code main.tsx} drops
 * the answer straight into the react-query cache before the first render.
 *
 * <p><b>Why JSON and not server-rendered HTML.</b> The backend container does
 * not have the frontend {@code dist} — Caddy serves the static build and only
 * proxies {@code /api/*} here (see {@code Caddyfile}), so a
 * "{@code GET /api/shell} returns a filled-in index.html" variant would need
 * the two images to share a volume and would couple every frontend deploy to
 * the backend's file layout. A JSON seed needs neither: the shell stays a
 * plain static file, the seed is one more cacheable public read, and if it
 * fails, times out, or the endpoint doesn't exist at all, the SPA simply
 * fetches as it always did.
 *
 * <p><b>Caller-independence is a load-bearing property here.</b> The response
 * is computed with {@code blockerUid = null} — i.e. exactly the anonymous
 * variant — and never reads {@code CurrentUser}. That is what makes it safe
 * to stamp {@code Cache-Control: public}. The consequence is that a signed-in
 * user who has blocked an organiser could see that organiser's tournament in
 * the seeded list; the client therefore marks every seeded list entry
 * invalidated on hydration, so the real, block-filtered request still runs on
 * mount and corrects the screen. The seed buys the first paint, not the
 * authoritative answer.
 *
 * <p><b>Caching.</b> A hand-rolled 20-second memo rather than
 * {@code quarkus-cache}: a Caffeine cache would need its own
 * {@code quarkus.cache.caffeine."shell-seed".*} block in
 * {@code application.properties}, and the map here holds at most a few
 * hundred small DTO graphs with the same TTL the HTTP response advertises.
 * 404s are never cached — a slug that appears a second after a miss must not
 * stay missing for 20 s.
 */
@ApplicationScoped
public class ShellRenderService {

    /** How long a computed seed may be replayed. Mirrors the {@code max-age}
     *  the controller stamps, so the in-process memo and the browser cache
     *  expire together. */
    static final long TTL_MS = 20_000L;

    /** Hard cap on memo entries. One per seeded path — the list plus one per
     *  tournament slug that is currently being opened — so this only bites on
     *  a crawler walking every tournament, where dropping the whole map is
     *  cheaper and simpler than an LRU. */
    private static final int MAX_ENTRIES = 300;

    /**
     * Page size of the "Završeni turniri" preview on the first screen.
     *
     * <p>Must stay equal to {@code FINISHED_PREVIEW_LIMIT} in
     * {@code frontend/src/pages/TournamentsPage.tsx}: the limit is part of the
     * react-query key ({@code qk.tournaments({status:"finished", limit})}), so
     * a mismatch doesn't break anything, it just makes that half of the seed
     * land under a key nobody reads.
     */
    public static final int FINISHED_PREVIEW_LIMIT = 6;

    @Inject TournamentsRepository tournamentsRepo;
    @Inject PairsRepository pairRepo;
    @Inject TournamentMapper tournamentMapper;

    /**
     * The seed payload.
     *
     * <p>Deliberately NOT a generic {@code [{key, data}]} list: the client
     * rebuilds the react-query keys from its own {@code qk} registry, so the
     * server never gets to name a cache key. Fields are null / empty for the
     * shape that doesn't apply to the requested path.
     *
     * @param generatedAt epoch millis the payload was computed; the client
     *                    passes it as react-query's {@code updatedAt} so a
     *                    freshER localStorage snapshot still wins on hydration
     * @param path        the normalised path the seed answers for
     * @param upcoming    {@code GET /tournaments?status=upcoming}, verbatim
     * @param finished    {@code GET /tournaments?status=finished&offset=0&limit=<finishedLimit>}
     * @param finishedLimit the limit used, echoed so the client can build the
     *                    key without duplicating the constant
     * @param finishedTotal {@code GET /tournaments/count?status=finished}
     * @param detailsKey  the raw URL segment the detail seed is keyed by —
     *                    uuid or slug, whichever the visitor's URL carried,
     *                    because that is what ends up in {@code useParams}
     * @param details     {@code GET /tournaments/{idOrSlug}}, verbatim
     */
    public record SeedPayload(
            long generatedAt,
            String path,
            List<TournamentCardDto> upcoming,
            List<TournamentCardDto> finished,
            int finishedLimit,
            long finishedTotal,
            String detailsKey,
            TournamentDetailsResponse details
    ) {}

    private record Memo(long at, SeedPayload payload) {}

    private final ConcurrentHashMap<String, Memo> memo = new ConcurrentHashMap<>();

    /**
     * Normalise an SPA pathname to the seed variant that serves it, or return
     * {@code null} when nothing is seeded for it.
     *
     * <ul>
     *   <li>{@code "/"} and {@code "/turniri"} → {@code "/turniri"} (the root
     *       route is a {@code <Navigate to="/turniri">}, so a cold load on
     *       {@code /} lands on the listing too)</li>
     *   <li>{@code "/turniri/<slug>"} and {@code "/turniri/<slug>/<section>"}
     *       → {@code "/turniri/<slug>"} — the section is a tab within the same
     *       page and shares its data</li>
     *   <li>{@code "/turniri/novi"} is the create wizard, not a tournament</li>
     * </ul>
     */
    public static String normalise(String rawPath) {
        if (rawPath == null) return null;
        String p = rawPath.trim();
        if (p.isEmpty()) return null;
        if (!p.startsWith("/")) return null;
        // Drop a query string / fragment if the client sent the whole URL.
        int cut = p.indexOf('?');
        if (cut >= 0) p = p.substring(0, cut);
        cut = p.indexOf('#');
        if (cut >= 0) p = p.substring(0, cut);
        while (p.length() > 1 && p.endsWith("/")) p = p.substring(0, p.length() - 1);

        if ("/".equals(p) || "/turniri".equals(p)) return "/turniri";
        if (!p.startsWith("/turniri/")) return null;

        String rest = p.substring("/turniri/".length());
        int slash = rest.indexOf('/');
        String segment = slash >= 0 ? rest.substring(0, slash) : rest;
        if (segment.isEmpty() || "novi".equals(segment)) return null;
        // A uuid-or-slug segment, nothing exotic: the repository looks it up
        // verbatim, and refusing the rest keeps the memo key space bounded.
        if (segment.length() > 200 || !segment.matches("[A-Za-z0-9._~-]+")) return null;
        return "/turniri/" + segment;
    }

    /**
     * Build (or replay) the seed for an SPA path.
     *
     * @throws BadRequestException when the path has no seed variant
     * @throws NotFoundException   when a detail path names a tournament that
     *                             doesn't exist (or is soft-deleted)
     */
    public SeedPayload seedFor(String rawPath) {
        String path = normalise(rawPath);
        if (path == null) throw new BadRequestException("UNSEEDED_PATH");

        Memo hit = memo.get(path);
        long now = System.currentTimeMillis();
        if (hit != null && now - hit.at() < TTL_MS) return hit.payload();

        SeedPayload fresh = "/turniri".equals(path) ? buildListing(now) : buildDetails(path, now);

        if (memo.size() >= MAX_ENTRIES) memo.clear();
        memo.put(path, new Memo(now, fresh));
        return fresh;
    }

    /** The three queries {@code TournamentsPage} issues on mount. */
    private SeedPayload buildListing(long now) {
        List<Tournaments> upcoming = tournamentsRepo.findNotFinishedOrderByStartAtAsc(null);
        List<Tournaments> finished = tournamentsRepo.findFinishedPaged(0, FINISHED_PREVIEW_LIMIT, null, null);
        long finishedTotal = tournamentsRepo.countFinished(null, null);

        return new SeedPayload(
                now,
                "/turniri",
                toCards(upcoming),
                toCards(finished),
                FINISHED_PREVIEW_LIMIT,
                finishedTotal,
                null,
                null
        );
    }

    /** The one query {@code useTournamentData} issues for {@code qk.tournamentDetails}. */
    private SeedPayload buildDetails(String path, long now) {
        String idOrSlug = path.substring("/turniri/".length());
        Tournaments t = tournamentsRepo.findByUuidOrSlug(idOrSlug)
                // Not cached — see the class comment.
                .orElseThrow(() -> new NotFoundException("TOURNAMENT_NOT_FOUND"));
        return new SeedPayload(
                now,
                path,
                List.of(),
                List.of(),
                FINISHED_PREVIEW_LIMIT,
                0L,
                idOrSlug,
                tournamentMapper.toDetails(t)
        );
    }

    /**
     * Same two steps {@code TournamentController#list} takes: one batched
     * pair-count query for the whole page, then the mapper. Going through the
     * same mapper is the point — the seed has to be byte-identical to what the
     * REST call would have returned, or the client would paint one shape and
     * then flicker into another.
     */
    private List<TournamentCardDto> toCards(List<Tournaments> items) {
        if (items.isEmpty()) return List.of();
        List<Long> ids = items.stream().map(Tournaments::getId).toList();
        Map<Long, Long> counts = pairRepo.countByTournamentIds(ids).stream()
                .collect(Collectors.toMap(r -> (Long) r[0], r -> (Long) r[1]));
        return tournamentMapper.toCardList(items, Collections.unmodifiableMap(counts));
    }

    /** Test hook — drops the memo so a fixture written mid-test is visible. */
    public void clearCache() {
        memo.clear();
    }
}
