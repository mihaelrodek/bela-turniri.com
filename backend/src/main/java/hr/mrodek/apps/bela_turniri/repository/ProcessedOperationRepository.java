package hr.mrodek.apps.bela_turniri.repository;

import hr.mrodek.apps.bela_turniri.model.ProcessedOperation;
import jakarta.enterprise.context.ApplicationScoped;

import java.time.OffsetDateTime;
import java.util.Optional;

@ApplicationScoped
public class ProcessedOperationRepository implements AppRepository<ProcessedOperation, Long> {

    public Optional<ProcessedOperation> findByClientOpId(String clientOpId) {
        return find("clientOpId = ?1", clientOpId).firstResultOptional();
    }

    /**
     * Stamp the outcome onto the claim row inserted before the work ran.
     * A bulk update rather than a managed-entity mutation: the claim is
     * inserted with native SQL (ON CONFLICT DO NOTHING) and therefore is
     * not in the persistence context.
     */
    public int recordOutcome(String clientOpId, int httpStatus, String responseBody) {
        return update("httpStatus = ?1, responseBody = ?2 where clientOpId = ?3",
                httpStatus, responseBody, clientOpId);
    }

    /** Prune replay markers older than the cutoff. Returns the number deleted. */
    public long deleteOlderThan(OffsetDateTime cutoff) {
        return delete("createdAt < ?1", cutoff);
    }
}
