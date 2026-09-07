package hr.mrodek.apps.bela_turniri.realtime;

import io.quarkus.websockets.next.OnClose;
import io.quarkus.websockets.next.OnOpen;
import io.quarkus.websockets.next.OnTextMessage;
import io.quarkus.websockets.next.WebSocket;
import io.quarkus.websockets.next.WebSocketConnection;
import io.smallrye.common.annotation.NonBlocking;
import jakarta.inject.Inject;

/**
 * Realtime "something changed in this tournament" channel.
 *
 * <p>A tournament page opens exactly one connection, scoped to the tournament
 * it is showing, and only listens. The server pushes a tiny
 * {@code {"type":"live-update","tournamentUuid":..,"scope":..}} frame whenever
 * a spectator-visible write commits (score, round draw/finish, pair roster,
 * tournament status, drinks bill, repassage). On receipt the client refetches
 * the same REST endpoints its poll already uses, so the socket never has to
 * know about DTO shapes and the poll stays as a fallback for clients that
 * can't hold a socket (old browser, proxy stripping the upgrade).
 *
 * <h2>Why the path carries the tournament uuid</h2>
 * One connection per tournament instead of one firehose for everybody:
 * a viewer of tournament A never learns that tournament B exists or is
 * active, and no client-side filtering is needed — every frame that arrives
 * is by construction for the page that is open.
 *
 * <h2>Why there is no authentication</h2>
 * The frame carries no data at all, only "refetch". Everything the client
 * then reads goes through the normal REST endpoints, which are
 * permission-checked exactly as before. Knowing that a tournament you already
 * have the uuid of changed is not privileged information.
 *
 * <h2>What IS checked</h2>
 * The uuid must resolve to a live tournament and the server must be under
 * its connection caps — both enforced by {@link LiveUpgradeCheck} <em>before</em>
 * the handshake completes, because an {@code @OnOpen} rejection would still
 * have paid for a completed upgrade. Open sockets are indexed by tournament
 * in {@link LiveConnections} so a broadcast costs the size of the audience
 * rather than the size of the server.
 *
 * <h2>Verified public path</h2>
 * websockets-next registers its routes UNDER {@code quarkus.http.root-path},
 * which is {@code /api} here, so the backend actually serves
 * <strong>{@code /api/live/{tournamentUuid}}</strong> — verified empirically
 * against the packaged app (a handshake to {@code /live/{uuid}} answers 404,
 * one to {@code /api/live/{uuid}} answers 101 Switching Protocols).
 * Clients use the stable public URL {@code /ws/live/{uuid}}; both proxies
 * rewrite it to {@code /api/live/{uuid}} (Caddy in prod, Vite in dev).
 */
@WebSocket(path = "/live/{tournamentUuid}", endpointId = LiveSocket.ENDPOINT_ID)
public class LiveSocket {

    /**
     * Stable endpoint id. Set explicitly rather than defaulting to the class
     * FQCN so {@link LiveUpgradeCheck#appliesTo(String)} matches on a value
     * that a package rename cannot silently break.
     */
    public static final String ENDPOINT_ID = "live-tournament";

    /** Path param name — must match the {@code @WebSocket} path above. */
    static final String PATH_PARAM = "tournamentUuid";

    @Inject
    LiveConnections liveConnections;

    /**
     * Index the connection under its tournament. By the time this runs the
     * uuid has already been validated by {@link LiveUpgradeCheck}, so the
     * path param is a real tournament's uuid.
     *
     * <p>{@code @NonBlocking} because this is a single map insert: without
     * it websockets-next treats the callback as blocking and hops to a
     * worker thread for every connection, which both costs a dispatch per
     * open and widens the window in which a just-accepted socket is not yet
     * visible to the connection counters {@link LiveUpgradeCheck} reads.
     */
    @NonBlocking
    @OnOpen
    public void onOpen(WebSocketConnection connection) {
        liveConnections.register(connection.pathParam(PATH_PARAM), connection);
    }

    /**
     * Drop the connection from the index. Called for every close, clean or
     * abrupt (websockets-next hangs this off Vert.x's close handler), which
     * is what keeps the index — and the connection counters the upgrade
     * check reads — from drifting upward over time. {@code @NonBlocking}
     * for the same reason as {@link #onOpen(WebSocketConnection)}.
     */
    @NonBlocking
    @OnClose
    public void onClose(WebSocketConnection connection) {
        liveConnections.unregister(connection.pathParam(PATH_PARAM), connection);
    }

    /**
     * Clients never send anything meaningful. Inbound text is ignored rather
     * than echoed on purpose: an echo would turn any single client into a
     * fan-out amplifier for every other viewer of the same tournament.
     * Swallowing it also keeps a stray keep-alive frame from erroring the
     * connection. {@code @NonBlocking} keeps a client that spams frames from
     * consuming a worker thread per frame just to have it thrown away.
     */
    @NonBlocking
    @OnTextMessage
    public void onMessage(String message) {
        // ignore
    }
}
