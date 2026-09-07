package hr.mrodek.apps.bela_turniri.realtime;

import hr.mrodek.apps.bela_turniri.repository.TournamentsRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

import java.util.UUID;

/**
 * "Does this tournament uuid actually exist?", callable from the websocket
 * handshake path.
 *
 * <h2>Why not {@code TournamentAccess.load}</h2>
 * {@link hr.mrodek.apps.bela_turniri.services.TournamentAccess#load} is
 * written for JAX-RS resource methods: it throws
 * {@link jakarta.ws.rs.NotFoundException} (meaningless outside a JAX-RS
 * request — there is no exception mapper on the upgrade path to turn it into
 * a response), it also accepts slugs (the socket path is uuid-only by
 * contract), and it resolves its 404 message through {@code MessageService}
 * → {@code RequestLocale}, a {@code @RequestScoped} bean. Verified rather
 * than assumed: the HTTP-upgrade handler runs before any JAX-RS request
 * scope exists, and websockets-next explicitly forbids {@code @RequestScoped}
 * beans in an {@code HttpUpgradeCheck}. So the lookup goes straight to the
 * repository here.
 *
 * <h2>Why a new transaction</h2>
 * There is no ambient transaction on the handshake path, and Quarkus'
 * transaction-scoped {@code EntityManager} needs either a transaction or a
 * CDI request context — neither is there. {@code REQUIRES_NEW} supplies the
 * first, which is also the correct semantics: this read must not join, or be
 * rolled back with, anything else.
 *
 * <p>{@code Tournaments} carries {@code @SQLRestriction("is_deleted =
 * false")} at class level, so a soft-deleted tournament is simply not found
 * here and its socket is refused like any unknown uuid.
 */
@ApplicationScoped
public class LiveTournamentResolver {

    @Inject TournamentsRepository tournamentsRepo;

    /**
     * True when {@code uuid} names a live (non-deleted) tournament.
     *
     * <p><b>Blocking.</b> Callers on a Vert.x event loop must offload it —
     * see {@link LiveUpgradeCheck}.
     */
    @Transactional(Transactional.TxType.REQUIRES_NEW)
    public boolean exists(UUID uuid) {
        return uuid != null && tournamentsRepo.existsByUuid(uuid);
    }
}
