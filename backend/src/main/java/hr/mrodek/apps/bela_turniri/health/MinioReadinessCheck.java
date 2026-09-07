package hr.mrodek.apps.bela_turniri.health;

import io.minio.BucketExistsArgs;
import io.minio.MinioClient;
import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.health.HealthCheck;
import org.eclipse.microprofile.health.HealthCheckResponse;
import org.eclipse.microprofile.health.Readiness;

import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * Readiness probe for MinIO, exposed at {@code GET /api/q/health/ready}
 * (root-path is {@code /api}) alongside the datasource check Quarkus wires
 * up automatically. Before this class existed, {@code /q/health/ready}
 * only ever reflected Postgres — the docker-compose backend healthcheck
 * comment claimed it also covered "the MinIO connection pool", which
 * wasn't true; this makes that comment accurate.
 *
 * <p>Deliberately cheap: {@code bucketExists} is a single HEAD-style call,
 * never a listing, and runs with a short timeout so a hung MinIO doesn't
 * also hang the readiness probe past the 5s the prod healthcheck allows
 * (see {@code docker-compose.prod.yaml}).
 */
@Readiness
@ApplicationScoped
public class MinioReadinessCheck implements HealthCheck {

    private static final String NAME = "minio";
    private static final long TIMEOUT_SECONDS = 3;

    @Inject
    MinioClient minio;

    @ConfigProperty(name = "minio.bucket")
    String bucket;

    // A single daemon-ish thread just to bound bucketExists() with a
    // timeout — the MinIO SDK offers no per-call timeout of its own, and
    // this check runs infrequently (health-probe cadence), so a small
    // dedicated pool is cheaper than spinning one up per invocation.
    private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "minio-readiness-check");
        t.setDaemon(true);
        return t;
    });

    @Override
    public HealthCheckResponse call() {
        Callable<Boolean> probe = () -> minio.bucketExists(
                BucketExistsArgs.builder().bucket(bucket).build());

        Future<Boolean> future = executor.submit(probe);
        try {
            boolean exists = future.get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
            return exists
                    ? HealthCheckResponse.named(NAME).up().build()
                    : HealthCheckResponse.named(NAME).down()
                            .withData("reason", "bucket '" + bucket + "' does not exist")
                            .build();
        } catch (TimeoutException e) {
            future.cancel(true);
            return HealthCheckResponse.named(NAME).down()
                    .withData("reason", "timed out after " + TIMEOUT_SECONDS + "s")
                    .build();
        } catch (Exception e) {
            Throwable cause = e.getCause() != null ? e.getCause() : e;
            return HealthCheckResponse.named(NAME).down()
                    .withData("reason", String.valueOf(cause.getMessage()))
                    .build();
        }
    }

    @PreDestroy
    void shutdown() {
        executor.shutdownNow();
    }
}
