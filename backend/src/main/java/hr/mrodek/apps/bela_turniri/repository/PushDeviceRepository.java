package hr.mrodek.apps.bela_turniri.repository;

import hr.mrodek.apps.bela_turniri.model.PushDevice;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;
import java.util.Optional;

/**
 * Native (FCM) push registrations. Mirrors
 * {@link PushSubscriptionRepository} one-for-one so the two delivery paths
 * read the same way at the call site.
 */
@ApplicationScoped
public class PushDeviceRepository implements AppRepository<PushDevice, Long> {

    public List<PushDevice> findByUserUid(String uid) {
        if (uid == null || uid.isBlank()) return List.of();
        return list("userUid", uid);
    }

    public Optional<PushDevice> findByToken(String token) {
        if (token == null || token.isBlank()) return Optional.empty();
        return find("token", token).firstResultOptional();
    }

    /**
     * Token-scoped delete that also requires ownership. Same reasoning as
     * {@link PushSubscriptionRepository#deleteByEndpointAndUser}: an FCM
     * token is unguessable, but "unguessable" is not an authorisation model,
     * and a token leaked through a crash report must not let a third party
     * silence someone else's phone.
     *
     * @return number of rows removed (0 when the token belongs to someone else)
     */
    public long deleteByTokenAndUser(String token, String uid) {
        if (token == null || token.isBlank()) return 0;
        if (uid == null || uid.isBlank()) return 0;
        return delete("token = ?1 and userUid = ?2", token, uid);
    }
}
