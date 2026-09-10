package hr.mrodek.apps.bela_turniri.realtime;

import hr.mrodek.apps.bela_turniri.dtos.BlokDeclarationsDto;
import hr.mrodek.apps.bela_turniri.dtos.BlokGameDto;
import hr.mrodek.apps.bela_turniri.dtos.BlokNamesDto;
import hr.mrodek.apps.bela_turniri.dtos.BlokRoundDto;
import hr.mrodek.apps.bela_turniri.dtos.BlokScoresDto;
import hr.mrodek.apps.bela_turniri.dtos.BlokSessionDto;
import hr.mrodek.apps.bela_turniri.dtos.SaveBlokSessionRequest;
import hr.mrodek.apps.bela_turniri.repository.BlokSessionRepository;
import hr.mrodek.apps.bela_turniri.services.BlokHistoryService;
import hr.mrodek.apps.bela_turniri.services.ClaimTokens;
import hr.mrodek.apps.bela_turniri.services.CurrentUser;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.websockets.next.HttpUpgradeCheck;
import io.quarkus.websockets.next.WebSocketConnection;
import io.smallrye.mutiny.Uni;
import io.vertx.core.http.HttpServerRequest;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The shared-scorepad realtime channel — {@code BLOK-HISTORY.md} §5.7.
 *
 * <p><b>What a test can and cannot prove here.</b> Nothing in this build
 * speaks the websocket wire protocol, so the handshake itself, the frame
 * arriving in a browser and the reconnect behaviour are out of reach. What is
 * reachable is everything on <em>this</em> side of the socket, and that is
 * where the failure modes live:
 *
 * <ol>
 *   <li><b>The upgrade is refused for a token that names nothing</b> — invented,
 *       mistyped, or revoked while the link sat in someone's chat. Driven
 *       through the real {@link BlokShareUpgradeCheck#perform}, against the
 *       real database, so the 404 is the one a client would actually get; and
 *       permitted for a token that is live, which is the same code path a real
 *       handshake takes minus the socket.</li>
 *   <li><b>The two upgrade checks do not poach each other's endpoints.</b> A
 *       wrong endpoint id would hand every blok handshake to
 *       {@link LiveUpgradeCheck}, which would reject the token for not being a
 *       uuid — a total outage of this feature that compiles perfectly.</li>
 *   <li><b>Subscription bookkeeping</b>: the index registers, unregisters,
 *       counts, and drops a bucket once its last viewer leaves. A leak here is
 *       invisible until the connection cap starts refusing real viewers.</li>
 *   <li><b>The ping comes from the commit hook, not from the call.</b>
 *       Asserted from inside the transaction (nothing sent yet) and after it
 *       (sent) — and a rolled-back transaction must wake nobody, which is the
 *       whole reason the {@code Synchronization} exists.</li>
 *   <li><b>Only shared series broadcast</b>, and <b>revoking pings then
 *       closes</b>, driven through {@link BlokHistoryService} rather than the
 *       broadcaster, because the wiring between them is the part that can rot.</li>
 * </ol>
 *
 * <p>The connections are {@link Proxy} stand-ins for
 * {@link WebSocketConnection}: the interface is large, this project has no
 * mocking library, and the three methods that matter — {@code sendText},
 * {@code isClosed}, {@code close} — are all this code ever calls.
 */
@QuarkusTest
class BlokShareSocketTest {

    /** Rows written by the committing tests, cleaned up in a finally. */
    private static final String TEST_UID = "blok-live-test-uid";

    @Inject BlokShareConnections connections;
    @Inject BlokShareBroadcaster broadcaster;
    @Inject BlokShareUpgradeCheck upgradeCheck;
    @Inject LiveUpgradeCheck tournamentUpgradeCheck;
    @Inject BlokHistoryService history;
    @Inject BlokSessionRepository repo;

    /** The harness's own HTTP port — see {@link #handshakeStatus(String)}. */
    @ConfigProperty(name = "quarkus.http.test-port", defaultValue = "8081")
    int testPort;

    /** Same stand-in caller the blok history tests use. */
    public static class StubUser extends CurrentUser {
        @Override public String requireUid() { return TEST_UID; }
        @Override public Optional<String> uid() { return Optional.of(TEST_UID); }
        @Override public String uidOrNull() { return TEST_UID; }
        @Override public boolean isAnonymous() { return false; }
        @Override public boolean isAdmin() { return false; }
        @Override public String displayName() { return "Test"; }
    }

    @BeforeEach
    void installCaller() {
        QuarkusMock.installMockForType(new StubUser(), CurrentUser.class);
    }

    /* ==================== 1. token shape, before any query ==================== */

    /**
     * The path segment is refused without touching the database unless it could
     * be a {@code ClaimTokens.generate()} token. Everything a scanner throws at
     * {@code /ws/live/blok/...} dies here, at the cost of a character loop.
     */
    @Test
    void onlyABase64UrlShapedSegmentEverReachesTheDatabase() {
        String real = ClaimTokens.generate();
        assertEquals(real, BlokShareUpgradeCheck.tokenOf("/api/live/blok/" + real),
                "a genuine token was rejected by the shape check");
        assertEquals(32, real.length(), "ClaimTokens changed shape — revisit MAX_TOKEN_LENGTH");

        assertNull(BlokShareUpgradeCheck.tokenOf(null));
        assertNull(BlokShareUpgradeCheck.tokenOf(""));
        assertNull(BlokShareUpgradeCheck.tokenOf("/api/live/blok/"), "empty segment");
        assertNull(BlokShareUpgradeCheck.tokenOf("/api/live/blok/tok en"), "space");
        assertNull(BlokShareUpgradeCheck.tokenOf("/api/live/blok/tok.en"), "dot is not base64url");
        assertNull(BlokShareUpgradeCheck.tokenOf("/api/live/blok/tok+en"), "base64 standard, not url");
        assertNull(BlokShareUpgradeCheck.tokenOf("/api/live/blok/tok%2Fen"), "percent-encoded");
        assertNull(BlokShareUpgradeCheck.tokenOf("/api/live/blok/<script>"), "markup");
        assertNull(BlokShareUpgradeCheck.tokenOf("/api/live/blok/" + "x".repeat(49)),
                "longer than the share_token column can hold");

        // A uuid is made of hex and dashes, so it passes the shape gate and is
        // refused by the database instead — the same 404, one query later.
        // Asserted so the shape check is not mistaken for the security
        // boundary: the boundary is that the token names a shared series.
        assertNotNull(BlokShareUpgradeCheck.tokenOf("/api/live/blok/" + UUID.randomUUID()));

        // The token is the LAST segment, as in LiveUpgradeCheck. Anything
        // deeper cannot reach this check at all — Vert.x routes
        // /live/blok/{token}, one segment, and normalises the path first — so
        // this only pins which segment is read, not a defence.
        assertEquals("passwd", BlokShareUpgradeCheck.tokenOf("/api/live/blok/etc/passwd"));
    }

    /* ==================== 2. the checks stay on their own endpoints ==================== */

    /**
     * If these ids ever collide or drift, {@link LiveUpgradeCheck} starts
     * inspecting blok handshakes and rejects every one of them for not being a
     * uuid — a silent, total outage of the shared scorepad's realtime.
     */
    @Test
    void eachUpgradeCheckAppliesOnlyToItsOwnEndpoint() {
        assertTrue(upgradeCheck.appliesTo(BlokShareSocket.ENDPOINT_ID));
        assertFalse(upgradeCheck.appliesTo(LiveSocket.ENDPOINT_ID));

        assertTrue(tournamentUpgradeCheck.appliesTo(LiveSocket.ENDPOINT_ID));
        assertFalse(tournamentUpgradeCheck.appliesTo(BlokShareSocket.ENDPOINT_ID));

        assertNotEquals(LiveSocket.ENDPOINT_ID, BlokShareSocket.ENDPOINT_ID);
    }

    /* ==================== 3. subscription bookkeeping ==================== */

    @Test
    void theIndexRegistersUnregistersAndDropsEmptyBuckets() {
        String a = "tok-a-" + UUID.randomUUID();
        String b = "tok-b-" + UUID.randomUUID();
        FakeConnection one = new FakeConnection();
        FakeConnection two = new FakeConnection();
        FakeConnection other = new FakeConnection();

        int baseline = connections.total();
        try {
            connections.register(a, one.connection);
            connections.register(a, two.connection);
            connections.register(b, other.connection);

            assertEquals(2, connections.countFor(a), "two viewers of one scorepad");
            assertEquals(1, connections.countFor(b));
            assertEquals(baseline + 3, connections.total());

            // Registering the same connection twice must not double-count, or
            // the cap would start refusing viewers that are not there.
            connections.register(a, one.connection);
            assertEquals(2, connections.countFor(a));
            assertEquals(baseline + 3, connections.total());

            // A scorepad nobody is watching is not a key at all: a leak here is
            // what eventually eats the per-scorepad cap.
            connections.unregister(a, one.connection);
            connections.unregister(a, two.connection);
            assertEquals(0, connections.countFor(a));
            assertEquals(baseline + 1, connections.total());

            // Unregistering twice, which a close after an explicit close would
            // do, must not drive the counter negative.
            connections.unregister(a, one.connection);
            assertEquals(baseline + 1, connections.total());
        } finally {
            connections.unregister(a, one.connection);
            connections.unregister(a, two.connection);
            connections.unregister(b, other.connection);
        }
        assertEquals(baseline, connections.total(), "the index leaked a connection");
    }

    /** Nobody is watching: the broadcast is a lookup that finds nothing. */
    @Test
    void broadcastingToAnAudienceOfNobodyIsHarmless() {
        broadcaster.notifySession("tok-nobody-" + UUID.randomUUID());
        broadcaster.notifyRevoked("tok-nobody-" + UUID.randomUUID());
        broadcaster.notifySession(null);
        broadcaster.notifySession("   ");
        broadcaster.notifyRevoked(null);
    }

    /* ==================== 4. the ping is a commit hook ==================== */

    /**
     * The point of the interposed {@code Synchronization}: a viewer who
     * refetches the instant the ping lands must not be able to read pre-write
     * state, and a write that never lands must not be announced at all.
     */
    @Test
    void thePingFiresOnCommitAndNeverBeforeItOrOnRollback() {
        String token = "tok-commit-" + UUID.randomUUID();
        FakeConnection viewer = new FakeConnection();
        connections.register(token, viewer.connection);
        try {
            QuarkusTransaction.requiringNew().run(() -> {
                broadcaster.notifySession(token);
                assertTrue(viewer.sent.isEmpty(),
                        "the ping went out inside the transaction — a viewer could refetch pre-write state");
            });
            assertEquals(List.of(BlokShareBroadcaster.FRAME), List.copyOf(viewer.sent),
                    "the commit hook did not fire");
            assertFalse(viewer.closed.get(), "an ordinary change must not close the socket");

            viewer.sent.clear();
            assertThrows(IllegalStateException.class, () ->
                    QuarkusTransaction.requiringNew().run(() -> {
                        broadcaster.notifySession(token);
                        throw new IllegalStateException("rolled back on purpose");
                    }));
            assertTrue(viewer.sent.isEmpty(), "a rolled-back save woke a viewer");

            // Outside any transaction there is nothing to wait for, so it sends
            // inline — the path a future non-transactional caller would take.
            broadcaster.notifySession(token);
            assertEquals(List.of(BlokShareBroadcaster.FRAME), List.copyOf(viewer.sent));
        } finally {
            connections.unregister(token, viewer.connection);
        }
    }

    /** The frame is a constant, carries no data, and never carries the token. */
    @Test
    void theFrameSaysRefetchAndNothingElse() {
        assertEquals("{\"type\":\"live-update\",\"scope\":\"blok\"}", BlokShareBroadcaster.FRAME);
        // The SPA's useLiveSocket ignores anything whose type is not this.
        assertTrue(BlokShareBroadcaster.FRAME.contains("\"type\":\"live-update\""));
    }

    /* ==================== 5. the service end to end ==================== */

    /**
     * The whole §5.7 loop, on committed data: a shared series that grows pings
     * its viewers, the handshake for its token is permitted, revoking pings and
     * then closes, and the handshake for the revoked token is refused with the
     * same 404 the public read gives.
     *
     * <p>Not {@code @TestTransaction}: the ping is deliberately tied to a real
     * commit, and the upgrade check resolves the token in {@code REQUIRES_NEW}
     * on a worker thread, which would never see uncommitted rows. So this
     * commits for real and cleans up in a finally.
     */
    @Test
    void aSharedSeriesPingsItsViewersAndRevokingClosesThem() throws Exception {
        String sessionId = "sess-" + UUID.randomUUID();
        FakeConnection viewer = new FakeConnection();
        String token = null;
        try {
            BlokSessionDto saved = QuarkusTransaction.requiringNew()
                    .call(() -> history.save(series(sessionId, 1)));
            UUID recordUuid = saved.uuid();

            // Not shared yet: a save announces nothing, and the handshake for a
            // token nobody minted is refused.
            assertEquals(404, statusFor(ClaimTokens.generate()),
                    "an invented token was admitted to the socket");

            token = QuarkusTransaction.requiringNew().call(() -> history.share(recordUuid).token());
            connections.register(token, viewer.connection);

            assertEquals(0, statusFor(token),
                    "a live share token was refused at the handshake (0 = permitted)");
            // And over the wire, on the real route: a live token upgrades.
            assertEquals(101, handshakeStatus("/api/live/blok/" + token),
                    "the real handshake for a live share token did not switch protocols");

            // §5.1's repeated upload: the series grew by a game.
            QuarkusTransaction.requiringNew().run(() -> history.save(series(sessionId, 2)));
            assertEquals(List.of(BlokShareBroadcaster.FRAME), List.copyOf(viewer.sent),
                    "saving a shared series did not wake its viewers");
            assertFalse(viewer.closed.get());

            viewer.sent.clear();
            QuarkusTransaction.requiringNew().run(() -> history.unshare(recordUuid));

            assertEquals(List.of(BlokShareBroadcaster.FRAME), List.copyOf(viewer.sent),
                    "revoking did not tell the viewer to refetch (they would sit on a dead page)");
            assertTrue(viewer.closed.get(),
                    "the socket for a revoked token was left parked — nothing can ever wake or close it");
            assertEquals(404, statusFor(token), "a revoked token still passed the handshake");
            assertEquals(404, handshakeStatus("/api/live/blok/" + token),
                    "a revoked link could still reconnect over the wire");
        } finally {
            if (token != null) connections.unregister(token, viewer.connection);
            QuarkusTransaction.requiringNew().run(() -> repo.delete("userUid", TEST_UID));
        }
    }

    /**
     * A series nobody shared has no token, so there is no key to broadcast on
     * and the save is nobody's business. Asserted because the alternative — a
     * broadcast keyed on something else, the uuid say — would publish the
     * existence of private records.
     */
    @Test
    void anUnsharedSeriesBroadcastsNothing() {
        String sessionId = "sess-" + UUID.randomUUID();
        try {
            BlokSessionDto saved = QuarkusTransaction.requiringNew()
                    .call(() -> history.save(series(sessionId, 1)));

            // Its uuid is not a socket key: the handshake refuses it exactly
            // like the public read does.
            assertEquals(404, statusFor(saved.uuid().toString()));
            assertEquals(0, connections.countFor(saved.uuid().toString()));
        } finally {
            QuarkusTransaction.requiringNew().run(() -> repo.delete("userUid", TEST_UID));
        }
    }

    /* ==================== 6. the route really is where we say it is ==================== */

    /**
     * The one thing only a real handshake can settle: <b>which URL the backend
     * actually serves this socket on</b>.
     *
     * <p>websockets-next registers its routes under
     * {@code quarkus.http.root-path} (={@code /api}), which is not obvious from
     * the {@code @WebSocket} annotation and is the reason both proxies rewrite
     * {@code /ws/*} to {@code /api/*}. If that ever changed, every viewer's
     * socket would 404 and the page would silently fall back to whatever it
     * fetched on load — exactly the bug §5.7 exists to fix, and invisible to
     * every other test here.
     *
     * <p>Written against the test harness's own HTTP port with a raw socket:
     * one upgrade request, read the status line, hang up. An accepted upgrade
     * is torn down immediately, and {@code @OnClose} unregisters it.
     */
    @Test
    void theHandshakeLivesUnderTheApiRootPathAndRefusesAnUnknownToken() throws Exception {
        String invented = ClaimTokens.generate();

        assertEquals(404, handshakeStatus("/live/blok/" + invented),
                "the socket answered without the /api root path — the proxies rewrite TO /api");
        assertEquals(404, handshakeStatus("/api/live/blok/" + invented),
                "a token that names no shared series was admitted");
        // A URI-legal segment that cannot be base64url — refused by the shape
        // gate, before any query. (A segment with a space never gets this far:
        // it is not a valid request line and Vert.x answers 400.)
        assertEquals(404, handshakeStatus("/api/live/blok/not.a.token"),
                "a malformed segment was admitted");
    }

    /* ==================== helpers ==================== */

    /**
     * Send one websocket upgrade request and return the HTTP status the server
     * answers with — 101 when the upgrade is accepted.
     *
     * <p>A raw socket rather than an HTTP client: a 101 has no body and the
     * connection is then a websocket, which a pooling client would either hang
     * on or mangle. Reading the status line and closing is all this needs, and
     * the read timeout turns any hang into a failed test rather than a stuck
     * build.
     */
    private int handshakeStatus(String path) throws Exception {
        try (Socket sock = new Socket()) {
            sock.connect(new InetSocketAddress("localhost", testPort), 5_000);
            sock.setSoTimeout(10_000);
            String request = "GET " + path + " HTTP/1.1\r\n"
                    + "Host: localhost:" + testPort + "\r\n"
                    + "Upgrade: websocket\r\n"
                    + "Connection: Upgrade\r\n"
                    // The example key from RFC 6455 §1.3. Nothing here checks
                    // the accept hash — only the status line is read.
                    + "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n"
                    + "Sec-WebSocket-Version: 13\r\n"
                    + "\r\n";
            sock.getOutputStream().write(request.getBytes(StandardCharsets.US_ASCII));
            sock.getOutputStream().flush();

            BufferedReader in = new BufferedReader(
                    new InputStreamReader(sock.getInputStream(), StandardCharsets.US_ASCII));
            String statusLine = in.readLine();
            assertNotNull(statusLine, "the server closed the connection without answering");
            String[] parts = statusLine.split(" ");
            assertTrue(parts.length >= 2, () -> "unparseable status line: " + statusLine);
            return Integer.parseInt(parts[1]);
        }
    }

    /**
     * Run the real upgrade check for {@code token}.
     *
     * @return 0 when the upgrade is permitted, otherwise the HTTP status the
     *         client would be answered with
     */
    private int statusFor(String token) {
        HttpUpgradeCheck.CheckResult result = upgradeCheck
                .perform(new HttpUpgradeCheck.HttpUpgradeContext(
                        fakeRequest("/api/live/blok/" + token), null, BlokShareSocket.ENDPOINT_ID))
                .await().atMost(Duration.ofSeconds(20));
        assertNotNull(result);
        return result.isUpgradePermitted() ? 0 : result.getHttpResponseCode();
    }

    /** An {@link HttpServerRequest} that answers {@code path()} and nothing else. */
    private static HttpServerRequest fakeRequest(String path) {
        return (HttpServerRequest) Proxy.newProxyInstance(
                HttpServerRequest.class.getClassLoader(),
                new Class<?>[]{HttpServerRequest.class},
                (proxy, method, args) -> "path".equals(method.getName())
                        ? path
                        : defaultAnswer(proxy, method, args));
    }

    /**
     * A {@link WebSocketConnection} that records what was sent to it and
     * whether it was closed. {@code sendText} hands back an already-resolved
     * {@code Uni}, so the broadcaster's {@code subscribe().with(...)} — and the
     * close it chains onto the send — run synchronously and are observable the
     * moment the call returns.
     */
    private static final class FakeConnection {
        final List<String> sent = new CopyOnWriteArrayList<>();
        final AtomicBoolean closed = new AtomicBoolean();
        final WebSocketConnection connection;

        FakeConnection() {
            InvocationHandler handler = (proxy, method, args) -> switch (method.getName()) {
                case "sendText" -> {
                    sent.add(String.valueOf(args[0]));
                    yield Uni.createFrom().voidItem();
                }
                case "isClosed" -> closed.get();
                case "close" -> {
                    closed.set(true);
                    yield Uni.createFrom().voidItem();
                }
                default -> defaultAnswer(proxy, method, args);
            };
            this.connection = (WebSocketConnection) Proxy.newProxyInstance(
                    WebSocketConnection.class.getClassLoader(),
                    new Class<?>[]{WebSocketConnection.class},
                    handler);
        }
    }

    /**
     * Identity semantics for {@code equals}/{@code hashCode} — the index stores
     * these in a hash set, so two stand-ins must never collapse into one — and
     * a type-correct nothing for everything else.
     */
    private static Object defaultAnswer(Object proxy, Method method, Object[] args) {
        switch (method.getName()) {
            case "equals" -> {
                return args != null && args.length == 1 && args[0] == proxy;
            }
            case "hashCode" -> {
                return System.identityHashCode(proxy);
            }
            case "toString" -> {
                return "fake-" + System.identityHashCode(proxy);
            }
            default -> { /* fall through */ }
        }
        Class<?> t = method.getReturnType();
        if (t == boolean.class) return false;
        if (t == int.class) return 0;
        if (t == long.class) return 0L;
        if (t == double.class) return 0d;
        if (t == float.class) return 0f;
        if (t == short.class) return (short) 0;
        if (t == byte.class) return (byte) 0;
        if (t == char.class) return (char) 0;
        return null;
    }

    private static SaveBlokSessionRequest series(String sessionId, int games) {
        List<BlokGameDto> played = new ArrayList<>(games);
        for (int i = 0; i < games; i++) played.add(game(i % 2 == 0 ? "us" : "them"));
        return new SaveBlokSessionRequest(
                sessionId, 1001, "prolaz", BlokNamesDto.of("MI", "VI"),
                1_757_280_000_000L, 1_757_283_600_000L, played);
    }

    private static BlokGameDto game(String winner) {
        List<BlokRoundDto> deals = List.of(new BlokRoundDto(
                "us",
                new BlokScoresDto(92, 70),
                new BlokDeclarationsDto(List.of(20, 50), List.of()),
                null,
                "HERC"));
        return new BlokGameDto(
                UUID.randomUUID().toString(),
                1_757_280_000_000L, 1_757_283_600_000L, 1001, "prolaz",
                "self", winner, new BlokScoresDto(1012, 786), deals);
    }
}
