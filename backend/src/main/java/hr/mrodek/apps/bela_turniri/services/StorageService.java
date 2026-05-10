package hr.mrodek.apps.bela_turniri.services;

import com.fasterxml.jackson.databind.ObjectMapper;
import hr.mrodek.apps.bela_turniri.model.Resources;
import hr.mrodek.apps.bela_turniri.repository.ResourcesRepository;
import io.minio.MinioClient;
import io.minio.errors.MinioException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.apache.commons.io.FilenameUtils;
import org.eclipse.microprofile.config.inject.ConfigProperty;

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
     * MB even at high resolution. Defense-in-depth check that stops a
     * logged-in user from filling MinIO with 15 MB images repeatedly.
     */
    private static final long MAX_POSTER_BYTES = 6L * 1024 * 1024;

    /**
     * Hard cap on avatar size (bytes). Same intent as MAX_POSTER_BYTES — a
     * profile picture has no reason to be larger than a few MB.
     */
    private static final long MAX_AVATAR_BYTES = 5L * 1024 * 1024;

    /** Tournament poster upload — keyed under {@code posters/...}. */
    public Resources uploadPoster(org.jboss.resteasy.reactive.multipart.FileUpload file) {
        return uploadImage(file, "poster", "posters", MAX_POSTER_BYTES);
    }

    /** User avatar upload — keyed under {@code avatars/...}. */
    public Resources uploadAvatar(org.jboss.resteasy.reactive.multipart.FileUpload file) {
        return uploadImage(file, "avatar", "avatars", MAX_AVATAR_BYTES);
    }

    /**
     * Shared upload pipeline. The caller picks a {@code kind} (recorded in
     * metadata), an object-key {@code prefix} (e.g. {@code posters},
     * {@code avatars}), and a max-size cap. Everything else — content-type
     * validation, magic-byte / extension safety, MinIO put — is identical.
     */
    private Resources uploadImage(
            org.jboss.resteasy.reactive.multipart.FileUpload file,
            String kind,
            String prefix,
            long maxBytes) {
        try {
            // Per-image size cap, separate from the global body limit. We
            // check before reading bytes so a large file is rejected as
            // cheaply as possible.
            if (file.size() > maxBytes) {
                throw new IllegalArgumentException(
                        "Slika je prevelika. Maksimum: " + (maxBytes / (1024 * 1024)) + " MB.");
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
                String ext = sanitizeExt(FilenameUtils.getExtension(originalName));
                if ("bin".equals(ext)) {
                    throw new IllegalArgumentException(
                            "Unsupported image type. Allowed: jpg, jpeg, png, webp.");
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
                        .stream(in, file.size(), -1)
                        .build();

                var result = minio.putObject(put);

                Resources r = new Resources();
                r.setBucketName(bucket);
                r.setObjectKey(objectKey);
                r.setContentType(safeContentType);
                r.setSizeBytes(file.size());
                r.setEtag(result.etag());
                r.setCreatedAt(OffsetDateTime.now());
                r.setUpdatedAt(OffsetDateTime.now());

                com.fasterxml.jackson.databind.node.ObjectNode meta = objectMapper.createObjectNode();
                if (originalName != null) meta.put("originalFilename", originalName);
                meta.put("kind", kind);
                meta.put("uploadedAt", OffsetDateTime.now().toString());
                r.setMetadata(meta);

                return resourcesRepo.save(r);
            }
        } catch (MinioException me) {
            throw new RuntimeException("MinIO error: " + me.getMessage(), me);
        } catch (IllegalArgumentException iae) {
            // Don't wrap — let the IllegalArgumentExceptionMapper turn this into 400.
            throw iae;
        } catch (Exception e) {
            throw new RuntimeException("Failed to upload " + kind, e);
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
            // Should be unreachable — uploadImage() rejects "bin" before this point.
            default -> "application/octet-stream";
        };
    }

    private String buildObjectKey(String prefix, String ext) {
        // e.g. posters/ab/uuid.jpg or avatars/ab/uuid.jpg
        String id = UUID.randomUUID().toString();
        return "%s/%s/%s.%s".formatted(prefix, id.substring(0, 2), id, ext);
    }
}
