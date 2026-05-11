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
}
