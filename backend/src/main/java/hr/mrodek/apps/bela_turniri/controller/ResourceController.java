package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.model.Resources;
import hr.mrodek.apps.bela_turniri.repository.ResourcesRepository;
import hr.mrodek.apps.bela_turniri.services.StorageService;
import io.minio.GetObjectArgs;
import io.minio.MinioClient;
import jakarta.inject.Inject;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.StreamingOutput;
import org.jboss.logging.Logger;

import java.io.InputStream;

/**
 * Anonymous-readable image proxy for poster blobs stored in MinIO.
 *
 * <p>Why we proxy through the backend instead of pointing browsers straight
 * at MinIO:
 * <ul>
 *   <li><b>MinIO bucket stays private.</b> Only the backend (inside the
 *       compose / k8s network) holds the access key. We don't have to expose
 *       MinIO on the public internet, set bucket policies, or worry about
 *       leaked credentials.</li>
 *   <li><b>Stable URLs.</b> {@code /api/resources/<id>/image} never expires;
 *       presigned URLs would have to be regenerated on every tournament
 *       fetch and would invalidate cached image tags every few minutes.</li>
 *   <li><b>Browser caching just works.</b> Resource ids and object keys are
 *       immutable once stored, so we serve {@code Cache-Control: immutable}
 *       and the browser hits the backend at most once per blob.</li>
 * </ul>
 *
 * <p>Bandwidth cost: a poster is at most ~6 MB ({@code MAX_POSTER_BYTES} in
 * {@code StorageService}), and the {@code immutable} header means each one
 * crosses the wire once per browser. For 100 users/day this is invisible.
 */
@Path("/resources")
public class ResourceController {

    private static final Logger LOG = Logger.getLogger(ResourceController.class);

    @Inject
    ResourcesRepository repo;

    @Inject
    MinioClient minio;

    @Inject
    StorageService storageService;

    @Inject hr.mrodek.apps.bela_turniri.services.MessageService messages;

    /**
     * {@code ?w=} serves a downscaled variant instead of the original blob —
     * contract shared with the frontend (perf programme package D):
     * {@code ?w=480|960} for posters, {@code ?w=128} for avatars, any other
     * value 400s. Delegates entirely to {@link #getVariant} so the original
     * path below stays exactly as it was (streamed straight from MinIO,
     * never buffered).
     */
    @GET
    @Path("/{id}/image")
    public Response getImage(@PathParam("id") Long id,
                              @QueryParam("w") Integer w,
                              @HeaderParam("If-None-Match") String ifNoneMatch) {
        Resources r = repo.findByIdOptional(id)
                .orElseThrow(() -> new NotFoundException(messages.t("resource.notFound", String.valueOf(id))));

        if (w != null) {
            return getVariant(r, w, ifNoneMatch);
        }

        // ETag is the raw value MinIO returned on PUT (StorageService),
        // stored unquoted on the entity — HTTP wants it quoted on the wire.
        String rawEtag = r.getEtag();
        String quotedEtag = (rawEtag != null && !rawEtag.isBlank())
                ? "\"" + rawEtag + "\""
                : null;

        if (quotedEtag != null && ifNoneMatch != null && etagMatches(ifNoneMatch, quotedEtag)) {
            // Client already has this exact blob cached — confirm validity
            // without re-streaming the body. Cache headers are repeated so a
            // 304 refreshes the browser's cache lifetime too.
            Response.ResponseBuilder notModified = Response.status(Response.Status.NOT_MODIFIED)
                    .header("Cache-Control", "public, max-age=31536000, immutable")
                    .header("ETag", quotedEtag);
            return notModified.build();
        }

        // Stream MinIO's response straight to the client — never buffer the
        // whole blob in memory. The MinIO client's GetObjectResponse is an
        // InputStream-compatible wrapper, so transferTo() copies bytes without
        // an intermediate byte[].
        StreamingOutput body = out -> {
            try (InputStream in = minio.getObject(GetObjectArgs.builder()
                    .bucket(r.getBucketName())
                    .object(r.getObjectKey())
                    .build())) {
                in.transferTo(out);
            } catch (Exception e) {
                LOG.errorf(e, "Failed to stream resource %d (%s/%s) from MinIO",
                        id, r.getBucketName(), r.getObjectKey());
                throw new RuntimeException("Failed to fetch image", e);
            }
        };

        String ct = (r.getContentType() != null && !r.getContentType().isBlank())
                ? r.getContentType()
                : MediaType.APPLICATION_OCTET_STREAM;

        Response.ResponseBuilder ok = Response.ok(body)
                // Use the stored, sanitized Content-Type — set by StorageService
                // from the validated extension, not from any client header.
                .header("Content-Type", ct)
                // Resource rows are immutable: bucket + objectKey never change
                // after creation, so the URL→blob mapping is stable. One-year
                // immutable cache keeps repeat visits free.
                .header("Cache-Control", "public, max-age=31536000, immutable")
                // Defense-in-depth — even if Content-Type were ever wrong, the
                // browser must not sniff the bytes as HTML/JS.
                .header("X-Content-Type-Options", "nosniff")
                .header("Content-Disposition", "inline");
        if (quotedEtag != null) {
            ok.header("ETag", quotedEtag);
        }
        return ok.build();
    }

    /**
     * Serve a width-downscaled variant of {@code r}, per the {@code ?w=}
     * contract. {@code width} is validated against the resource's stored
     * {@code metadata.kind} ({@code "poster"} → 480/960, {@code "avatar"}
     * → 128, anything else or an unrecognised kind → 400) before touching
     * {@link StorageService#resizedVariant}, so the Caffeine-backed variant
     * cache's key space stays exactly as bounded as the fixed widths — an
     * attacker walking {@code ?w=1,2,3,…} can never turn it into an
     * unbounded render.
     *
     * <p>ETag carries the width so the browser (and any shared cache) keys
     * each variant separately from the original and from each other; when
     * the underlying resource has no stored etag (should not happen for
     * anything StorageService ever wrote, but defensive), the response
     * still serves the bytes — it just skips conditional-GET support, same
     * as {@link #getImage} does for the original.
     */
    private Response getVariant(Resources r, int width, String ifNoneMatch) {
        String kind = (r.getMetadata() != null && r.getMetadata().hasNonNull("kind"))
                ? r.getMetadata().get("kind").asText()
                : null;
        if (!hr.mrodek.apps.bela_turniri.services.StorageService.validVariantWidth(kind, width)) {
            throw new BadRequestException(messages.t("resource.image.invalidWidth", String.valueOf(width)));
        }

        String rawEtag = r.getEtag();
        String quotedEtag = (rawEtag != null && !rawEtag.isBlank())
                ? "\"" + rawEtag + "-w" + width + "\""
                : null;

        if (quotedEtag != null && ifNoneMatch != null && etagMatches(ifNoneMatch, quotedEtag)) {
            return Response.status(Response.Status.NOT_MODIFIED)
                    .header("Cache-Control", "public, max-age=31536000, immutable")
                    .header("ETag", quotedEtag)
                    .build();
        }

        String ct = (r.getContentType() != null && !r.getContentType().isBlank())
                ? r.getContentType()
                : MediaType.APPLICATION_OCTET_STREAM;

        byte[] body;
        try {
            body = storageService.resizedVariant(
                    r.getId(), width, rawEtag == null ? "" : rawEtag,
                    r.getBucketName(), r.getObjectKey(), ct);
        } catch (RuntimeException e) {
            LOG.errorf(e, "Failed to build %dpx variant of resource %d (%s/%s)",
                    width, r.getId(), r.getBucketName(), r.getObjectKey());
            throw e;
        }

        Response.ResponseBuilder ok = Response.ok(body)
                .header("Content-Type", ct)
                // Same "id's bytes never change" invariant as the original
                // image response (see the class javadoc) — a variant is a
                // pure function of (resource bytes, width), both stable.
                .header("Cache-Control", "public, max-age=31536000, immutable")
                .header("X-Content-Type-Options", "nosniff")
                .header("Content-Disposition", "inline");
        if (quotedEtag != null) {
            ok.header("ETag", quotedEtag);
        }
        return ok.build();
    }

    /**
     * Minimal If-None-Match evaluation: browsers send back exactly the ETag
     * we gave them, but the header technically allows a comma-separated
     * list (and "*"). We don't need full RFC 7232 weak-comparison support
     * here — resources are immutable so a strong exact match is enough.
     */
    private static boolean etagMatches(String ifNoneMatch, String quotedEtag) {
        if ("*".equals(ifNoneMatch.trim())) return true;
        for (String candidate : ifNoneMatch.split(",")) {
            if (candidate.trim().equals(quotedEtag)) return true;
        }
        return false;
    }
}
