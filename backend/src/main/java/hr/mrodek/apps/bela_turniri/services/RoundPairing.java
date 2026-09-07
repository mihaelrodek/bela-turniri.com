package hr.mrodek.apps.bela_turniri.services;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.Random;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * The round-draw algorithm, extracted out of {@code RoundService} so it can
 * be reasoned about (and unit-tested) without Panache, CDI or a database.
 *
 * <p>Everything here is a pure static function over <b>pair ids</b>. Entities
 * are mapped to ids at the boundary in {@code RoundService}; nothing in this
 * class knows what a {@code Pairs} row looks like.
 *
 * <h2>Determinism</h2>
 * <p>The draw is deliberately random: {@link #plan} shuffles its working copy
 * of the pool, shuffles the BYE candidates, and shuffles the opponent
 * candidates at every backtracking level. All of that randomness comes from
 * the {@link Random} the caller hands in — the class never creates one — so:
 * <ul>
 *   <li>production ({@code RoundService} passes a fresh {@code new Random()})
 *       behaves exactly as it did before the extraction, and</li>
 *   <li>the same input order plus the same seeded {@code Random} always
 *       produces the same plan, which is what makes the unit tests possible.</li>
 * </ul>
 * The <i>order of the incoming id list</i> therefore still matters (it is the
 * pre-image of the shuffle) — {@code RoundService} feeds it in repository
 * order, unchanged from before.
 */
public final class RoundPairing {

    private RoundPairing() {}

    /** One scheduled table: two pair ids, in the order the algorithm chose them. */
    public record Matchup(long pair1Id, long pair2Id) {}

    /**
     * The outcome of a draw.
     *
     * @param byeId  the pair sitting this round out, or {@code null} when the
     *               active count is even
     * @param pairs  the matchups, in table order (table 1 first)
     */
    public record Plan(Long byeId, List<Matchup> pairs) {}

    /**
     * Draw one round.
     *
     * @param activeIds          ids of the pairs still in the tournament, in
     *                           repository order (shuffled internally)
     * @param playedKeys         {@link #pairKey} of every matchup that already
     *                           happened (BYEs excluded)
     * @param byeRecipients      ids of pairs that already received a BYE
     * @param preserveMatchmaking when true, avoid repeat opponents via
     *                           backtracking; when false, pair the shuffled
     *                           pool adjacently
     * @param rnd                source of all randomness (never null)
     */
    public static Plan plan(
            List<Long> activeIds,
            Set<String> playedKeys,
            Set<Long> byeRecipients,
            boolean preserveMatchmaking,
            Random rnd
    ) {
        // Work on a shuffled copy for randomness
        List<Long> pool = new ArrayList<>(activeIds);
        Collections.shuffle(pool, rnd);

        // ===== BYE FIRST (if odd count) =====
        Long bye = null;
        if (pool.size() % 2 == 1) {
            // Prefer players who have NOT had a BYE yet
            List<Long> eligible = pool.stream()
                    .filter(id -> !byeRecipients.contains(id))
                    .collect(Collectors.toList());

            // If everyone had a BYE, pick truly random. Note this branch
            // shuffles `pool` itself (candidates IS pool) — kept verbatim
            // from the original so the RNG draw sequence is unchanged.
            List<Long> candidates = eligible.isEmpty() ? pool : eligible;
            Collections.shuffle(candidates, rnd);
            bye = candidates.get(0);

            final Long byeId = bye;
            pool.removeIf(id -> Objects.equals(id, byeId));
        }

        // ===== PAIRING =====
        List<Matchup> chosen = new ArrayList<>();
        if (!preserveMatchmaking) {
            // Simple random adjacent pairing
            adjacent(pool, chosen);
        } else {
            // Backtracking with gradually allowed repeats
            boolean success = false;
            int maxPairs = pool.size() / 2;
            for (int allowedRepeats = 0; allowedRepeats <= maxPairs; allowedRepeats++) {
                chosen.clear();
                boolean[] used = new boolean[pool.size()];
                success = pairBacktrack(pool, used, playedKeys, allowedRepeats, chosen, rnd);
                if (success) break;
            }
            if (!success) {
                // Extremely rare fallback: just pair adjacently
                chosen.clear();
                adjacent(pool, chosen);
            }
        }

        return new Plan(bye, List.copyOf(chosen));
    }

    /** Unordered key for a pairing — {@code min#max}, so a#b == b#a. */
    public static String pairKey(long a, long b) {
        long x = Math.min(a, b), y = Math.max(a, b);
        return x + "#" + y;
    }

    /** Pair the pool as it stands: 0-1, 2-3, … A trailing odd element is dropped. */
    private static void adjacent(List<Long> pool, List<Matchup> out) {
        for (int i = 0; i + 1 < pool.size(); i += 2) {
            out.add(new Matchup(pool.get(i), pool.get(i + 1)));
        }
    }

    /**
     * Backtracking pairing that tries to avoid previously played pairings.
     * Increase {@code repeatsLeft} externally until a solution is found.
     *
     * <p>Package-private so the unit test can exercise a single repeat budget
     * directly; production always goes through {@link #plan}.
     */
    static boolean pairBacktrack(
            List<Long> pool,
            boolean[] used,
            Set<String> played,
            int repeatsLeft,
            List<Matchup> out,
            Random rnd
    ) {
        final int n = pool.size();

        // Find first unused index
        int i = -1;
        for (int k = 0; k < n; k++) {
            if (!used[k]) {
                i = k;
                break;
            }
        }
        if (i == -1) return true; // all paired

        used[i] = true;
        long idA = pool.get(i);

        List<Integer> notPlayed = new ArrayList<>();
        List<Integer> playedBefore = new ArrayList<>();

        for (int j = i + 1; j < n; j++) {
            if (used[j]) continue;
            long idB = pool.get(j);
            if (played.contains(pairKey(idA, idB))) playedBefore.add(j);
            else notPlayed.add(j);
        }

        Collections.shuffle(notPlayed, rnd);
        Collections.shuffle(playedBefore, rnd);

        // Prefer brand-new matchups
        for (int j : notPlayed) {
            used[j] = true;
            out.add(new Matchup(idA, pool.get(j)));
            if (pairBacktrack(pool, used, played, repeatsLeft, out, rnd)) return true;
            out.remove(out.size() - 1);
            used[j] = false;
        }

        // Allow repeats if needed
        if (repeatsLeft > 0) {
            for (int j : playedBefore) {
                used[j] = true;
                out.add(new Matchup(idA, pool.get(j)));
                if (pairBacktrack(pool, used, played, repeatsLeft - 1, out, rnd)) return true;
                out.remove(out.size() - 1);
                used[j] = false;
            }
        }

        used[i] = false;
        return false;
    }
}
