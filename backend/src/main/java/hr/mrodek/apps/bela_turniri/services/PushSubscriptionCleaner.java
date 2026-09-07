package hr.mrodek.apps.bela_turniri.services;

import hr.mrodek.apps.bela_turniri.repository.PushSubscriptionRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.jboss.logging.Logger;

import java.time.OffsetDateTime;

/**
 * Tiny write-side helper for {@link PushService}'s background sender.
 *
 * <p>The sends happen on a worker thread AFTER the caller's transaction
 * has committed, so there is no transaction to join — every write here
 * opens its own short one ({@code REQUIRES_NEW}). It lives in a separate
 * bean on purpose: {@code @Transactional} is implemented by a CDI
 * interceptor, which is bypassed on a self-invocation inside
 * {@code PushService}.
 *
 * <p>Nothing here throws: a bookkeeping failure must never take down a
 * notification fan-out.
 */
@ApplicationScoped
public class PushSubscriptionCleaner {

    private static final Logger LOG = Logger.getLogger(PushSubscriptionCleaner.class);

    @Inject PushSubscriptionRepository subRepo;

    /** Stamp lastSeenAt after a successful delivery. */
    @Transactional(Transactional.TxType.REQUIRES_NEW)
    public void markSeen(Long subscriptionId) {
        if (subscriptionId == null) return;
        try {
            subRepo.findByIdOptional(subscriptionId)
                    .ifPresent(s -> s.setLastSeenAt(OffsetDateTime.now()));
        } catch (Exception e) {
            LOG.debugf(e, "Push: could not stamp lastSeenAt for subscription %d", subscriptionId);
        }
    }

    /**
     * Drop a subscription the push service reported as gone (404 / 410) —
     * the spec's way of saying "this browser is done, stop sending".
     */
    @Transactional(Transactional.TxType.REQUIRES_NEW)
    public void deleteById(Long subscriptionId) {
        if (subscriptionId == null) return;
        try {
            subRepo.deleteById(subscriptionId);
        } catch (Exception e) {
            LOG.debugf(e, "Push: could not delete expired subscription %d", subscriptionId);
        }
    }
}
