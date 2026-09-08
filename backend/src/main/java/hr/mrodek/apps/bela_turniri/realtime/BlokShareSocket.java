package hr.mrodek.apps.bela_turniri.realtime;

import io.quarkus.websockets.next.OnClose;
import io.quarkus.websockets.next.OnOpen;
import io.quarkus.websockets.next.OnTextMessage;
import io.quarkus.websockets.next.WebSocket;
import io.quarkus.websockets.next.WebSocketConnection;
import io.smallrye.common.annotation.NonBlocking;
import jakarta.inject.Inject;

/**
 * Realtime "this shared scorepad changed" channel — {@code BLOK-HISTORY.md}
 * §5.7.
 *
 * <p>Someone holding a share link ({@code /blok/z/{token}}) opens exactly one
 * connection, scoped to the scorepad the link points at, and only listens. The
 * server pushes a tiny {@code {"type":"live-update","scope":"blok"}} frame
 * whenever that series' record commits a change — the player saved another
 * game, or the owner revoked the link. On receipt the client refetches the
 * same public {@code GET /blok-share/{token}} it already used to draw the
 * page, so the socket never has to know a DTO shape and polling stays as the
 * fallback for a client that cannot hold a socket.
 *
 * <p>This is the blok twin of {@link LiveSocket} and follows it deliberately
 * closely; the differences are all consequences of the key being a
 * <em>secret</em> rather than a public uuid, and are called out below.
 *
 * <h2>Why the path carries the share token</h2>
 * One connection per shared scorepad rather than one firehose: a viewer of one
 * scorepad never learns that another exists, and no client-side filtering is
 * needed — every frame that arrives is by construction for the page that is
 * open. The token is also the only thing the server could key on: a viewer has
 * no account, and the record's uuid is exactly what the public read refuses to
 * accept (see {@code BlokShareController}).
 *
 * <h2>Why there is no authentication</h2>
 * The same reason as {@link LiveSocket}, and one more. The frame carries no
 * data at all, only "refetch"; everything the client then reads goes through
 * {@code GET /blok-share/{token}}, which validates the token itself and answers
 * 404 the moment it is revoked. And the token in this path is <b>the same
 * secret that is already in the link the viewer followed</b> — holding it is
 * what being allowed to read this scorepad means, so there is nothing further
 * to authenticate with and nothing new is disclosed by using it as a socket
 * key.
 *
 * <h2>What IS checked</h2>
 * The token must be well-formed <em>and must currently name a shared series</em>,
 * and the server must be under its connection caps — all enforced by
 * {@link BlokShareUpgradeCheck} <em>before</em> the handshake completes,
 * because an {@code @OnOpen} rejection would still have paid for a completed
 * upgrade. So an invented or already-revoked token is refused with 404 rather
 * than accepted and left silent forever. Open sockets are indexed by token in
 * {@link BlokShareConnections} so a broadcast costs the size of that scorepad's
 * audience rather than the size of the server.
 *
 * <h2>Verified public path</h2>
 * websockets-next registers its routes UNDER {@code quarkus.http.root-path},
 * which is {@code /api} here, so the backend serves
 * <strong>{@code /api/live/blok/{token}}</strong> and clients use the public
 * URL <strong>{@code /ws/live/blok/{token}}</strong>. Verified rather than
 * assumed, by a real handshake against the packaged app in
 * {@code BlokShareSocketTest}: an upgrade request to
 * {@code /live/blok/{token}} answers 404, one to {@code /api/live/blok/{token}}
 * with a live token answers 101 Switching Protocols, and one with an unknown
 * or revoked token answers 404.
 *
 * <p>Both proxies already rewrite the public URL with no change of their own:
 * Caddy's {@code handle_path /ws/*} strips {@code /ws} and rewrites to
 * {@code /api{uri}}, and the Vite dev proxy's {@code "/ws"} entry replaces the
 * same prefix with {@code /api}. Neither has a pattern that could catch
 * {@code /ws/live/blok/...} earlier — the only handler ahead of the generic one
 * is {@code /ws/game*}. Nor does this path collide with
 * {@link LiveSocket}'s {@code /live/{tournamentUuid}}: a Vert.x path parameter
 * never spans a {@code /}, so a two-segment path can only match this endpoint.
 */
@WebSocket(path = "/live/blok/{token}", endpointId = BlokShareSocket.ENDPOINT_ID)
public class BlokShareSocket {

    /**
     * Stable endpoint id. Set explicitly rather than defaulting to the class
     * FQCN so {@link BlokShareUpgradeCheck#appliesTo(String)} matches on a
     * value that a package rename cannot silently break.
     */
    public static final String ENDPOINT_ID = "live-blok-share";

    /** Path param name — must match the {@code @WebSocket} path above. */
    static final String PATH_PARAM = "token";

    @Inject
    BlokShareConnections connections;

    /**
     * Index the connection under its share token. By the time this runs the
     * token has already been shape-checked and resolved against the database
     * by {@link BlokShareUpgradeCheck}, so it is a real, currently live share
     * token.
     *
     * <p>{@code @NonBlocking} because this is a single map insert: without it
     * websockets-next treats the callback as blocking and hops to a worker
     * thread for every connection, which both costs a dispatch per open and
     * widens the window in which a just-accepted socket is not yet visible to
     * the connection counters {@link BlokShareUpgradeCheck} reads.
     */
    @NonBlocking
    @OnOpen
    public void onOpen(WebSocketConnection connection) {
        connections.register(connection.pathParam(PATH_PARAM), connection);
    }

    /**
     * Drop the connection from the index. Called for every close, clean or
     * abrupt (websockets-next hangs this off Vert.x's close handler) — including
     * the close {@link BlokShareBroadcaster} performs itself when the owner
     * revokes the link. That is what keeps the index, and the connection
     * counters the upgrade check reads, from drifting upward over time.
     */
    @NonBlocking
    @OnClose
    public void onClose(WebSocketConnection connection) {
        connections.unregister(connection.pathParam(PATH_PARAM), connection);
    }

    /**
     * Clients never send anything meaningful. Inbound text is ignored rather
     * than echoed on purpose: an echo would turn any single viewer into a
     * fan-out amplifier for every other viewer of the same scorepad.
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
