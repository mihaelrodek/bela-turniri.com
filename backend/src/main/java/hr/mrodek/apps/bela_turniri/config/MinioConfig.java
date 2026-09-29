package hr.mrodek.apps.bela_turniri.config;

import io.minio.MinioClient;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.util.Optional;

@ApplicationScoped
public class MinioConfig {

    @ConfigProperty(name = "minio.endpoint")
    String endpoint;

    @ConfigProperty(name = "minio.accessKey")
    String accessKey;

    @ConfigProperty(name = "minio.secretKey")
    String secretKey;

    /** "auto" for Cloudflare R2. Setting it also stops the client from
     *  asking the server for the bucket location before the first call. */
    @ConfigProperty(name = "minio.region")
    Optional<String> region;

    @Produces
    @ApplicationScoped
    public MinioClient minioClient() {
        MinioClient.Builder builder = MinioClient.builder()
                .endpoint(endpoint)
                .credentials(accessKey, secretKey);
        region.filter(r -> !r.isBlank()).ifPresent(builder::region);
        return builder.build();
    }
}
