package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.model.Pairs;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.model.UserPairPreset;
import hr.mrodek.apps.bela_turniri.model.UserProfile;
import hr.mrodek.apps.bela_turniri.repository.PairsRepository;
import hr.mrodek.apps.bela_turniri.repository.UserPairPresetRepository;
import hr.mrodek.apps.bela_turniri.repository.UserProfileRepository;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Server-side rendered preview HTML for crawlers (WhatsApp, Slack, Facebook,
 * Telegram, Twitter, …) sharing a profile URL. Companion to {@link
 * TournamentPreviewController}; same proxy-routing pattern.
 *
 * <p>Endpoint: {@code GET /api/preview/profiles/{slug}} → text/html with
 * profile-specific {@code og:*} meta tags and a meta-refresh redirect to
 * {@code /profile/<slug>} for any human who hits this URL directly.
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

    @ConfigProperty(name = "app.public-base-url", defaultValue = "https://bela-turniri.com")
    String publicBaseUrl;

    // Optional<> rather than a defaulted String — Quarkus refuses to register
    // an empty defaultValue, so a non-Optional String would crash boot when
    // APP_DEFAULT_OG_IMAGE isn't set in the environment.
    @ConfigProperty(name = "app.default-og-image")
    Optional<String> defaultOgImage;

    @GET
    @Path("/{slug}")
    @Produces("text/html; charset=UTF-8")
    public Response preview(@PathParam("slug") String slug) {
        UserProfile profile = profileRepo.findBySlug(slug).orElse(null);
        if (profile == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .type("text/html; charset=UTF-8")
                    .entity(notFoundHtml())
                    .build();
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
        String spaUrl = base + "/profile/" + slug;
        String image = defaultOgImage.filter(s -> !s.isBlank()).orElse(null);

        return Response.ok(renderHtml(displayName, description, image, spaUrl)).build();
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

    /** Croatian plural rule for "turnir": 1=turnir, 2-4=turnira, 5+=turnira (genitive plural). */
    private static String plurariseTurnir(int n) {
        int mod10 = n % 10;
        int mod100 = n % 100;
        if (mod10 == 1 && mod100 != 11) return "turnir";
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "turnira";
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

    private String renderHtml(String name, String description, String image, String spaUrl) {
        StringBuilder sb = new StringBuilder(2048);
        sb.append("<!doctype html>\n");
        sb.append("<html lang=\"hr\">\n<head>\n");
        sb.append("<meta charset=\"UTF-8\">\n");
        sb.append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n");
        sb.append("<title>").append(escapeHtml(name)).append(" — bela-turniri.com</title>\n");
        sb.append("<meta name=\"description\" content=\"").append(escapeAttr(description)).append("\">\n");
        sb.append("<link rel=\"canonical\" href=\"").append(escapeAttr(spaUrl)).append("\">\n");

        sb.append("<meta property=\"og:type\" content=\"profile\">\n");
        sb.append("<meta property=\"og:locale\" content=\"hr_HR\">\n");
        sb.append("<meta property=\"og:site_name\" content=\"bela-turniri.com\">\n");
        sb.append("<meta property=\"og:title\" content=\"").append(escapeAttr(name)).append("\">\n");
        sb.append("<meta property=\"og:description\" content=\"").append(escapeAttr(description)).append("\">\n");
        sb.append("<meta property=\"og:url\" content=\"").append(escapeAttr(spaUrl)).append("\">\n");
        sb.append("<meta property=\"profile:username\" content=\"")
                .append(escapeAttr(spaUrl.substring(spaUrl.lastIndexOf('/') + 1))).append("\">\n");
        if (image != null && !image.isBlank()) {
            sb.append("<meta property=\"og:image\" content=\"").append(escapeAttr(image)).append("\">\n");
            sb.append("<meta property=\"og:image:alt\" content=\"").append(escapeAttr(name)).append("\">\n");
        }

        sb.append("<meta name=\"twitter:card\" content=\"")
                .append(image != null && !image.isBlank() ? "summary_large_image" : "summary")
                .append("\">\n");
        sb.append("<meta name=\"twitter:title\" content=\"").append(escapeAttr(name)).append("\">\n");
        sb.append("<meta name=\"twitter:description\" content=\"").append(escapeAttr(description)).append("\">\n");
        if (image != null && !image.isBlank()) {
            sb.append("<meta name=\"twitter:image\" content=\"").append(escapeAttr(image)).append("\">\n");
        }

        sb.append("<meta http-equiv=\"refresh\" content=\"0; url=").append(escapeAttr(spaUrl)).append("\">\n");
        sb.append("</head>\n<body>\n");
        sb.append("<p><a href=\"").append(escapeAttr(spaUrl)).append("\">")
                .append(escapeHtml(name)).append("</a></p>\n");
        sb.append("<p>").append(escapeHtml(description)).append("</p>\n");
        sb.append("</body>\n</html>\n");
        return sb.toString();
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

    @SuppressWarnings("unused")
    private static String safeLowerCase(String s) {
        return s == null ? null : s.toLowerCase(Locale.ROOT);
    }
}
