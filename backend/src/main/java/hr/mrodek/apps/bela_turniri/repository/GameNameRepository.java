package hr.mrodek.apps.bela_turniri.repository;

import hr.mrodek.apps.bela_turniri.model.GameName;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.Optional;

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
}
