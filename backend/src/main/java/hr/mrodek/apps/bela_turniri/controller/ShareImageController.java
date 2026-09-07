package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.services.ShareImageRenderer;
import hr.mrodek.apps.bela_turniri.services.TournamentAccess;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * Per-tournament Open Graph share card: {@code GET /tournaments/{idOrSlug}/share-image.png}.
 *
 * <p>A separate resource class from {@link TournamentController} (which
 * another agent owns concurrently) but the same {@code /tournaments} path
 * prefix — JAX-RS is fine with multiple resource classes sharing a prefix as
 * long as the sub-paths don't collide, and {@code /share-image.png} doesn't
 * clash with {@code /qr.png} or anything else on that controller.
 *
 * <p>Anonymous, like the tournament page and its QR code — this is meant to
 * be fetched by chat-app link-unfurlers (WhatsApp, Facebook, Slack, …) with
 * no auth context at all. Follows {@link TournamentController}'s
 * {@code qr.png} endpoint shape closely: strong ETag, {@code If-None-Match}
 * → 304, {@code Cache-Control}. The freshness window is shorter than the
 * QR's 24h (300s/600s here) because the card's pixels change whenever the
 * tournament is edited, while the QR only changes if the slug changes.
 */
@Path("/tournaments")
public class ShareImageController {

    private static final Logger LOG = Logger.getLogger(ShareImageController.class);

    @Inject TournamentAccess access;
    @Inject ShareImageRenderer renderer;

    @ConfigProperty(name = "app.public-base-url", defaultValue = "https://bela-turniri.com")
    String publicBaseUrl;

    // Same asset HomePreviewController falls back to — a purpose-built
    // 1200x630 card, not the square bela-turniri-symbol.png the old
    // app.default-og-image config property pointed at. Hardcoded rather
    // than read from config: it's a checked-in static file that always
    // exists, so there's no "unset" branch to guard against.
    private static final String DEFAULT_OG_IMAGE_FILENAME = "bela-turniri-og-card.png";

    @GET
    @Path("/{idOrSlug}/share-image.png")
    @Produces("image/png")
    public Response shareImage(
            @PathParam("idOrSlug") String idOrSlug,
            @HeaderParam("If-None-Match") String ifNoneMatch
    ) {
        // access.load() throws NotFoundException on a bad id/slug, which the
        // standard exception mapper turns into the usual 404 ApiError
        // envelope — nothing tournament-specific to do here for that case.
        Tournaments t = access.load(idOrSlug);

        String stamp = t.getUpdatedAt() != null ? t.getUpdatedAt().toString() : "none";
        String etag = "\"" + shareImageEtag(t.getId(), stamp) + "\"";
        if (ifNoneMatch != null && etagMatches(ifNoneMatch, etag)) {
            return Response.status(Response.Status.NOT_MODIFIED)
                    .header("Cache-Control", CACHE_CONTROL)
                    .header("ETag", etag)
                    .build();
        }

        try {
            byte[] png = renderer.renderCached(t.getId(), stamp, t.getName(), t.getStartAt(), t.getLocation());
            return Response.ok(png)
                    .header("Cache-Control", CACHE_CONTROL)
                    .header("ETag", etag)
                    .build();
        } catch (RuntimeException e) {
            // Defensive fallback: if rendering ever blows up (corrupt classpath
            // asset, unexpected AWT failure, …) a broken share card is worse
            // than the generic app image previews used before this feature —
            // fall back to the same default OG image the preview page uses
            // rather than serving a 500 to a link-unfurling bot.
            LOG.errorf(e, "Failed to render share image for tournament id=%s", t.getId());
            String fallback = publicBaseUrl.replaceAll("/+$", "") + "/" + DEFAULT_OG_IMAGE_FILENAME;
            return Response.temporaryRedirect(URI.create(fallback))
                    .header("Cache-Control", "no-store")
                    .build();
        }
    }

    /** Shorter than the QR's 24h: the card's bytes change on every tournament edit. */
    private static final String CACHE_CONTROL = "public, max-age=300, s-maxage=600";

    /** Strong ETag derived from the tournament id + updatedAt stamp — both fully determine the PNG bytes. */
    private static String shareImageEtag(Long tournamentId, String stamp) {
        try {
            MessageDigest sha256 = MessageDigest.getInstance("SHA-256");
            byte[] digest = sha256.digest((tournamentId + "|" + stamp).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest, 0, 16); // 32 hex chars is plenty for a cache key
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e); // SHA-256 is always available on the JVMs we run
        }
    }

    /** Same minimal If-None-Match handling as {@code TournamentController#qrCode}: exact match or "*". */
    private static boolean etagMatches(String ifNoneMatch, String quotedEtag) {
        if ("*".equals(ifNoneMatch.trim())) return true;
        for (String candidate : ifNoneMatch.split(",")) {
            if (candidate.trim().equals(quotedEtag)) return true;
        }
        return false;
    }
}
