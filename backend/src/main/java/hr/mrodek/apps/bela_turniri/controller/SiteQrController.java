package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.services.QrCodeRenderer;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * Branded QR code of the SITE itself: {@code GET /site/qr.png} opens the
 * app's public address when scanned (2026-10-03). Used by the printed global
 * rulebook (/pravila), whose QR leads to the site rather than to one
 * tournament — a tournament's own rules print uses
 * {@code /tournaments/{idOrSlug}/qr.png} instead.
 *
 * <p>Deliberately NOT a generic "QR of any URL" endpoint: an anonymous
 * renderer that encodes whatever it is given would be an abuse magnet. This
 * one encodes exactly one thing, {@code app.public-base-url}, so the image
 * is a pure function of config + size, hard-cacheable and ETag'd like the
 * tournament one, and sits in the same Caddy {@code render} rate-limit zone.
 */
@Path("/site/qr.png")
public class SiteQrController {

    @ConfigProperty(name = "app.public-base-url", defaultValue = "https://bela-turniri.com")
    String publicBaseUrl;

    @Inject
    QrCodeRenderer qrCodeRenderer;

    @GET
    @Produces("image/png")
    public Response qrCode(
            @QueryParam("size") Integer size,
            @HeaderParam("If-None-Match") String ifNoneMatch
    ) {
        String url = publicBaseUrl.replaceAll("/+$", "") + "/";
        int px = QrCodeRenderer.clampSize(size);
        String etag = "\"" + etag(url, px) + "\"";
        if (ifNoneMatch != null && ("*".equals(ifNoneMatch.trim()) || ifNoneMatch.contains(etag))) {
            return Response.status(Response.Status.NOT_MODIFIED)
                    .header("Cache-Control", "public, max-age=86400, s-maxage=86400")
                    .header("ETag", etag)
                    .build();
        }
        byte[] png = qrCodeRenderer.renderCached(url, px);
        return Response.ok(png)
                .header("Cache-Control", "public, max-age=86400, s-maxage=86400")
                .header("ETag", etag)
                .build();
    }

    private static String etag(String url, int size) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest((url + "|" + size).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest, 0, 16);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
