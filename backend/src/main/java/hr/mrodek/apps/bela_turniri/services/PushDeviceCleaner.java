package hr.mrodek.apps.bela_turniri.services;

import hr.mrodek.apps.bela_turniri.repository.PushDeviceRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.jboss.logging.Logger;

import java.time.OffsetDateTime;

/**
 * Write-side helper for the native (FCM) half of {@link PushService}'s
 * background sender — the exact counterpart of
 * {@link PushSubscriptionCleaner}, and it exists for the same two reasons:
 * the sends run after the caller's transaction has committed (so every write
 * here opens its own {@code REQUIRES_NEW} one), and {@code @Transactional} is
 * a CDI interceptor that a self-invocation inside {@code PushService} would
 * bypass.
 *
 * <p>Nothing here throws: bookkeeping must never take down a fan-out.
 */
@ApplicationScoped
public class PushDeviceCleaner {

    private static final Logger LOG = Logger.getLogger(PushDeviceCleaner.class);

    @Inject PushDeviceRepository deviceRepo;

    /** Stamp lastSeenAt after FCM accepted a message. */
    @Transactional(Transactional.TxType.REQUIRES_NEW)
    public void markSeen(Long deviceId) {
        if (deviceId == null) return;
        try {
            deviceRepo.findByIdOptional(deviceId)
                    .ifPresent(d -> d.setLastSeenAt(OffsetDateTime.now()));
        } catch (Exception e) {
            LOG.debugf(e, "Push: could not stamp lastSeenAt for device %d", deviceId);
        }
    }

    /**
     * Drop a device FCM reported as gone (UNREGISTERED) or unusable
     * (INVALID_ARGUMENT) — the FCM equivalent of Web Push's 404/410.
     */
    @Transactional(Transactional.TxType.REQUIRES_NEW)
    public void deleteById(Long deviceId) {
        if (deviceId == null) return;
        try {
            deviceRepo.deleteById(deviceId);
        } catch (Exception e) {
            LOG.debugf(e, "Push: could not delete dead device %d", deviceId);
        }
    }
}
