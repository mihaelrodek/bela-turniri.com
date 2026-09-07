package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.model.Pairs;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.model.UserPairPreset;
import hr.mrodek.apps.bela_turniri.model.UserProfile;
import hr.mrodek.apps.bela_turniri.repository.PairsRepository;
import hr.mrodek.apps.bela_turniri.repository.UserPairPresetRepository;
import hr.mrodek.apps.bela_turniri.repository.UserProfileRepository;
import hr.mrodek.apps.bela_turniri.services.PreviewHtml;
import hr.mrodek.apps.bela_turniri.services.PreviewRenderService;
import hr.mrodek.apps.bela_turniri.services.PreviewRenderService.PreviewPage;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.util.List;

/**
 * Server-side rendered preview HTML for crawlers (WhatsApp, Slack, Facebook,
 * Telegram, Twitter, …) sharing a profile URL. Companion to {@link
 * TournamentPreviewController}; same proxy-routing pattern.
 *
 * <p>Endpoint: {@code GET /api/preview/profiles/{slug}} → text/html with
 * profile-specific {@code og:*} meta tags. Caddy rewrites the canonical
 * Croatian SPA path {@code /profil/<slug>} (and its English alias
 * {@code /profile/<slug>}, which 301s to the Croatian one) here for
 * crawlers; real users keep getting the SPA.
 *
 * <p>Phone numbers are deliberately NOT included in the preview meta —
 * crawlers cache the meta indefinitely and we don't want phone numbers
 * sitting in WhatsApp / Slack message scrollback. The same redaction
 * is enforced for anonymous JSON reads in {@link PublicProfileController}.
 */
@Path("/preview/profiles")
public class ProfilePreviewController {

    @Inject UserProfileRepository profileRepo;
    @Inject UserPairPresetRepository presetRepo;
    @Inject PairsRepository pairRepo;
    @Inject PreviewRenderService previewCache;

    @ConfigProperty(name = "app.public-base-url", defaultValue = "https://bela-turniri.com")
    String publicBaseUrl;

    // Fallback og:image for a profile with no avatar uploaded — the same
    // purpose-built 1200x630 card the homepage uses (see HomePreviewController),
    // not the square bela-turniri-symbol.png the old app.default-og-image
    // config property pointed at. A square fallback here would crop badly in
    // WhatsApp/Slack/Facebook, same problem the site-level card fixed.
    private static final String DEFAULT_OG_IMAGE_FILENAME = PreviewHtml.DEFAULT_OG_IMAGE_FILENAME;
    private static final int DEFAULT_OG_IMAGE_WIDTH = PreviewHtml.DEFAULT_OG_IMAGE_WIDTH;
    private static final int DEFAULT_OG_IMAGE_HEIGHT = PreviewHtml.DEFAULT_OG_IMAGE_HEIGHT;

    @GET
    @Path("/{slug}")
    @Produces("text/html; charset=UTF-8")
    public Response preview(@PathParam("slug") String slug) {
        // Memoised per slug. Safe to cache publicly precisely because this
        // page is caller-independent by design: no phone numbers, no hidden
        // participations, nothing that varies with who is looking (see the
        // class javadoc). The stats it shows only change when a tournament
        // finishes, so a 10-minute TTL is invisible to users.
        // A not-found render escapes as a NotFoundSignal so it is NOT memoised
        // — a profile whose slug appears seconds later is visible immediately.
        PreviewPage page;
        try {
            page = previewCache.profile(slug, () -> render(slug));
        } catch (RuntimeException e) {
            PreviewPage missed = PreviewRenderService.notFoundPageOf(e);
            if (missed == null) throw e;
            page = missed;
        }
        return Response.status(page.status())
                .entity(page.body())
                .type("text/html; charset=UTF-8")
                // Never let a CDN hold a 404 for 5-10 minutes.
                .header("Cache-Control", page.status() == 200 ? PreviewHtml.PREVIEW_CACHE_CONTROL : "no-store")
                .build();
    }

    /** Fetch + render, called only on a cache miss. */
    private PreviewPage render(String slug) {
        UserProfile profile = profileRepo.findBySlug(slug).orElse(null);
        if (profile == null) {
            return PreviewPage.notFound(notFoundHtml());
        }

        String displayName = (profile.getDisplayName() != null && !profile.getDisplayName().isBlank())
                ? profile.getDisplayName()
                : "Bela igrač";

        // Reuse the same broadened "my participations" matcher the JSON API
        // uses, so the counts here line up exactly with the profile page.
        List<String> presetNames = presetRepo.findByUserUid(profile.getUserUid()).stream()
                .map(UserPairPreset::getName)
                .toList();
        List<Pairs> participations = pairRepo.findMyParticipations(profile.getUserUid(), presetNames);

        int total = participations.size();
        int wins = 0;
        for (Pairs p : participations) {
            Tournaments t = p.getTournament();
            if (t != null && t.getWinnerName() != null && p.getName() != null
                    && t.getWinnerName().trim().equalsIgnoreCase(p.getName().trim())) {
                wins++;
            }
        }

        String description = buildDescription(displayName, total, wins);

        String base = publicBaseUrl.replaceAll("/+$", "");
        // Canonical profile URL is Croatian (/profil/...). See sibling
        // comment in TournamentPreviewController for the same rationale.
        String spaUrl = base + "/profil/" + slug;

        // Prefer the user's own avatar as og:image / schema.org image —
        // falls back to the app-default og image when missing. This makes
        // shared profile links look personalised in WhatsApp/Telegram
        // previews and gives Google a unique image for the Person rich
        // result.
        String image;
        boolean defaultImage;
        if (profile.getAvatar() != null && profile.getAvatar().getId() != null) {
            image = base + "/api/resources/" + profile.getAvatar().getId() + "/image";
            defaultImage = false;
        } else {
            image = base + "/" + DEFAULT_OG_IMAGE_FILENAME;
            defaultImage = true;
        }

        return PreviewPage.ok(renderHtml(displayName, slug, description, image, defaultImage, spaUrl, total, wins));
    }

    /* ───────────────────── helpers ───────────────────── */

    /**
     * "{name} — {total} turnira, {wins} pobjeda na bela-turniri.com".
     * Uses Croatian noun-form rules for "turnir" / "pobjeda" so the
     * preview reads naturally for 1, 2-4, and 5+ counts.
     */
    String buildDescription(String displayName, int totalTournaments, int wins) {
        return displayName
                + " — "
                + totalTournaments + " " + plurariseTurnir(totalTournaments)
                + ", "
                + wins + " " + plurarisePobjeda(wins)
                + " na bela-turniri.com";
    }

    /**
     * Croatian plural rule for "turnir": 1=turnir, everything else (2-4,
     * 5+, and the 11-14 exception) is "turnira" — genitive plural covers
     * both the paucal and the plain plural form for this noun, so there is
     * only one branch to distinguish from the nominative singular.
     */
    private static String plurariseTurnir(int n) {
        int mod10 = n % 10;
        int mod100 = n % 100;
        if (mod10 == 1 && mod100 != 11) return "turnir";
        return "turnira";
    }

    /** Same idea for "pobjeda" — 1=pobjeda, 2-4=pobjede, 5+=pobjeda (genitive plural). */
    private static String plurarisePobjeda(int n) {
        int mod10 = n % 10;
        int mod100 = n % 100;
        if (mod10 == 1 && mod100 != 11) return "pobjeda";
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "pobjede";
        return "pobjeda";
    }

    private String renderHtml(String name, String slug, String description, String image, boolean defaultImage, String spaUrl, int totalTournaments, int wins) {
        StringBuilder sb = new StringBuilder(2048);
        sb.append("<!doctype html>\n");
        sb.append("<html lang=\"hr\">\n<head>\n");
        sb.append("<meta charset=\"UTF-8\">\n");
        sb.append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n");
        sb.append("<title>").append(escapeHtml(name)).append(" — bela-turniri.com</title>\n");
        sb.append("<meta name=\"description\" content=\"").append(escapeAttr(description)).append("\">\n");
        sb.append("<link rel=\"canonical\" href=\"").append(escapeAttr(spaUrl)).append("\">\n");
        appendIconLinks(sb);

        sb.append("<meta property=\"og:type\" content=\"profile\">\n");
        sb.append("<meta property=\"og:locale\" content=\"hr_HR\">\n");
        sb.append("<meta property=\"og:site_name\" content=\"bela-turniri.com\">\n");
        sb.append("<meta property=\"og:title\" content=\"").append(escapeAttr(name)).append("\">\n");
        sb.append("<meta property=\"og:description\" content=\"").append(escapeAttr(description)).append("\">\n");
        sb.append("<meta property=\"og:url\" content=\"").append(escapeAttr(spaUrl)).append("\">\n");
        sb.append("<meta property=\"profile:username\" content=\"")
                .append(escapeAttr(spaUrl.substring(spaUrl.lastIndexOf('/') + 1))).append("\">\n");
        if (image != null && !image.isBlank()) {
            // Only the fallback card's dimensions are known ahead of time —
            // an uploaded avatar can be any aspect ratio (StorageService only
            // caps the longest edge), so declaring a fixed width/height for
            // it would be actively wrong.
            PreviewHtml.appendOgImageMeta(sb, image,
                    defaultImage ? DEFAULT_OG_IMAGE_WIDTH : null,
                    defaultImage ? DEFAULT_OG_IMAGE_HEIGHT : null,
                    name);
        }

        sb.append("<meta name=\"twitter:card\" content=\"")
                .append(image != null && !image.isBlank() ? "summary_large_image" : "summary")
                .append("\">\n");
        sb.append("<meta name=\"twitter:title\" content=\"").append(escapeAttr(name)).append("\">\n");
        sb.append("<meta name=\"twitter:description\" content=\"").append(escapeAttr(description)).append("\">\n");
        if (image != null && !image.isBlank()) {
            sb.append("<meta name=\"twitter:image\" content=\"").append(escapeAttr(image)).append("\">\n");
        }

        // schema.org Person JSON-LD. Gives Google enough structure to
        // surface the profile as a rich knowledge-panel-style result for
        // "{name} bela" branded queries. We omit any field whose source is
        // empty (no contact info, no DOB) — Google warns on null values
        // but ignores missing ones.
        sb.append("<script type=\"application/ld+json\">")
                .append(buildPersonJsonLd(name, slug, description, image, spaUrl, totalTournaments, wins))
                .append("</script>\n");

        // NB: intentionally NO <meta http-equiv="refresh"> here. Caddy's
        // UA rewrite means a refresh loops Googlebot right back to this
        // controller. Body content below is what gets indexed.
        sb.append("</head>\n<body>\n");
        appendProfileBody(sb, name, description, image, spaUrl, totalTournaments, wins);
        sb.append("</body>\n</html>\n");
        return sb.toString();
    }

    /**
     * Render the actual indexable content for a profile page. Three goals:
     *
     * <ol>
     *   <li><b>Rank for "{name} bela".</b> The H1 + JSON-LD knowsAbout
     *       combo gives Google a strong signal that this page is about
     *       a person who plays Bela — exactly what someone Googling
     *       "{name} bela" is looking for.</li>
     *   <li><b>Match the SPA's public-profile data.</b> Stats and
     *       tournament list are sourced from the same record the SPA
     *       fetches; no inflated content that would count as cloaking.</li>
     *   <li><b>No phone numbers anywhere.</b> Same redaction rule as the
     *       JSON API: phones never leave the backend for anonymous
     *       readers, and a crawler is anonymous by definition.</li>
     * </ol>
     */
    private void appendProfileBody(StringBuilder sb, String name, String description,
                                   String image, String spaUrl,
                                   int totalTournaments, int wins) {
        sb.append("<article>\n");
        sb.append("<h1>").append(escapeHtml(name)).append("</h1>\n");
        if (image != null && !image.isBlank()) {
            sb.append("<p><img src=\"").append(escapeAttr(image))
                    .append("\" alt=\"").append(escapeAttr(name))
                    .append(" — profilna slika\"></p>\n");
        }
        sb.append("<p>").append(escapeHtml(description)).append("</p>\n");

        sb.append("<section>\n<h2>Statistika</h2>\n<ul>\n");
        sb.append("<li>Ukupno turnira: ").append(totalTournaments).append("</li>\n");
        sb.append("<li>Pobjede: ").append(wins).append("</li>\n");
        sb.append("</ul>\n</section>\n");

        sb.append("<hr>\n<p><a href=\"").append(escapeAttr(spaUrl))
                .append("\">Otvori profil u aplikaciji bela-turniri.com</a></p>\n");
        sb.append("</article>\n");
    }

    /**
     * Absolute favicon / touch-icon links — same rationale as
     * {@code TournamentPreviewController#appendIconLinks}: chat clients and
     * Google's favicon crawler resolve icon links against the document URL
     * they were handed, so relative hrefs are unreliable here. File names
     * match what is shipped in {@code frontend/public/}.
     */
    private void appendIconLinks(StringBuilder sb) {
        PreviewHtml.appendIconLinks(sb, publicBaseUrl.replaceAll("/+$", ""));
    }

    private String notFoundHtml() {
        return """
                <!doctype html>
                <html lang="hr"><head>
                <meta charset="UTF-8">
                <title>Profil nije pronađen — bela-turniri.com</title>
                <meta name="description" content="Traženi profil ne postoji.">
                </head><body><p>Profil nije pronađen.</p></body></html>
                """;
    }

    /**
     * Compact schema.org Person JSON-LD. {@code knowsAbout} pins the player
     * to the "Bela" card-game concept which helps Google understand the
     * topical context of these profile pages; without it the algorithm
     * tends to match generic name-only queries unrelated to the game.
     *
     * <p>The win/total counts are surfaced as a single {@code description}
     * string rather than as separate properties — there is no
     * schema.org-blessed "wins" field on Person, and we get richer SERP
     * snippets by keeping the counts inside the human-readable description.
     */
    private String buildPersonJsonLd(String name, String slug, String description,
                                     String image, String spaUrl, int totalTournaments, int wins) {
        StringBuilder j = new StringBuilder(384);
        j.append('{');
        j.append("\"@context\":\"https://schema.org\",");
        j.append("\"@type\":\"Person\",");
        j.append("\"name\":\"").append(jsonEscape(name)).append("\",");
        j.append("\"url\":\"").append(jsonEscape(spaUrl)).append("\",");
        if (slug != null && !slug.isBlank()) {
            j.append("\"identifier\":\"").append(jsonEscape(slug)).append("\",");
            j.append("\"alternateName\":\"").append(jsonEscape(slug)).append("\",");
        }
        j.append("\"description\":\"").append(jsonEscape(description)).append("\",");
        if (image != null && !image.isBlank()) {
            j.append("\"image\":\"").append(jsonEscape(image)).append("\",");
        }
        // knowsAbout pins the topical context to the card game — improves
        // search relevance for queries like "{name} bela" or "{name} karte".
        j.append("\"knowsAbout\":[\"Bela\",\"Belot\",\"Kartaške igre\"],");
        // interactionStatistic gives Google a hook into structured win/total
        // counts. We use UserInteractionCount which is the closest fit; both
        // metrics are emitted independently so each renders as a separate
        // stat in Google's knowledge surface.
        j.append("\"interactionStatistic\":[")
                .append("{\"@type\":\"InteractionCounter\",\"interactionType\":\"https://schema.org/RegisterAction\",\"userInteractionCount\":")
                .append(totalTournaments).append("},")
                .append("{\"@type\":\"InteractionCounter\",\"interactionType\":\"https://schema.org/WinAction\",\"userInteractionCount\":")
                .append(wins).append("}")
                .append("]");
        j.append('}');
        return j.toString();
    }

    /**
     * JSON string escaping per RFC 8259. Also escapes {@code /} after {@code <}
     * so that {@code </script>} cannot appear inside the JSON payload while
     * embedded in an HTML {@code <script>} tag.
     */
    private static String jsonEscape(String s) {
        return PreviewHtml.jsonEscape(s);
    }

    private static String escapeHtml(String s) {
        return PreviewHtml.escapeHtml(s);
    }

    private static String escapeAttr(String s) {
        return PreviewHtml.escapeAttr(s);
    }
}
