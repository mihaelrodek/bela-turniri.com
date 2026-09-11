package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.repository.TournamentsRepository;
import hr.mrodek.apps.bela_turniri.services.PreviewHtml;
import hr.mrodek.apps.bela_turniri.services.PreviewRenderService;
import hr.mrodek.apps.bela_turniri.services.PreviewRenderService.PreviewPage;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

/**
 * Server-rendered preview pages for the two highest-traffic SEO routes:
 * the homepage ({@code /}) and the tournament list ({@code /turniri}).
 * Companion to {@link TournamentPreviewController} and
 * {@link ProfilePreviewController}; same Caddy UA-rewrite pattern.
 *
 * <p>Why these exist:
 *   - The SPA at {@code /} ships with an empty {@code <div id="root">};
 *     Googlebot does run JS, but for new domains its rendering budget is
 *     small and the queue can be days-to-weeks long. Until the SPA is
 *     pre-rendered at build time (or moved to SSR), this is the only
 *     way Googlebot sees real content at {@code /} and {@code /turniri}.
 *   - These two URLs are also where the ranking-relevant queries land
 *     ("bela turniri", "bela turniri hrvatska", "bela turniri zagreb"),
 *     so they have to outrank the SPA's blank HTML for the site to
 *     surface in SERPs at all.
 *
 * <p>Routing:
 *   - {@code GET /api/preview/home}  ← Caddy rewrites {@code /} for bots
 *   - {@code GET /api/preview/tournaments-list}  ← Caddy rewrites
 *     {@code /turniri} (and its English 301 alias {@code /tournaments})
 *     for bots
 *
 * <p>The {@code -list} suffix on the second route is deliberate — the
 * existing {@link TournamentPreviewController} already owns
 * {@code /api/preview/tournaments/{idOrSlug}}, and a second resource at
 * the same root path would collide on JAX-RS path matching.
 */
@Path("/preview")
public class HomePreviewController {

    @Inject
    TournamentsRepository tournamentsRepo;

    @Inject
    PreviewRenderService previewCache;

    @ConfigProperty(name = "app.public-base-url", defaultValue = "https://bela-turniri.com")
    String publicBaseUrl;

    /** Croatian-localised long format for tournament dates in the list. */
    private static final DateTimeFormatter HR_DATE =
            DateTimeFormatter.ofPattern("EEEE, d. MMMM yyyy. 'u' HH:mm",
                    Locale.forLanguageTag("hr-HR"));

    /**
     * Max upcoming + finished tournaments to render in each list. Caps
     * exist for two reasons: keep the payload small for crawlers
     * (Googlebot will drop oversized pages), and avoid rendering a
     * thousand-row table which dilutes the on-page topical focus.
     */
    private static final int UPCOMING_LIMIT = 30;
    private static final int FINISHED_LIMIT = 30;

    /**
     * The site-level {@code og:image}: {@code frontend/public/bela-turniri-og-card.png},
     * a purpose-built 1200x630 PNG (1.91:1 — the ratio Facebook/WhatsApp/
     * Slack lay a link-preview card out for). Deliberately NOT the square
     * {@code bela-turniri-symbol.png} used elsewhere for the favicon/PWA
     * icons/Organization logo — a 1200x1200 square gets cropped badly by
     * these crawlers instead of showing the whole mark. A static checked-in
     * asset (same pattern as the icon files below) rather than a config
     * property: it always exists, so there is no "unset" fallback branch to
     * maintain, and it's a fixed size we can declare exactly here.
     *
     * <p>Shared with {@link hr.mrodek.apps.bela_turniri.controller.ProfilePreviewController}'s
     * no-avatar fallback — see {@link PreviewHtml#DEFAULT_OG_IMAGE_FILENAME}.
     */
    private static final String OG_IMAGE_FILENAME = PreviewHtml.DEFAULT_OG_IMAGE_FILENAME;
    private static final int OG_IMAGE_WIDTH = PreviewHtml.DEFAULT_OG_IMAGE_WIDTH;
    private static final int OG_IMAGE_HEIGHT = PreviewHtml.DEFAULT_OG_IMAGE_HEIGHT;

    /**
     * Twitter renders {@code summary_large_image} only when the image is at
     * least 300x157 and it recommends >=600px on the short edge; below that
     * the card silently degrades to a broken-looking crop, so we downgrade to
     * the small {@code summary} card ourselves.
     */
    private static final String TWITTER_CARD =
            OG_IMAGE_WIDTH >= 600 ? "summary_large_image" : "summary";

    @GET
    @Path("/home")
    @Produces("text/html; charset=UTF-8")
    public Response home() {
        // The whole fetch+render runs inside the memoised supplier so a cache
        // hit costs zero queries, not just zero string building.
        PreviewPage page = previewCache.home("home", () -> {
            List<Tournaments> upcoming = tournamentsRepo
                    .findUpcomingPaged(OffsetDateTime.now(), 0, UPCOMING_LIMIT);
            return PreviewPage.ok(renderHome(upcoming));
        });
        return preview(page);
    }

    @GET
    @Path("/tournaments-list")
    @Produces("text/html; charset=UTF-8")
    public Response tournamentsList() {
        PreviewPage page = previewCache.home("tournaments-list", () -> {
            List<Tournaments> upcoming = tournamentsRepo
                    .findUpcomingPaged(OffsetDateTime.now(), 0, UPCOMING_LIMIT);
            List<Tournaments> finished = tournamentsRepo.findFinishedPaged(0, FINISHED_LIMIT);
            return PreviewPage.ok(renderTournamentsList(upcoming, finished));
        });
        return preview(page);
    }

    /** Wrap a memoised page in a fresh Response — see PreviewRenderService for why it is never the Response that gets cached. */
    private static Response preview(PreviewPage page) {
        return Response.status(page.status())
                .entity(page.body())
                // Both pages here always render 200; the guard is here so a
                // future non-200 variant is never held by a CDN for minutes.
                .header("Cache-Control", page.status() == 200 ? PreviewHtml.PREVIEW_CACHE_CONTROL : "no-store")
                .build();
    }

    /* ───────────────────── rendering ───────────────────── */

    /**
     * Homepage HTML. Goals:
     *   - One H1 for "Bela turniri" (the brand) — primary ranking target.
     *   - A short intro paragraph in real HR sentences so Google can
     *     summarise the site for SERP descriptions.
     *   - A short list of upcoming tournaments — gives Googlebot internal
     *     links to discover detail pages (which themselves have rich
     *     bodies via {@link TournamentPreviewController}).
     *   - Nav links to /turniri, /karta, /kalendar so PageRank flows
     *     to the secondary indexable pages.
     */
    private String renderHome(List<Tournaments> upcoming) {
        StringBuilder sb = new StringBuilder(4096);
        // The site NAME leads the homepage title, with no domain suffix:
        // Google derives the SERP site name from (in order) WebSite JSON-LD,
        // og:site_name and the homepage <title>, and every one of those used
        // to say "bela-turniri.com" somewhere — which is why the result read
        // as the bare domain (2026-09-10). All three now say "Bela Turniri".
        appendHeadOpen(sb,
                "Bela Turniri — turniri u beli, online bela i zapisnik",
                "Platforma za vođenje i praćenje turnira u beli. Kreiraj turnir, "
                        + "prikupi prijave parova i objavi rezultate, igraj belu "
                        + "online i vodi zapisnik partije u bloku.",
                "https://bela-turniri.com/");
        // Site-wide WebSite + Organization JSON-LD, mirrored from the static
        // index.html. NOT actually redundant with it: Caddy's bot UA rewrite
        // (see @home_for_bot in Caddyfile) sends every crawler this list
        // matches — including Googlebot itself — to THIS endpoint instead of
        // index.html for path "/". So Googlebot never sees index.html's copy
        // for the homepage; without emitting it here too, the WebSite
        // SearchAction (the prerequisite for a sitelinks search box) and the
        // Organization record would never reach the crawler they're for.
        appendSiteJsonLd(sb);
        sb.append("</head>\n<body>\n<article>\n");
        sb.append("<h1>Bela Turniri — turniri u beli u Hrvatskoj</h1>\n");
        sb.append("<p>Bela Turniri je platforma za vođenje i praćenje turnira u "
                + "beli u Hrvatskoj i regiji. Organizatori kreiraju turnire, "
                + "prikupljaju prijave parova i objavljuju rezultate, a igrači "
                + "prate raspored, povijest nastupa i pridružuju se novim "
                + "turnirima. Uz to možeš igrati belu online protiv igrača i "
                + "botova te voditi zapisnik partije u bloku, sam ili povezan "
                + "sa stolom na turniru.</p>\n");

        if (!upcoming.isEmpty()) {
            sb.append("<section>\n<h2>Nadolazeći Bela turniri</h2>\n<ul>\n");
            for (Tournaments t : upcoming) {
                appendTournamentListItem(sb, t);
            }
            sb.append("</ul>\n</section>\n");
        } else {
            // Empty-state copy is still indexable — the H2 itself helps
            // Google understand the page's topic even when there are no
            // upcoming tournaments to list.
            sb.append("<section>\n<h2>Nadolazeći Bela turniri</h2>\n");
            sb.append("<p>Trenutno nema najavljenih turnira. "
                    + "Pogledajte završene turnire ili kreirajte novi.</p>\n");
            sb.append("</section>\n");
        }

        // Site-wide nav so Googlebot can crawl secondary pages from here.
        // All URLs use Croatian slugs — they're the canonical paths now.
        String base = baseUrl();
        sb.append("<section>\n<h2>Istraži</h2>\n<ul>\n");
        sb.append("<li><a href=\"").append(escapeAttr(base)).append("/turniri\">Svi turniri</a></li>\n");
        sb.append("<li><a href=\"").append(escapeAttr(base)).append("/kalendar\">Kalendar turnira</a></li>\n");
        sb.append("<li><a href=\"").append(escapeAttr(base)).append("/karta\">Karta turnira</a></li>\n");
        sb.append("</ul>\n</section>\n");

        sb.append("<hr>\n<p><a href=\"").append(escapeAttr(base)).append("/\">"
                + "Otvori aplikaciju bela-turniri.com</a></p>\n");
        sb.append("</article>\n</body>\n</html>\n");
        return sb.toString();
    }

    /**
     * Tournament list HTML. Same shape as the homepage but with a longer
     * list and both upcoming + finished sections. Finished tournaments
     * are valuable for SEO ("bela turnir {grad} 2024 rezultati") so we
     * surface them prominently here even though the SPA paginates them.
     */
    private String renderTournamentsList(List<Tournaments> upcoming, List<Tournaments> finished) {
        StringBuilder sb = new StringBuilder(8192);
        appendHeadOpen(sb,
                "Popis turnira u beli — Bela Turniri",
                "Popis svih nadolazećih i odigranih Bela turnira u Hrvatskoj. "
                        + "Pretraži po lokaciji, datumu i cijeni.",
                "https://bela-turniri.com/turniri");
        sb.append("</head>\n<body>\n<article>\n");
        sb.append("<h1>Bela turniri</h1>\n");
        sb.append("<p>Popis svih turnira u bazi bela-turniri.com. "
                + "Klikom na pojedini turnir otvarate stranicu sa svim detaljima, "
                + "popisom prijavljenih parova i rasporedom kola.</p>\n");

        if (!upcoming.isEmpty()) {
            sb.append("<section>\n<h2>Nadolazeći turniri</h2>\n<ul>\n");
            for (Tournaments t : upcoming) appendTournamentListItem(sb, t);
            sb.append("</ul>\n</section>\n");
        }

        if (!finished.isEmpty()) {
            sb.append("<section>\n<h2>Završeni turniri</h2>\n<ul>\n");
            for (Tournaments t : finished) appendTournamentListItem(sb, t);
            sb.append("</ul>\n</section>\n");
        }

        sb.append("<hr>\n<p><a href=\"").append(escapeAttr(baseUrl())).append("/turniri\">"
                + "Otvori popis turnira u aplikaciji</a></p>\n");
        sb.append("</article>\n</body>\n</html>\n");
        return sb.toString();
    }

    /**
     * One row in a tournament list. Uses the canonical pretty slug when
     * available so the internal links Google follows match the URLs in
     * the sitemap.
     */
    private void appendTournamentListItem(StringBuilder sb, Tournaments t) {
        String href = baseUrl() + "/turniri/"
                + (t.getSlug() != null && !t.getSlug().isBlank()
                        ? t.getSlug() : t.getUuid().toString());
        sb.append("<li><a href=\"").append(escapeAttr(href)).append("\">");
        sb.append(escapeHtml(t.getName() != null ? t.getName() : "Bela turnir"));
        sb.append("</a>");
        // Build a one-line summary so the row is meaningful even without
        // clicking through. The crawler scores list items higher when the
        // anchor text is followed by descriptive context.
        StringBuilder summary = new StringBuilder();
        if (t.getLocation() != null && !t.getLocation().isBlank()) {
            summary.append(t.getLocation().trim());
        }
        if (t.getStartAt() != null) {
            if (summary.length() > 0) summary.append(" • ");
            summary.append(HR_DATE.format(t.getStartAt()));
        }
        if (summary.length() > 0) {
            sb.append(" — ").append(escapeHtml(summary.toString()));
        }
        sb.append("</li>\n");
    }

    /**
     * Shared {@code <head>} opener — title, description, canonical, and
     * basic OG tags. Stops short of {@code </head>} so callers can append
     * route-specific extras before closing it.
     */
    private void appendHeadOpen(StringBuilder sb, String title, String description, String canonical) {
        sb.append("<!doctype html>\n<html lang=\"hr\">\n<head>\n");
        sb.append("<meta charset=\"UTF-8\">\n");
        sb.append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n");
        sb.append("<title>").append(escapeHtml(title)).append("</title>\n");
        sb.append("<meta name=\"description\" content=\"")
                .append(escapeAttr(description)).append("\">\n");
        sb.append("<link rel=\"canonical\" href=\"")
                .append(escapeAttr(canonical)).append("\">\n");
        sb.append("<meta property=\"og:type\" content=\"website\">\n");
        sb.append("<meta property=\"og:locale\" content=\"hr_HR\">\n");
        // Site name, not the domain — one of the three signals Google reads
        // for the SERP site name (see renderHome).
        sb.append("<meta property=\"og:site_name\" content=\"Bela Turniri\">\n");
        sb.append("<meta property=\"og:title\" content=\"")
                .append(escapeAttr(title)).append("\">\n");
        sb.append("<meta property=\"og:description\" content=\"")
                .append(escapeAttr(description)).append("\">\n");
        sb.append("<meta property=\"og:url\" content=\"")
                .append(escapeAttr(canonical)).append("\">\n");
        appendIconLinks(sb);
        appendOgImage(sb);
    }

    /**
     * Absolute favicon / touch-icon links.
     *
     * <p>Crawlers fetch this HTML at {@code /api/preview/*} (Caddy rewrites
     * the pretty URL), so a relative {@code href="/icon-192.png"} would still
     * resolve — but Google's favicon crawler and several chat clients resolve
     * icon links against the *document* URL they were handed, which for a
     * shared link may be a proxied or AMP-style URL. Absolute URLs built from
     * {@code app.public-base-url} remove the ambiguity, and are why the site
     * shows a card logo in SERPs instead of the generic globe.
     *
     * <p>File names are the ones actually shipped in {@code frontend/public/}:
     * {@code favicon.ico} for the crawlers that only look there, the SVG
     * symbol as the primary icon (what {@code index.html} links) and
     * {@code icon-192.png} as the PWA raster fallback for clients that
     * don't do SVG favicons.
     */
    private void appendIconLinks(StringBuilder sb) {
        PreviewHtml.appendIconLinks(sb, baseUrl());
    }

    /**
     * {@code og:image} + Twitter card tags. The tournament and profile
     * previews already emit these (they have a poster / avatar to show); the
     * homepage had none, so every share of {@code bela-turniri.com} itself
     * unfurled as a bare text link.
     */
    private void appendOgImage(StringBuilder sb) {
        String image = baseUrl() + "/" + OG_IMAGE_FILENAME;
        PreviewHtml.appendOgImageMeta(sb, image, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT, "Bela Turniri");
        sb.append("<meta name=\"twitter:card\" content=\"").append(TWITTER_CARD).append("\">\n");
        sb.append("<meta name=\"twitter:image\" content=\"").append(escapeAttr(image)).append("\">\n");
    }

    /**
     * Site-level {@code WebSite} + {@code Organization} JSON-LD, one
     * {@code <script>} block each — same shape and content as the pair baked
     * into {@code index.html} (keep the two in sync if either changes).
     *
     * <ul>
     *   <li>{@code WebSite.potentialAction=SearchAction} is the documented
     *       prerequisite for Google's sitelinks search box on branded
     *       queries; it targets the tournament list's query param.</li>
     *   <li>{@code Organization} gives Google's knowledge graph a canonical
     *       name/logo/homepage triple for the brand chip next to results.</li>
     * </ul>
     */
    private void appendSiteJsonLd(StringBuilder sb) {
        String base = baseUrl();
        sb.append("<script type=\"application/ld+json\">")
                .append("{\"@context\":\"https://schema.org\",\"@type\":\"WebSite\",")
                .append("\"name\":\"Bela Turniri\",")
                .append("\"url\":\"").append(jsonEscape(base + "/")).append("\",")
                .append("\"inLanguage\":\"hr\",")
                .append("\"potentialAction\":{\"@type\":\"SearchAction\",")
                .append("\"target\":{\"@type\":\"EntryPoint\",\"urlTemplate\":\"")
                .append(jsonEscape(base + "/turniri?q={search_term_string}")).append("\"},")
                .append("\"query-input\":\"required name=search_term_string\"}}")
                .append("</script>\n");
        sb.append("<script type=\"application/ld+json\">")
                .append("{\"@context\":\"https://schema.org\",\"@type\":\"Organization\",")
                .append("\"name\":\"Bela Turniri\",")
                .append("\"url\":\"").append(jsonEscape(base + "/")).append("\",")
                .append("\"logo\":\"").append(jsonEscape(base + "/bela-turniri-symbol.png")).append("\",")
                .append("\"sameAs\":[]}")
                .append("</script>\n");
    }

    /**
     * JSON string escaping per RFC 8259, also escaping {@code /} after
     * {@code <} so {@code </script>} can't prematurely close the embedding
     * {@code <script>} tag. Same routine as the sibling preview controllers.
     */
    private static String jsonEscape(String s) {
        return PreviewHtml.jsonEscape(s);
    }

    /** {@code app.public-base-url} without a trailing slash, so callers can concatenate a path directly. */
    private String baseUrl() {
        return publicBaseUrl.replaceAll("/+$", "");
    }

    private static String escapeHtml(String s) {
        return PreviewHtml.escapeHtml(s);
    }

    private static String escapeAttr(String s) {
        return PreviewHtml.escapeAttr(s);
    }
}
