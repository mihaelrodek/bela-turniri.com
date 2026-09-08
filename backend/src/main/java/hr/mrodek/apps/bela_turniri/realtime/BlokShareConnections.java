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
 * Index of open {@link BlokShareSocket} connections, keyed by the scorepad's
 * <b>share token</b>.
 *
 * <p>The blok twin of {@link LiveConnections}, deliberately kept as a separate
 * class rather than folded into it. Two reasons:
 *
 * <ul>
 *   <li><b>The keys are not the same kind of thing.</b> {@link LiveConnections}
 *       is keyed on a tournament uuid, which is public and appears in every
 *       tournament DTO; this one is keyed on a <em>secret</em>, the token that
 *       is the whole of a viewer's authorisation to read a scorepad. Sharing
 *       one map would put the two in the same namespace and make a
 *       cross-feature key collision (or a stray {@code countFor} on the wrong
 *       kind of id) a security question instead of a bug.</li>
 *   <li><b>The budgets are separate.</b> A tournament's audience and a shared
 *       scorepad's audience are sized very differently — a venue vs. the four
 *       people at one table — so they get their own caps (see
 *       {@link BlokShareUpgradeCheck}) rather than competing for one.</li>
 * </ul>
 *
 * <h2>Concurrency</h2>
 * Identical to {@link LiveConnections} and for the identical reason: every
 * mutation happens INSIDE a {@link ConcurrentHashMap#compute} mapping
 * function, i.e. under the per-key bin lock. The obvious
 * {@code computeIfAbsent(...).add(c)} races with the removal of a now-empty
 * set — the adder would publish into a set the remover has already unmapped,
 * and that connection would silently never receive a ping again. The counter
 * is maintained in the same critical section so it cannot drift from the map.
 */
@ApplicationScoped
public class BlokShareConnections {

    /** share token -> the sockets currently watching that scorepad. */
    private final ConcurrentMap<String, Set<WebSocketConnection>> byToken = new ConcurrentHashMap<>();

    /** Total open blok-share sockets. Kept in step with the map, never derived. */
    private final AtomicInteger total = new AtomicInteger();

    /** Attach a freshly opened connection to its scorepad. */
    void register(String shareToken, WebSocketConnection connection) {
        if (shareToken == null || connection == null) return;
        byToken.compute(shareToken, (key, existing) -> {
            Set<WebSocketConnection> set = (existing == null)
                    ? ConcurrentHashMap.newKeySet()
                    : existing;
            if (set.add(connection)) total.incrementAndGet();
            return set;
        });
    }

    /** Detach a closed connection; drops the bucket once it empties. */
    void unregister(String shareToken, WebSocketConnection connection) {
        if (shareToken == null || connection == null) return;
        byToken.computeIfPresent(shareToken, (key, set) -> {
            if (set.remove(connection)) total.decrementAndGet();
            // Returning null removes the mapping, so a scorepad nobody is
            // watching any more does not leave an empty set behind forever.
            return set.isEmpty() ? null : set;
        });
    }

    /**
     * Snapshot of the sockets watching {@code shareToken}. The returned set is
     * the live one — callers only iterate it, and it is a
     * {@code ConcurrentHashMap} key set, so a concurrent open or close during
     * iteration is safe and simply included-or-not.
     */
    Collection<WebSocketConnection> forToken(String shareToken) {
        if (shareToken == null) return List.of();
        Set<WebSocketConnection> set = byToken.get(shareToken);
        return set == null ? List.of() : set;
    }

    /** Total open blok-share sockets across all scorepads. */
    public int total() {
        return total.get();
    }

    /** Open blok-share sockets for one scorepad. */
    public int countFor(String shareToken) {
        if (shareToken == null) return 0;
        Set<WebSocketConnection> set = byToken.get(shareToken);
        return set == null ? 0 : set.size();
    }
}
