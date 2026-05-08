package hr.mrodek.apps.bela_turniri.repository;

import hr.mrodek.apps.bela_turniri.model.UserProfile;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.Collection;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@ApplicationScoped
public class UserProfileRepository implements PanacheRepositoryBase<UserProfile, String> {

    public Optional<UserProfile> findByUid(String uid) {
        return findByIdOptional(uid);
    }

    public Optional<UserProfile> findBySlug(String slug) {
        if (slug == null || slug.isBlank()) return Optional.empty();
        return find("slug", slug.trim()).firstResultOptional();
    }

    /**
     * Bulk-load profiles for a collection of UIDs (used to enrich pair lists
     * with submitter display names + slugs without N+1 queries). Empty input
     * returns an empty map without hitting the DB.
     */
    public Map<String, UserProfile> findByUids(Collection<String> uids) {
        if (uids == null || uids.isEmpty()) return Map.of();
        return list("userUid in ?1", uids).stream()
                .collect(Collectors.toMap(UserProfile::getUserUid, p -> p));
    }

    /** True when some other user already owns this slug. */
    public boolean slugTaken(String slug) {
        if (slug == null || slug.isBlank()) return false;
        return count("slug", slug) > 0;
    }
}
