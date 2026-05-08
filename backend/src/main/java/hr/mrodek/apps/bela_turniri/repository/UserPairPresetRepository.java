package hr.mrodek.apps.bela_turniri.repository;

import hr.mrodek.apps.bela_turniri.model.UserPairPreset;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class UserPairPresetRepository implements AppRepository<UserPairPreset, Long> {

    public List<UserPairPreset> findByUserUid(String uid) {
        return list("userUid = ?1", Sort.by("name").ascending(), uid);
    }

    public Optional<UserPairPreset> findByUuidAndUserUid(UUID uuid, String uid) {
        return find("uuid = ?1 and userUid = ?2", uuid, uid).firstResultOptional();
    }

    /** Case-insensitive lookup used to dedupe before auto-saving on self-register. */
    public Optional<UserPairPreset> findByUserUidAndNameIgnoreCase(String uid, String name) {
        if (uid == null || name == null) return Optional.empty();
        return find("userUid = ?1 and lower(name) = ?2", uid, name.trim().toLowerCase())
                .firstResultOptional();
    }
}
