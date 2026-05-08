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
import java.nio.charset.StandardCharsets;
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

    @ConfigProperty(name = "minio.publicBaseUrl")
    String publicBaseUrl;

    /** Upload using RESTEasy Reactive FileUpload (Quarkus) */
    public Resources uploadPoster(org.jboss.resteasy.reactive.multipart.FileUpload file) {
        try {
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
                String objectKey = buildObjectKey(ext);

                var put = io.minio.PutObjectArgs.builder()
                        .bucket(bucket)
                        .object(objectKey)
                        .contentType(file.contentType() != null ? file.contentType() : "application/octet-stream")
                        .stream(in, file.size(), -1)
                        .build();

                var result = minio.putObject(put);

                Resources r = new Resources();
                r.setBucketName(bucket);
                r.setObjectKey(objectKey);
                r.setContentType(file.contentType());
                r.setSizeBytes(file.size());
                r.setEtag(result.etag());
                r.setPublicUrl(buildPublicUrl(objectKey));
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

    private String buildObjectKey(String ext) {
        // e.g. posters/ab/uuid.jpg
        String id = UUID.randomUUID().toString();
        return "posters/%s/%s.%s".formatted(id.substring(0, 2), id, ext);
    }

    private String buildPublicUrl(String objectKey) {
        String encodedKey = java.net.URLEncoder
                .encode(objectKey, StandardCharsets.UTF_8)
                .replace("+", "%20")
                .replace("%2F", "/"); // keep slashes
        return "%s/%s/%s".formatted(
                publicBaseUrl.replaceAll("/+$", ""),
                bucket,
                encodedKey
        );
    }
}