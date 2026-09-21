package hr.mrodek.apps.bela_turniri.repository;

import hr.mrodek.apps.bela_turniri.model.GameName;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.Collection;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * The one lookup this table has: by the game server's player id, which is
 * also its primary key.
 */
@ApplicationScoped
public class GameNameRepository implements AppRepository<GameName, String> {

    /**
     * @param gameUid a Firebase UID or {@code guest:<64 hex>}; callers pass
     *                only values {@code GameNameService} has already checked
     *                the shape of.
     */
    public Optional<GameName> findByGameUid(String gameUid) {
        if (gameUid == null || gameUid.isBlank()) return Optional.empty();
        return findByIdOptional(gameUid);
    }

    /**
     * The same lookup for many ids at once, so a list of players costs one
     * query instead of one per row. Uids with no chosen name are simply
     * absent from the map.
     */
    public Map<String, String> namesByGameUid(Collection<String> gameUids) {
        if (gameUids == null || gameUids.isEmpty()) return Map.of();
        return list("gameUid in ?1", gameUids).stream()
                .collect(Collectors.toMap(GameName::getGameUid, GameName::getName));
    }
}
