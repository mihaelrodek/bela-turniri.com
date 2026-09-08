package hr.mrodek.apps.bela_turniri.realtime;

import hr.mrodek.apps.bela_turniri.repository.BlokSessionRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

/**
 * "Is this share token live right now?", callable from the websocket
 * handshake path.
 *
 * <h2>Why not {@code BlokHistoryService.getShared}</h2>
 * {@link hr.mrodek.apps.bela_turniri.services.BlokHistoryService#getShared} is
 * written for a JAX-RS resource method: it throws
 * {@link jakarta.ws.rs.NotFoundException} (meaningless outside a JAX-RS
 * request — there is no exception mapper on the upgrade path to turn it into a
 * response), it resolves that 404's message through {@code MessageService} →
 * {@code RequestLocale}, a {@code @RequestScoped} bean that does not exist on
 * the upgrade path and which websockets-next explicitly forbids an
 * {@code HttpUpgradeCheck} from touching, and it parses and reshapes the whole
 * payload — hundreds of deals — only for the answer to be thrown away. All the
 * handshake needs is a boolean, so this goes straight to the repository, the
 * same reasoning {@link LiveTournamentResolver} sets out.
 *
 * <h2>Why a new transaction</h2>
 * There is no ambient transaction on the handshake path, and Quarkus'
 * transaction-scoped {@code EntityManager} needs either a transaction or a CDI
 * request context — neither is there. {@code REQUIRES_NEW} supplies the first,
 * which is also the correct semantics: this read must not join, or be rolled
 * back with, anything else.
 *
 * <p>{@code share_token} is NULL until the owner shares and NULL again the
 * moment they revoke, so a revoked or never-shared series is simply not found
 * here and its socket is refused exactly like an invented token — which is
 * what keeps a stale link from parking a connection.
 */
@ApplicationScoped
public class BlokShareResolver {

    @Inject BlokSessionRepository repo;

    /**
     * True when {@code token} currently names a shared blok series.
     *
     * <p><b>Blocking.</b> Callers on a Vert.x event loop must offload it — see
     * {@link BlokShareUpgradeCheck}.
     */
    @Transactional(Transactional.TxType.REQUIRES_NEW)
    public boolean isShared(String token) {
        return repo.existsByShareToken(token);
    }
}
