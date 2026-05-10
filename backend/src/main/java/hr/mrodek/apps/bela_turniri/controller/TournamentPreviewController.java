package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.repository.TournamentsRepository;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

/**
 * Server-side rendered preview HTML for crawlers (WhatsApp, Slack, Facebook,
 * Telegram, Twitter, LinkedIn, Discord, …). These bots do NOT execute JS, so
 * the per-route {@code useDocumentHead} hook in the SPA is invisible to them.
 * Without this endpoint, every shared tournament URL gets the same generic
 * preview from the static {@code index.html}.
 *
 * <p>Endpoint: {@code GET /api/preview/tournaments/{uuid}} → text/html with
 * tournament-specific {@code og:*} / Twitter-card meta tags.
 *
 * <p>Wiring it up: in your reverse proxy (nginx, Cloudflare Worker, etc.),
 * detect known crawler User-Agents on {@code /tournaments/<uuid>} and rewrite
 * to {@code /api/preview/tournaments/<uuid>}. Real users keep getting the
 * SPA. See the nginx snippet in {@code DEPLOYMENT.md} (or the repo's
 * deploy notes) for the exact regex.
 *
 * <p>The body also has a {@code <meta http-equiv="refresh">} that bounces a
 * human who lands on this URL directly back to the SPA route, so it's safe
 * to expose without a UA filter.
 */
@Path("/preview/tournaments")
public class TournamentPreviewController {

    @Inject
    TournamentsRepository tournamentsRepo;

    @ConfigProperty(name = "app.public-base-url", defaultValue = "https://bela-turniri.com")
    String publicBaseUrl;

    // Optional<> rather than a defaulted String — Quarkus refuses to register
    // an empty defaultValue, so a non-Optional String here would crash boot
    // when APP_DEFAULT_OG_IMAGE isn't set in the environment.
    @ConfigProperty(name = "app.default-og-image")
    Optional<String> defaultOgImage;

    /** Croatian-localized formatter, e.g. "ned, 24. svibnja 2026. u 18:00". */
    private static final DateTimeFormatter HR_DATETIME =
            DateTimeFormatter.ofPattern("EEE, d. MMMM yyyy. 'u' HH:mm", Locale.forLanguageTag("hr-HR"));

    @GET
    @Path("/{uuid}")
    @Produces("text/html; charset=UTF-8")
    public Response preview(@PathParam("uuid") UUID uuid) {
        Tournaments t = tournamentsRepo.findByUuid(uuid).orElse(null);
        if (t == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .type("text/html; charset=UTF-8")
                    .entity(notFoundHtml())
                    .build();
        }

        String name = t.getName() != null ? t.getName() : "Bela turnir";
        String description = buildDescription(t);

        String base = publicBaseUrl.replaceAll("/+$", "");
        String spaUrl = base + "/tournaments/" + uuid;


        // og:image must be an absolute URL — bots fetch it directly from
        // wherever they are. Point them at the backend image proxy on the
        // public hostname; the proxy reads from the (private) MinIO bucket.
        String image = null;
        if (t.getResource() != null && t.getResource().getId() != null) {
            image = base + "/api/resources/" + t.getResource().getId() + "/image";
        } else {
            image = defaultOgImage.filter(s -> !s.isBlank()).orElse(null);
        }

        return Response.ok(renderHtml(name, description, image, spaUrl)).build();
    }

    /* ───────────────────── helpers ───────────────────── */

    /**
     * Compose the og:description as: "{location} • {datetime} • Kotizacija
     * {entry} € + repasaž {repassage} € • Prijavi se i pogledaj sve detalje
     * turnira na bela-turniri.com". Each segment is added only when its
     * source field is present so we don't ship dangling separators.
     */
    String buildDescription(Tournaments t) {
        StringBuilder sb = new StringBuilder();

        if (t.getLocation() != null && !t.getLocation().isBlank()) {
            sb.append(t.getLocation().trim()).append(" • ");
        }

        if (t.getStartAt() != null) {
            sb.append(formatHrDateTime(t.getStartAt())).append(" • ");
        }

        // Entry/repassage prices — defaults are 0; only show repasaž when > 0
        // so we don't clutter free events with "+ repasaž 0 €".
        BigDecimal entry = t.getEntryPrice() != null ? t.getEntryPrice() : BigDecimal.ZERO;
        sb.append("Kotizacija ").append(formatEur(entry)).append(" €");

        BigDecimal rep = t.getRepassagePrice();
        if (rep != null && rep.compareTo(BigDecimal.ZERO) > 0) {
            sb.append(" + repasaž ").append(formatEur(rep)).append(" €");
        }

        sb.append(" • Prijavi se i pogledaj sve detalje turnira na bela-turniri.com");
        return sb.toString();
    }

    /** "10" instead of "10.00" but "10.50" stays "10.50". */
    private String formatEur(BigDecimal v) {
        BigDecimal stripped = v.stripTrailingZeros();
        if (stripped.scale() < 0) stripped = stripped.setScale(0, RoundingMode.UNNECESSARY);
        return stripped.toPlainString();
    }

    private String formatHrDateTime(OffsetDateTime ts) {
        return HR_DATETIME.format(ts);
    }

    /**
     * Build a minimal HTML response. Crawlers only need the {@code <head>};
     * the {@code <body>} is a plain-text fallback for humans who land here
     * directly, and the {@code meta refresh} bounces them to the SPA.
     */
    private String renderHtml(String name, String description, String image, String spaUrl) {
        StringBuilder sb = new StringBuilder(2048);
        sb.append("<!doctype html>\n");
        sb.append("<html lang=\"hr\">\n<head>\n");
        sb.append("<meta charset=\"UTF-8\">\n");
        sb.append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n");
        sb.append("<title>").append(escapeHtml(name)).append(" — bela-turniri.com</title>\n");
        sb.append("<meta name=\"description\" content=\"").append(escapeAttr(description)).append("\">\n");
        sb.append("<link rel=\"canonical\" href=\"").append(escapeAttr(spaUrl)).append("\">\n");

        // OpenGraph
        sb.append("<meta property=\"og:type\" content=\"article\">\n");
        sb.append("<meta property=\"og:locale\" content=\"hr_HR\">\n");
        sb.append("<meta property=\"og:site_name\" content=\"bela-turniri.com\">\n");
        sb.append("<meta property=\"og:title\" content=\"").append(escapeAttr(name)).append("\">\n");
        sb.append("<meta property=\"og:description\" content=\"").append(escapeAttr(description)).append("\">\n");
        sb.append("<meta property=\"og:url\" content=\"").append(escapeAttr(spaUrl)).append("\">\n");
        if (image != null && !image.isBlank()) {
            sb.append("<meta property=\"og:image\" content=\"").append(escapeAttr(image)).append("\">\n");
            sb.append("<meta property=\"og:image:alt\" content=\"").append(escapeAttr(name)).append("\">\n");
        }

        // Twitter
        sb.append("<meta name=\"twitter:card\" content=\"")
                .append(image != null && !image.isBlank() ? "summary_large_image" : "summary")
                .append("\">\n");
        sb.append("<meta name=\"twitter:title\" content=\"").append(escapeAttr(name)).append("\">\n");
        sb.append("<meta name=\"twitter:description\" content=\"").append(escapeAttr(description)).append("\">\n");
        if (image != null && !image.isBlank()) {
            sb.append("<meta name=\"twitter:image\" content=\"").append(escapeAttr(image)).append("\">\n");
        }

        // Bounce humans who hit this URL directly. Crawlers ignore meta
        // refresh; they read the head and move on.
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
                <title>Turnir nije pronađen — bela-turniri.com</title>
                <meta name="description" content="Traženi turnir ne postoji ili je uklonjen.">
                </head><body><p>Turnir nije pronađen.</p></body></html>
                """;
    }

    /** Minimal HTML escape for text node content. */
    private static String escapeHtml(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;");
    }

    /** Stricter escape for attribute values (also escapes quotes). */
    private static String escapeAttr(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
