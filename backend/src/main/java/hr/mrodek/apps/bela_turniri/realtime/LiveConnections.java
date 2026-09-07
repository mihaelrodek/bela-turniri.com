package hr.mrodek.apps.bela_turniri.realtime;

import io.quarkus.websockets.next.WebSocketConnection;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Index of open {@link LiveSocket} connections, keyed by tournament uuid.
 *
 * <h2>Why this exists rather than iterating {@code OpenConnections}</h2>
 * {@link LiveBroadcaster} used to walk EVERY open connection on the server
 * and string-compare each one's {@code tournamentUuid} path param. That made
 * the cost of announcing a single score proportional to the total number of
 * sockets on the box, not to the number of people watching that tournament —
 * so every idle or parked socket taxed every real write, and the two failure
 * modes (a pile of parked sockets, and a slow broadcast) fed each other.
 * A map lookup makes the fan-out proportional to the actual audience.
 *
 * <h2>Why it also counts</h2>
 * websockets-next 3.15 has no
 * {@code quarkus.websockets-next.server.max-concurrent-connections} setting
 * (verified against {@code WebSocketsServerRuntimeConfig} in
 * {@code quarkus-websockets-next-3.15.6}: it exposes only subprotocols,
 * compression, max message size, auto-ping-interval, the unhandled-failure
 * strategy, security and dev-mode/traffic logging). Caddy's {@code ws} zone
 * limits handshake RATE, which does nothing against a client that opens
 * sockets slowly and never closes them. So the ceiling is enforced here, and
 * read by {@link LiveUpgradeCheck} before the handshake completes.
 *
 * <h2>Concurrency</h2>
 * Every mutation happens INSIDE a {@link ConcurrentHashMap#compute} mapping
 * function, i.e. under the per-key bin lock. Doing the {@code add} outside
 * (the obvious {@code computeIfAbsent(...).add(c)}) races with the removal
 * of a now-empty set: the adder would publish into a set that the remover
 * has already unmapped, and that connection would silently never receive a
 * ping again. The counter is maintained in the same critical section so it
 * can never drift from the map.
 */
@ApplicationScoped
public class LiveConnections {

    /** tournament uuid -> the sockets currently watching it. */
    private final ConcurrentMap<String, Set<WebSocketConnection>> byTournament = new ConcurrentHashMap<>();

    /** Total open live sockets. Kept in step with the map, never derived. */
    private final AtomicInteger total = new AtomicInteger();

    /** Attach a freshly opened connection to its tournament. */
    void register(String tournamentUuid, WebSocketConnection connection) {
        if (tournamentUuid == null || connection == null) return;
        byTournament.compute(tournamentUuid, (key, existing) -> {
            Set<WebSocketConnection> set = (existing == null)
                    ? ConcurrentHashMap.newKeySet()
                    : existing;
            if (set.add(connection)) total.incrementAndGet();
            return set;
        });
    }

    /** Detach a closed connection; drops the bucket once it empties. */
    void unregister(String tournamentUuid, WebSocketConnection connection) {
        if (tournamentUuid == null || connection == null) return;
        byTournament.computeIfPresent(tournamentUuid, (key, set) -> {
            if (set.remove(connection)) total.decrementAndGet();
            // Returning null removes the mapping, so a tournament that is
            // over does not leave an empty set behind forever.
            return set.isEmpty() ? null : set;
        });
    }

    /**
     * Snapshot of the sockets watching {@code tournamentUuid}. The returned
     * set is the live one — callers only iterate it, and it is a
     * {@code ConcurrentHashMap} key set, so concurrent open/close during
     * iteration is safe and simply included-or-not.
     */
    Collection<WebSocketConnection> forTournament(String tournamentUuid) {
        if (tournamentUuid == null) return List.of();
        Set<WebSocketConnection> set = byTournament.get(tournamentUuid);
        return set == null ? List.of() : set;
    }

    /** Total open live sockets across all tournaments. */
    public int total() {
        return total.get();
    }

    /** Open live sockets for one tournament. */
    public int countFor(String tournamentUuid) {
        if (tournamentUuid == null) return 0;
        Set<WebSocketConnection> set = byTournament.get(tournamentUuid);
        return set == null ? 0 : set.size();
    }
}
