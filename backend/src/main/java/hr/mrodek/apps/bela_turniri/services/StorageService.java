package hr.mrodek.apps.bela_turniri.services;

import com.fasterxml.jackson.databind.ObjectMapper;
import hr.mrodek.apps.bela_turniri.model.Resources;
import hr.mrodek.apps.bela_turniri.repository.ResourcesRepository;
import io.minio.GetObjectArgs;
import io.minio.MinioClient;
import io.minio.RemoveObjectArgs;
import io.minio.errors.MinioException;
import io.quarkus.cache.CacheKey;
import io.quarkus.cache.CacheResult;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.time.OffsetDateTime;
import java.util.Set;
import java.util.UUID;

@ApplicationScoped
public class StorageService {

    private static final Logger LOG = Logger.getLogger(StorageService.class);

    @Inject MinioClient minio;
    @Inject ResourcesRepository resourcesRepo;
    @Inject ObjectMapper objectMapper;
    @Inject MessageService messages;

    @ConfigProperty(name = "minio.bucket")
    String bucket;

    /**
     * Hard cap on poster size (bytes). The global Quarkus body-size limit is
     * 15 MiB, but a tournament poster has no business being more than a few
     * MB even at high resolution. Defense-in-depth check that stops a
     * logged-in user from filling MinIO with 15 MB images repeatedly.
     */
    private static final long MAX_POSTER_BYTES = 6L * 1024 * 1024;

    /**
     * Hard cap on avatar size (bytes). Same intent as MAX_POSTER_BYTES — a
     * profile picture has no reason to be larger than a few MB.
     */
    private static final long MAX_AVATAR_BYTES = 5L * 1024 * 1024;

    /** Longest edge after recompression, per kind. Posters render at most
     *  ~800 CSS px wide (2× for retina → 1600); avatars are small circles. */
    private static final int MAX_POSTER_DIM = 1600;
    private static final int MAX_AVATAR_DIM = 512;

    /**
     * Widths accepted for {@code GET /resources/{id}/image?w=} when the
     * resource's stored {@code metadata.kind} is {@code "poster"}. Fixed,
     * small set — same reasoning as {@code QrCodeRenderer.ALLOWED_SIZES}:
     * an unbounded {@code w} would make the cache key space (and therefore
     * the render cost) attacker-controlled. Contract shared with the
     * frontend's {@code posterSrcSet} helper (perf programme package D).
     */
    public static final Set<Integer> ALLOWED_POSTER_WIDTHS = Set.of(480, 960);

    /** Same idea as {@link #ALLOWED_POSTER_WIDTHS}, for {@code "avatar"} resources. */
    public static final Set<Integer> ALLOWED_AVATAR_WIDTHS = Set.of(128);

    /** Tournament poster upload — keyed under {@code posters/...}. */
    public Resources uploadPoster(org.jboss.resteasy.reactive.multipart.FileUpload file) {
        return uploadImage(file, "poster", "posters", MAX_POSTER_BYTES, MAX_POSTER_DIM);
    }

    /** User avatar upload — keyed under {@code avatars/...}. */
    public Resources uploadAvatar(org.jboss.resteasy.reactive.multipart.FileUpload file) {
        return uploadImage(file, "avatar", "avatars", MAX_AVATAR_BYTES, MAX_AVATAR_DIM);
    }

    /**
     * On-the-fly width-downscaled variant of a stored image, for
     * {@code GET /resources/{id}/image?w=}. Caffeine-cached (see the
     * {@code image-variants} named cache in {@code application.properties})
     * keyed by resource id + width + the resource's own {@code etag} — the
     * etag is included even though a given resource id's bytes never
     * actually change in place (every upload path here always {@code save}s
     * a brand-new {@link Resources} row; see the class javadoc and
     * {@link #releaseIfOrphaned}), purely as cheap defense-in-depth against
     * that invariant ever being broken by a future change.
     *
     * <p><b>Never upscales</b>: posters/avatars are already downscaled to
     * {@link #MAX_POSTER_DIM}/{@link #MAX_AVATAR_DIM} at upload time, so a
     * source narrower than the requested width is returned byte-for-byte
     * unchanged rather than stretched.
     *
     * <p>GIF/WebP pass through unresized — same reasoning as
     * {@link #uploadImage}: Thumbnailator would destroy GIF animation, and
     * this JVM's ImageIO has no WebP decoder.
     *
     * <p>Called only after {@link #validVariantWidth} has approved
     * {@code width} for the resource's kind — an unbounded {@code width}
     * would make the cache key space (and the downscale cost) attacker
     * controlled, exactly the reasoning behind {@code QrCodeRenderer}'s
     * {@code ALLOWED_SIZES}.
     */
    @CacheResult(cacheName = "image-variants")
    public byte[] resizedVariant(
            @CacheKey Long resourceId,
            @CacheKey int width,
            @CacheKey String etag,
            String bucketName,
            String objectKey,
            String contentType
    ) {
        try (java.io.InputStream in = minio.getObject(GetObjectArgs.builder()
                .bucket(bucketName)
                .object(objectKey)
                .build())) {
            byte[] original = in.readAllBytes();

            if ("image/gif".equalsIgnoreCase(contentType) || "image/webp".equalsIgnoreCase(contentType)) {
                return original;
            }

            int[] dims = readImageDimensions(original);
            if (dims == null || dims[0] <= width) {
                // Already narrower than (or equal to) the requested width, or
                // dimensions unreadable — serving the original is always safe
                // and never upscales.
                return original;
            }

            String outFormat = "image/png".equalsIgnoreCase(contentType) ? "png" : "jpg";
            var out = new java.io.ByteArrayOutputStream(128 * 1024);
            net.coobird.thumbnailator.Thumbnails.of(new java.io.ByteArrayInputStream(original))
                    .width(width)
                    .outputFormat(outFormat)
                    .outputQuality(0.85)
                    .toOutputStream(out);
            return out.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Failed to build image variant for resource " + resourceId, e);
        }
    }

    /**
     * True when {@code width} is an accepted {@code ?w=} value for a
     * resource whose stored {@code metadata.kind} is {@code kind}
     * ({@code "poster"} or {@code "avatar"}; any other/missing kind accepts
     * nothing). The caller ({@code controller.ResourceController}) maps a
     * {@code false} to 400 before ever calling {@link #resizedVariant}.
     */
    public static boolean validVariantWidth(String kind, int width) {
        if ("poster".equals(kind)) return ALLOWED_POSTER_WIDTHS.contains(width);
        if ("avatar".equals(kind)) return ALLOWED_AVATAR_WIDTHS.contains(width);
        return false;
    }

    /**
     * Best-effort delete of a MinIO object. Never throws — a failed cleanup
     * (network blip, object already gone, permissions) must not fail the
     * caller's request; we just log a warning so it can be noticed/swept
     * later.
     */
    public void deleteObject(String objectKey) {
        if (objectKey == null || objectKey.isBlank()) return;
        try {
            minio.removeObject(RemoveObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectKey)
                    .build());
        } catch (Exception e) {
            LOG.warnf(e, "Failed to delete MinIO object %s/%s (ignored, best-effort)", bucket, objectKey);
        }
    }

    /**
     * Best-effort cleanup of a {@link Resources} row that has just been
     * unlinked (today: an avatar being replaced). A Resources row can also
     * be a tournament poster, or — defensively — another user's avatar, so
     * the MinIO object and the row are dropped only when nothing else still
     * references them. Never lets a failure here fail the caller's request:
     * any exception is logged and swallowed.
     *
     * <p>The poster check MUST be a native query. {@code Tournaments} carries
     * {@code @SQLRestriction("is_deleted = false")}, so a Panache count would
     * not see a soft-deleted tournament that still holds the FK — we would
     * delete the blob, then fail the FK constraint at commit and 500 the
     * request with the object already gone from MinIO.
     *
     * <p>Order matters for the same reason: flush the caller's pending update
     * first (the native counts read the database directly and would otherwise
     * see stale rows), then delete the row and {@code flush()} again so a
     * surviving FK surfaces as a caught exception here, and only then drop
     * the blob. A leaked blob is strictly better than a 500.
     *
     * <p>Lives here rather than in the controller because it is storage
     * bookkeeping — it owns the MinIO object's lifetime, and the controller
     * has no business knowing which tables can hold a resource FK. Must be
     * called inside the caller's transaction.
     */
    public void releaseIfOrphaned(Resources old) {
        if (old == null || old.getId() == null) return;
        try {
            var em = resourcesRepo.getEntityManager();
            // Push the pending profile update out first: the native count below
            // reads the database directly and would otherwise see stale rows.
            em.flush();

            long postersUsing = ((Number) em
                    .createNativeQuery("select count(*) from tournaments where resource_id = ?1")
                    .setParameter(1, old.getId())
                    .getSingleResult()).longValue();
            long avatarsUsing = ((Number) em
                    .createNativeQuery("select count(*) from user_profiles where avatar_resource_id = ?1")
                    .setParameter(1, old.getId())
                    .getSingleResult()).longValue();
            if (postersUsing > 0 || avatarsUsing > 0) {
                return; // still referenced elsewhere — leave it alone
            }
            // Row first, then flush: any FK we did not anticipate blows up here,
            // inside the try, while the MinIO object is still intact.
            resourcesRepo.delete(old);
            em.flush();
            deleteObject(old.getObjectKey());
        } catch (Exception e) {
            LOG.warnf(e, "Failed to clean up orphaned resource %s (ignored, best-effort)",
                    old.getId());
        }
    }

    /**
     * Shared upload pipeline. The caller picks a {@code kind} (recorded in
     * metadata), an object-key {@code prefix} (e.g. {@code posters},
     * {@code avatars}), a max-size cap and a max dimension to downscale to.
     * Everything else — content-type validation, magic-byte safety,
     * decompression-bomb guard, recompression, MinIO put — is identical.
     */
    private Resources uploadImage(
            org.jboss.resteasy.reactive.multipart.FileUpload file,
            String kind,
            String prefix,
            long maxBytes,
            int maxDim) {
        try {
            // Per-image size cap, separate from the global body limit. We
            // check before reading bytes so a large file is rejected as
            // cheaply as possible.
            if (file.size() > maxBytes) {
                throw new IllegalArgumentException(messages.t(
                        "storage.image.tooLarge", String.valueOf(maxBytes / (1024 * 1024))));
            }

            // Ensure bucket exists (no-op if it already does)
            boolean exists = minio.bucketExists(
                    io.minio.BucketExistsArgs.builder().bucket(bucket).build()
            );
            if (!exists) {
                minio.makeBucket(io.minio.MakeBucketArgs.builder().bucket(bucket).build());
            }

            java.nio.file.Path path = file.uploadedFile();
            String originalName = file.fileName();

            // Magic-byte sniff — the actual file content is the only thing we
            // trust. A renamed `evil.exe.jpg` won't match any known signature
            // and gets rejected before it ever reaches MinIO. The filename
            // extension is deliberately ignored: a genuine JPEG saved as
            // `photo.png` is a perfectly valid upload, and both the object key
            // and the stored Content-Type are derived from the sniffed type.
            String magicExt = sniffMagicExt(path);
            if (magicExt == null) {
                throw new IllegalArgumentException(messages.t("storage.image.unsupported"));
            }
            String ext = magicExt;

            // Reject "decompression bombs" BEFORE recompress() decodes the full
            // raster. A few-hundred-KB PNG/JPEG (under the byte cap) can declare
            // e.g. 25000x25000 and force a huge BufferedImage allocation ->
            // OutOfMemoryError (an Error, so not caught below) crashing the JVM.
            // We read only the header dimensions (no pixel decode) and cap area.
            assertImageDimensionsSane(path);

            // Downscale + recompress before storing. A phone-camera JPEG is
            // 3-6 MB / 4000 px but renders far smaller — serving it verbatim
            // is wasted bandwidth. WebP and GIF are passed through as-is:
            // ImageIO can't decode WebP without native plugins, and
            // recompressing an animated GIF through a single-frame pipeline
            // would destroy the animation.
            byte[] body;
            if ("webp".equals(ext) || "gif".equals(ext)) {
                body = java.nio.file.Files.readAllBytes(path);
            } else {
                byte[] recompressed = recompress(path, ext, maxDim);
                int[] dims = readImageDimensions(path);
                boolean downscaled = dims != null && (dims[0] > maxDim || dims[1] > maxDim);
                if (recompressed != null && downscaled) {
                    // The source is larger than we ever render it — always keep
                    // the downscaled copy, even if the re-encode happens to be
                    // bigger in bytes than the original.
                    body = recompressed;
                } else {
                    byte[] original = java.nio.file.Files.readAllBytes(path);
                    // No downscale was needed — keep whichever is smaller,
                    // since recompressing an already-tiny image can inflate it.
                    body = (recompressed != null && recompressed.length < original.length)
                            ? recompressed
                            : original;
                }
            }

            String objectKey = buildObjectKey(prefix, ext);

            // SECURITY: derive the stored Content-Type from the validated extension
            // — never trust the client-supplied file.contentType().
            String safeContentType = contentTypeForExt(ext);

            var put = io.minio.PutObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectKey)
                    .contentType(safeContentType)
                    .extraHeaders(java.util.Map.of(
                            "Content-Disposition", "inline",
                            "X-Content-Type-Options", "nosniff"
                    ))
                    .stream(new java.io.ByteArrayInputStream(body), body.length, -1)
                    .build();

            var result = minio.putObject(put);

            Resources r = new Resources();
            r.setBucketName(bucket);
            r.setObjectKey(objectKey);
            r.setContentType(safeContentType);
            r.setSizeBytes((long) body.length);
            r.setEtag(result.etag());
            r.setCreatedAt(OffsetDateTime.now());
            r.setUpdatedAt(OffsetDateTime.now());

            com.fasterxml.jackson.databind.node.ObjectNode meta = objectMapper.createObjectNode();
            if (originalName != null) meta.put("originalFilename", originalName);
            meta.put("kind", kind);
            meta.put("uploadedAt", OffsetDateTime.now().toString());
            r.setMetadata(meta);

            return resourcesRepo.save(r);
        } catch (MinioException me) {
            throw new RuntimeException("MinIO error: " + me.getMessage(), me);
        } catch (IllegalArgumentException iae) {
            // Don't wrap — let the IllegalArgumentExceptionMapper turn this into 400.
            throw iae;
        } catch (Exception e) {
            throw new RuntimeException("Failed to upload " + kind, e);
        }
    }

    /**
     * Guard against image "decompression bombs": read ONLY the header
     * dimensions via an ImageReader (no raster decode / no big allocation) and
     * reject anything above our megapixel budget, or with either edge absurdly
     * long. Nothing we render needs more than a 1600 px edge, so a 5000 px /
     * 25 MP ceiling is still far above any legitimate upload. Formats ImageIO
     * can't read (e.g. WebP) simply produce no reader and are skipped here —
     * they aren't decoded here anyway and stay bounded by the byte cap.
     */
    private void assertImageDimensionsSane(java.nio.file.Path path) {
        final long MAX_PIXELS = 25_000_000L; // 25 megapixels
        final int MAX_EDGE = 5000;
        int[] dims = readImageDimensions(path);
        if (dims == null) return;
        long w = dims[0];
        long h = dims[1];
        if (w > MAX_EDGE || h > MAX_EDGE) {
            throw new IllegalArgumentException(messages.t("storage.image.unsupported"));
        }
        if (w > 0 && h > 0 && w * h > MAX_PIXELS) {
            throw new IllegalArgumentException(messages.t("storage.image.unsupported"));
        }
    }

    /**
     * Header-only read of an image's pixel dimensions ({@code [width, height]}),
     * or {@code null} when no ImageIO reader can handle the file. Never decodes
     * the raster, so it is safe to call on untrusted input.
     */
    private int[] readImageDimensions(java.nio.file.Path path) {
        try {
            javax.imageio.stream.ImageInputStream iis = javax.imageio.ImageIO.createImageInputStream(path.toFile());
            return readImageDimensions(iis);
        } catch (Exception e) {
            return null;
        }
    }

    /** Same header-only read as above, for bytes already held in memory (image variants). */
    private int[] readImageDimensions(byte[] bytes) {
        try {
            javax.imageio.stream.ImageInputStream iis = javax.imageio.ImageIO
                    .createImageInputStream(new java.io.ByteArrayInputStream(bytes));
            return readImageDimensions(iis);
        } catch (Exception e) {
            return null;
        }
    }

    private int[] readImageDimensions(javax.imageio.stream.ImageInputStream iis) {
        javax.imageio.ImageReader reader = null;
        try {
            if (iis == null) return null;
            java.util.Iterator<javax.imageio.ImageReader> readers =
                    javax.imageio.ImageIO.getImageReaders(iis);
            if (!readers.hasNext()) return null;
            reader = readers.next();
            reader.setInput(iis, true, true);
            return new int[] { reader.getWidth(0), reader.getHeight(0) };
        } catch (Exception e) {
            // Header unreadable → let recompress()/passthrough handle it; the
            // byte-size cap already bounds truly huge files.
            return null;
        } finally {
            if (reader != null) reader.dispose();
            if (iis != null) {
                try { iis.close(); } catch (Exception ignored) { }
            }
        }
    }

    /**
     * Downscale to {@code maxDim} on the longest edge and re-encode (JPEG at
     * quality 0.85; PNG stays PNG to preserve alpha). Returns {@code null} on
     * any decode/encode failure so the caller falls back to the original
     * bytes — a picture we can't recompress is stored verbatim rather than
     * rejected.
     */
    private byte[] recompress(java.nio.file.Path path, String ext, int maxDim) {
        try {
            var out = new java.io.ByteArrayOutputStream(256 * 1024);
            net.coobird.thumbnailator.Thumbnails.of(path.toFile())
                    .size(maxDim, maxDim)          // fits within, keeps aspect, never upscales beyond source
                    .outputFormat("png".equals(ext) ? "png" : "jpg")
                    .outputQuality(0.85)
                    .toOutputStream(out);
            return out.toByteArray();
        } catch (Exception e) {
            LOG.warnf(e, "Recompression failed for %s, falling back to original bytes", path);
            return null;
        }
    }

    /**
     * Read the first bytes of the uploaded file and identify it by magic
     * number, returning our canonical extension ("jpg" / "png" / "gif" /
     * "webp") or {@code null} when the content is not an accepted image.
     *
     * <p>Why this matters: trusting the filename extension alone lets an
     * attacker upload {@code evil.exe} renamed to {@code evil.jpg} — the
     * bucket would store the EXE blob with {@code Content-Type: image/jpeg},
     * and downstream consumers (social-media link preview crawlers,
     * image-thumbnail pipelines, etc.) could fetch it as an image when it
     * isn't.
     */
    private String sniffMagicExt(java.nio.file.Path path) {
        byte[] head = new byte[16];
        int read;
        try (java.io.InputStream in = java.nio.file.Files.newInputStream(path)) {
            read = in.readNBytes(head, 0, head.length);
        } catch (Exception e) {
            return null;
        }
        if (read < 4) return null;
        // JPEG: FF D8 FF
        if ((head[0] & 0xff) == 0xff && (head[1] & 0xff) == 0xd8 && (head[2] & 0xff) == 0xff) {
            return "jpg";
        }
        // PNG: 89 50 4E 47 0D 0A 1A 0A
        if (read >= 8
                && (head[0] & 0xff) == 0x89 && head[1] == 'P' && head[2] == 'N' && head[3] == 'G'
                && head[4] == 0x0D && head[5] == 0x0A && head[6] == 0x1A && head[7] == 0x0A) {
            return "png";
        }
        // GIF: "GIF87a" or "GIF89a"
        if (read >= 6 && head[0] == 'G' && head[1] == 'I' && head[2] == 'F' && head[3] == '8'
                && (head[4] == '7' || head[4] == '9') && head[5] == 'a') {
            return "gif";
        }
        // WebP: "RIFF" .... "WEBP"
        if (read >= 12 && head[0] == 'R' && head[1] == 'I' && head[2] == 'F' && head[3] == 'F'
                && head[8] == 'W' && head[9] == 'E' && head[10] == 'B' && head[11] == 'P') {
            return "webp";
        }
        return null;
    }

    /**
     * Map our internal extension token to the Content-Type we want stored on the
     * MinIO object. Decoupled from request input so a malicious client can't
     * trick us into serving uploaded bytes as HTML/JS/SVG.
     */
    private String contentTypeForExt(String ext) {
        return switch (ext) {
            case "jpg" -> "image/jpeg";
            case "png" -> "image/png";
            case "gif" -> "image/gif";
            case "webp" -> "image/webp";
            // Should be unreachable — uploadImage() rejects unknown types before this point.
            default -> "application/octet-stream";
        };
    }

    private String buildObjectKey(String prefix, String ext) {
        // e.g. posters/ab/uuid.jpg or avatars/ab/uuid.jpg
        String id = UUID.randomUUID().toString();
        return "%s/%s/%s.%s".formatted(prefix, id.substring(0, 2), id, ext);
    }
}
