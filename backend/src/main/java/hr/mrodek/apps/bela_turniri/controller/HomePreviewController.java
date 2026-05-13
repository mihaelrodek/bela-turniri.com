package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.repository.TournamentsRepository;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Response;

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

    @GET
    @Path("/home")
    @Produces("text/html; charset=UTF-8")
    public Response home() {
        List<Tournaments> upcoming = tournamentsRepo
                .findByStartAtGreaterThanEqualOrderByStartAtAsc(OffsetDateTime.now());
        // Cap the list — see UPCOMING_LIMIT comment.
        if (upcoming.size() > UPCOMING_LIMIT) {
            upcoming = upcoming.subList(0, UPCOMING_LIMIT);
        }
        return Response.ok(renderHome(upcoming)).build();
    }

    @GET
    @Path("/tournaments-list")
    @Produces("text/html; charset=UTF-8")
    public Response tournamentsList() {
        List<Tournaments> upcoming = tournamentsRepo
                .findByStartAtGreaterThanEqualOrderByStartAtAsc(OffsetDateTime.now());
        if (upcoming.size() > UPCOMING_LIMIT) {
            upcoming = upcoming.subList(0, UPCOMING_LIMIT);
        }
        List<Tournaments> finished = tournamentsRepo.findFinishedPaged(0, FINISHED_LIMIT);
        return Response.ok(renderTournamentsList(upcoming, finished)).build();
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
        appendHeadOpen(sb,
                "Bela turniri u Hrvatskoj — bela-turniri.com",
                "Bela turniri u Hrvatskoj i regiji. Pretraži nadolazeće turnire, "
                        + "pridruži se paru, prati rezultate i statistike.",
                "https://bela-turniri.com/");
        // Site-wide WebSite + Organization JSON-LD is already in the static
        // index.html; we don't duplicate it here. The homepage doesn't need
        // a per-page JSON-LD object beyond what the global ones provide.
        sb.append("</head>\n<body>\n<article>\n");
        sb.append("<h1>Bela turniri u Hrvatskoj</h1>\n");
        sb.append("<p>bela-turniri.com je platforma za organizaciju i praćenje "
                + "Bela turnira u Hrvatskoj i regiji. Organizatori mogu kreirati "
                + "turnire, prikupiti prijave parova i objaviti rezultate, a "
                + "igrači prate raspored, povijest nastupa i pridružuju se "
                + "novim turnirima.</p>\n");

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
        sb.append("<section>\n<h2>Istraži</h2>\n<ul>\n");
        sb.append("<li><a href=\"https://bela-turniri.com/turniri\">Svi turniri</a></li>\n");
        sb.append("<li><a href=\"https://bela-turniri.com/kalendar\">Kalendar turnira</a></li>\n");
        sb.append("<li><a href=\"https://bela-turniri.com/karta\">Karta turnira</a></li>\n");
        sb.append("</ul>\n</section>\n");

        sb.append("<hr>\n<p><a href=\"https://bela-turniri.com/\">"
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
                "Bela turniri u Hrvatskoj — popis turnira | bela-turniri.com",
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

        sb.append("<hr>\n<p><a href=\"https://bela-turniri.com/turniri\">"
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
        String href = "https://bela-turniri.com/turniri/"
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
        sb.append("<meta property=\"og:site_name\" content=\"bela-turniri.com\">\n");
        sb.append("<meta property=\"og:title\" content=\"")
                .append(escapeAttr(title)).append("\">\n");
        sb.append("<meta property=\"og:description\" content=\"")
                .append(escapeAttr(description)).append("\">\n");
        sb.append("<meta property=\"og:url\" content=\"")
                .append(escapeAttr(canonical)).append("\">\n");
    }

    private static String escapeHtml(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private static String escapeAttr(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
