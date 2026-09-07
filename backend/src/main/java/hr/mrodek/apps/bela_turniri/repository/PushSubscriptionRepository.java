package hr.mrodek.apps.bela_turniri.repository;

import hr.mrodek.apps.bela_turniri.model.PushSubscription;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;
import java.util.Optional;

@ApplicationScoped
public class PushSubscriptionRepository implements AppRepository<PushSubscription, Long> {

    public List<PushSubscription> findByUserUid(String uid) {
        if (uid == null || uid.isBlank()) return List.of();
        return list("userUid", uid);
    }

    public Optional<PushSubscription> findByEndpoint(String endpoint) {
        if (endpoint == null || endpoint.isBlank()) return Optional.empty();
        return find("endpoint", endpoint).firstResultOptional();
    }

    public void deleteByEndpoint(String endpoint) {
        if (endpoint == null || endpoint.isBlank()) return;
        delete("endpoint", endpoint);
    }

    /**
     * Endpoint-scoped delete that also requires ownership. Endpoints are
     * unguessable, but "unguessable" is not an authorisation model — a
     * leaked endpoint (they show up in client-side logs and bug reports)
     * shouldn't let a third party silence someone else's device.
     *
     * @return number of rows removed (0 when the endpoint belongs to someone else)
     */
    public long deleteByEndpointAndUser(String endpoint, String uid) {
        if (endpoint == null || endpoint.isBlank()) return 0;
        if (uid == null || uid.isBlank()) return 0;
        return delete("endpoint = ?1 and userUid = ?2", endpoint, uid);
    }
}
