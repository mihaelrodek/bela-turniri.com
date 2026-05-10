package hr.mrodek.apps.bela_turniri.services;

import com.fasterxml.jackson.databind.ObjectMapper;
import hr.mrodek.apps.bela_turniri.model.Resources;
import hr.mrodek.apps.bela_turniri.repository.ResourcesRepository;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.errors.MinioException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.apache.commons.io.FilenameUtils;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.resteasy.reactive.multipart.FileUpload;

import java.io.InputStream;
import java.nio.file.Files;
import java.time.OffsetDateTime;
import java.util.UUID;

@ApplicationScoped
public class StorageService {

    @Inject MinioClient minio;
    @Inject ResourcesRepository resourcesRepo;
    @Inject ObjectMapper objectMapper;

    @ConfigProperty(name = "minio.bucket")
    String bucket;

    /**
     * Hard cap on poster size (bytes). The global Quarkus body-size limit is
     * 15 MiB, but a tournament poster has no business being more than a few
     * MB even at high resolution. This is the defense-in-depth check that
     * stops a logged-in user from filling MinIO with 15 MB images repeatedly.
     */
    private static final long MAX_POSTER_BYTES = 6L * 1024 * 1024;

    /** Upload using RESTEasy Reactive FileUpload (Quarkus) */
    public Resources uploadPoster(org.jboss.resteasy.reactive.multipart.FileUpload file) {
        try {
            // Per-image size cap, separate from the global body limit. We
            // check before reading bytes so a large file is rejected as
            // cheaply as possible.
            if (file.size() > MAX_POSTER_BYTES) {
                throw new IllegalArgumentException(
                        "Slika je prevelika. Maksimum: " + (MAX_POSTER_BYTES / (1024 * 1024)) + " MB.");
            }

            // Ensure bucket exists (no-op if it already does)
            boolean exists = minio.bucketExists(
                    io.minio.BucketExistsArgs.builder().bucket(bucket).build()
            );
            if (!exists) {
                minio.makeBucket(io.minio.MakeBucketArgs.builder().bucket(bucket).build());
            }

            java.nio.file.Path path = file.uploadedFile();
            try (java.io.InputStream in = java.nio.file.Files.newInputStream(path)) {
                String originalName = file.fileName();
                String ext = sanitizeExt(org.apache.commons.io.FilenameUtils.getExtension(originalName));
                // Reject anything that didn't make it through the whitelist. Without this
                // a client could upload `evil.html` and we'd store it as `bin`, then later
                // serve it back from the public bucket with whatever Content-Type they
                // chose — see contentTypeForExt() below for the safe-list mapping.
                if ("bin".equals(ext)) {
                    throw new IllegalArgumentException(
                            "Unsupported image type. Allowed: jpg, jpeg, png, webp.");
                }
                String objectKey = buildObjectKey(ext);

                // SECURITY: derive the stored Content-Type from the validated extension
                // — never trust the client-supplied file.contentType(). Combined with
                // X-Content-Type-Options: nosniff at the proxy, this means the browser
                // will only ever render uploads as images.
                String safeContentType = contentTypeForExt(ext);

                var put = io.minio.PutObjectArgs.builder()
                        .bucket(bucket)
                        .object(objectKey)
                        .contentType(safeContentType)
                        // Force inline image disposition; browsers will not execute
                        // this even if the bytes happen to look like HTML.
                        // (MinIO 8.5 has BaseArgs.Builder.extraHeaders(Map<String,String>);
                        //  headers(...) takes a Guava Multimap, which we don't import.)
                        .extraHeaders(java.util.Map.of(
                                "Content-Disposition", "inline",
                                "X-Content-Type-Options", "nosniff"
                        ))
                        .stream(in, file.size(), -1)
                        .build();

                var result = minio.putObject(put);

                Resources r = new Resources();
                r.setBucketName(bucket);
                r.setObjectKey(objectKey);
                r.setContentType(safeContentType);
                r.setSizeBytes(file.size());
                r.setEtag(result.etag());
                // publicUrl is intentionally left null. The MinIO bucket is
                // private; the SPA fetches images via the backend proxy at
                // /api/resources/{id}/image, which TournamentMapper.publicUrl()
                // computes from the resource id. Older rows may still have a
                // MinIO URL stored here from before this change — that's fine,
                // the mapper ignores the column either way.
                r.setCreatedAt(java.time.OffsetDateTime.now());
                r.setUpdatedAt(java.time.OffsetDateTime.now());

                // JSON metadata (requires Resources.metadata mapped as @JdbcTypeCode(SqlTypes.JSON))
                com.fasterxml.jackson.databind.node.ObjectNode meta = objectMapper.createObjectNode();
                if (originalName != null) meta.put("originalFilename", originalName);
                meta.put("kind", "poster");
                meta.put("uploadedAt", java.time.OffsetDateTime.now().toString());
                r.setMetadata(meta);

                return resourcesRepo.save(r);
            }
        } catch (io.minio.errors.MinioException me) {
            throw new RuntimeException("MinIO error: " + me.getMessage(), me);
        } catch (IllegalArgumentException iae) {
            // Don't wrap — let the IllegalArgumentExceptionMapper turn this into 400.
            throw iae;
        } catch (Exception e) {
            throw new RuntimeException("Failed to upload poster", e);
        }
    }

    private String sanitizeExt(String ext) {
        if (ext == null) return "bin";
        String e = ext.toLowerCase();
        return switch (e) {
            case "jpg", "jpeg" -> "jpg";
            case "png" -> "png";
            case "webp" -> "webp";
            default -> "bin";
        };
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
            case "webp" -> "image/webp";
            // Should be unreachable — uploadPoster() rejects "bin" before this point —
            // but keep the fallback restrictive just in case.
            default -> "application/octet-stream";
        };
    }

    private String buildObjectKey(String ext) {
        // e.g. posters/ab/uuid.jpg
        String id = UUID.randomUUID().toString();
        return "posters/%s/%s.%s".formatted(id.substring(0, 2), id, ext);
    }
}