package hr.mrodek.apps.bela_turniri.services;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Pure unit tests for the round-draw algorithm — no Quarkus, no CDI, no DB.
 *
 * <p>The draw is random by design, so every assertion here either
 * <ul>
 *   <li>holds for EVERY seed (checked by sweeping many seeds), or</li>
 *   <li>is about determinism for ONE fixed seed.</li>
 * </ul>
 * That is deliberate: a test that passes only for the seed that happened to
 * be picked would hide exactly the pairing bugs this file exists to catch.
 */
class RoundPairingTest {

    /** How many seeds each "must hold for every draw" assertion sweeps. */
    private static final int SEEDS = 200;

    private static List<Long> ids(long... v) {
        List<Long> out = new ArrayList<>(v.length);
        for (long x : v) out.add(x);
        return out;
    }

    /** Every id that appears anywhere in the plan, matchups plus the BYE. */
    private static List<Long> allIds(RoundPairing.Plan plan) {
        List<Long> out = new ArrayList<>();
        for (var m : plan.pairs()) {
            out.add(m.pair1Id());
            out.add(m.pair2Id());
        }
        if (plan.byeId() != null) out.add(plan.byeId());
        return out;
    }

    /** Asserts the plan is a perfect matching of {@code pool} (+ at most one BYE). */
    private static void assertCoversExactlyOnce(List<Long> pool, RoundPairing.Plan plan) {
        List<Long> seen = allIds(plan);
        assertEquals(pool.size(), seen.size(),
                "every active pair must appear exactly once (matchup or BYE)");
        assertEquals(new HashSet<>(pool), new HashSet<>(seen), "same set of ids back out");
        assertEquals(seen.size(), new HashSet<>(seen).size(), "no id used twice");
    }

    /* ===================== even / odd shape ===================== */

    @Test
    @DisplayName("even count: everyone is paired, no BYE")
    void evenCountPairsEveryone() {
        List<Long> pool = ids(1, 2, 3, 4, 5, 6);
        for (int seed = 0; seed < SEEDS; seed++) {
            var plan = RoundPairing.plan(pool, Set.of(), Set.of(), true, new Random(seed));
            assertNull(plan.byeId(), "no BYE for an even pool (seed " + seed + ")");
            assertEquals(3, plan.pairs().size());
            assertCoversExactlyOnce(pool, plan);
        }
    }

    @Test
    @DisplayName("odd count: exactly one BYE, everyone else paired")
    void oddCountYieldsExactlyOneBye() {
        List<Long> pool = ids(1, 2, 3, 4, 5);
        for (int seed = 0; seed < SEEDS; seed++) {
            var plan = RoundPairing.plan(pool, Set.of(), Set.of(), true, new Random(seed));
            assertNotNull(plan.byeId(), "odd pool must produce a BYE (seed " + seed + ")");
            assertEquals(2, plan.pairs().size());
            assertCoversExactlyOnce(pool, plan);
        }
    }

    @Test
    @DisplayName("the BYE row is not part of any matchup")
    void byeIsNotAlsoPlaying() {
        List<Long> pool = ids(10, 20, 30);
        for (int seed = 0; seed < SEEDS; seed++) {
            var plan = RoundPairing.plan(pool, Set.of(), Set.of(), true, new Random(seed));
            long bye = plan.byeId();
            for (var m : plan.pairs()) {
                assertFalse(m.pair1Id() == bye || m.pair2Id() == bye,
                        "the BYE pair must not be scheduled at a table");
            }
        }
    }

    /* ===================== BYE selection rule ===================== */

    @Test
    @DisplayName("BYE goes to a pair that has not had one yet")
    void byePrefersPairsWithoutAPreviousBye() {
        List<Long> pool = ids(1, 2, 3, 4, 5);
        // Everyone but 5 already sat a round out.
        Set<Long> alreadyHadBye = Set.of(1L, 2L, 3L, 4L);
        for (int seed = 0; seed < SEEDS; seed++) {
            var plan = RoundPairing.plan(pool, Set.of(), alreadyHadBye, true, new Random(seed));
            assertEquals(Long.valueOf(5L), plan.byeId(),
                    "the only pair without a prior BYE must get it (seed " + seed + ")");
        }
    }

    @Test
    @DisplayName("BYE is picked at random once everyone has had one")
    void byeFallsBackToRandomWhenEveryoneHadOne() {
        List<Long> pool = ids(7, 8, 9);
        Set<Long> alreadyHadBye = Set.of(7L, 8L, 9L);
        Set<Long> picked = new HashSet<>();
        for (int seed = 0; seed < SEEDS; seed++) {
            var plan = RoundPairing.plan(pool, Set.of(), alreadyHadBye, true, new Random(seed));
            assertTrue(pool.contains(plan.byeId()), "BYE must come from the pool");
            assertCoversExactlyOnce(pool, plan);
            picked.add(plan.byeId());
        }
        assertEquals(3, picked.size(),
                "with no eligible pair left the choice is random, so all three show up across seeds");
    }

    /* ===================== repeat avoidance ===================== */

    @Test
    @DisplayName("repeat opponents are avoided when a repeat-free pairing exists")
    void avoidsRepeatsWhenPossible() {
        List<Long> pool = ids(1, 2, 3, 4);
        // Round 1 was 1v2 and 3v4 — a repeat-free round 2 exists (1v3 + 2v4,
        // or 1v4 + 2v3), so the draw must never re-run either old matchup.
        Set<String> played = Set.of(RoundPairing.pairKey(1, 2), RoundPairing.pairKey(3, 4));
        for (int seed = 0; seed < SEEDS; seed++) {
            var plan = RoundPairing.plan(pool, played, Set.of(), true, new Random(seed));
            assertCoversExactlyOnce(pool, plan);
            for (var m : plan.pairs()) {
                assertFalse(played.contains(RoundPairing.pairKey(m.pair1Id(), m.pair2Id())),
                        "re-ran " + m + " although a repeat-free pairing exists (seed " + seed + ")");
            }
        }
    }

    @Test
    @DisplayName("larger bracket: still repeat-free when it can be")
    void avoidsRepeatsInASixPairBracket() {
        List<Long> pool = ids(1, 2, 3, 4, 5, 6);
        Set<String> played = new HashSet<>(Set.of(
                RoundPairing.pairKey(1, 2), RoundPairing.pairKey(3, 4), RoundPairing.pairKey(5, 6),
                RoundPairing.pairKey(1, 3), RoundPairing.pairKey(2, 5), RoundPairing.pairKey(4, 6)));
        for (int seed = 0; seed < SEEDS; seed++) {
            var plan = RoundPairing.plan(pool, played, Set.of(), true, new Random(seed));
            assertCoversExactlyOnce(pool, plan);
            for (var m : plan.pairs()) {
                assertFalse(played.contains(RoundPairing.pairKey(m.pair1Id(), m.pair2Id())),
                        "re-ran " + m + " (seed " + seed + ")");
            }
        }
    }

    @Test
    @DisplayName("no repeat-free pairing left: still pairs everyone, allowing repeats")
    void fallsBackToRepeatsWhenNoCleanPairingExists() {
        List<Long> pool = ids(1, 2, 3, 4);
        // Every possible matchup among four pairs has already happened.
        Set<String> played = new HashSet<>();
        for (long a = 1; a <= 4; a++) {
            for (long b = a + 1; b <= 4; b++) played.add(RoundPairing.pairKey(a, b));
        }
        for (int seed = 0; seed < SEEDS; seed++) {
            var plan = RoundPairing.plan(pool, played, Set.of(), true, new Random(seed));
            // The escalating repeat budget must still produce a full round —
            // never a partial one and never an exception.
            assertEquals(2, plan.pairs().size(), "seed " + seed);
            assertCoversExactlyOnce(pool, plan);
        }
    }

    @Test
    @DisplayName("preserveMatchmaking=false ignores history and just pairs the shuffled pool")
    void withoutPreserveMatchmakingRepeatsAreFine() {
        List<Long> pool = ids(1, 2, 3, 4);
        Set<String> played = new HashSet<>();
        for (long a = 1; a <= 4; a++) {
            for (long b = a + 1; b <= 4; b++) played.add(RoundPairing.pairKey(a, b));
        }
        for (int seed = 0; seed < SEEDS; seed++) {
            var plan = RoundPairing.plan(pool, played, Set.of(), false, new Random(seed));
            assertEquals(2, plan.pairs().size());
            assertCoversExactlyOnce(pool, plan);
        }
    }

    /* ===================== determinism ===================== */

    @Test
    @DisplayName("same input order + same seed => byte-identical plan")
    void deterministicForIdenticalInput() {
        List<Long> pool = ids(11, 22, 33, 44, 55, 66, 77);
        Set<String> played = Set.of(RoundPairing.pairKey(11, 22), RoundPairing.pairKey(33, 44));
        Set<Long> byes = Set.of(11L);

        for (int seed = 0; seed < 25; seed++) {
            var a = RoundPairing.plan(pool, played, byes, true, new Random(seed));
            var b = RoundPairing.plan(pool, played, byes, true, new Random(seed));
            assertEquals(a.byeId(), b.byeId(), "seed " + seed);
            assertEquals(a.pairs(), b.pairs(), "seed " + seed);
        }
    }

    @Test
    @DisplayName("the caller's list is never mutated")
    void doesNotMutateCallerInput() {
        List<Long> pool = ids(1, 2, 3, 4, 5);
        List<Long> before = List.copyOf(pool);
        RoundPairing.plan(pool, Set.of(), Set.of(), true, new Random(1));
        assertEquals(before, pool, "plan() must work on its own copy");
    }

    /* ===================== pairKey ===================== */

    @Test
    @DisplayName("pairKey is order-independent and collision-free")
    void pairKeyIsUnordered() {
        assertEquals(RoundPairing.pairKey(3, 9), RoundPairing.pairKey(9, 3));
        assertEquals("3#9", RoundPairing.pairKey(9, 3));
        assertFalse(RoundPairing.pairKey(1, 23).equals(RoundPairing.pairKey(12, 3)));
    }

    /* ===================== backtracking budget ===================== */

    @Test
    @DisplayName("pairBacktrack with a zero repeat budget refuses an all-played pool")
    void backtrackFailsWithoutRepeatBudget() {
        List<Long> pool = ids(1, 2, 3, 4);
        Set<String> played = new HashSet<>();
        for (long a = 1; a <= 4; a++) {
            for (long b = a + 1; b <= 4; b++) played.add(RoundPairing.pairKey(a, b));
        }
        List<RoundPairing.Matchup> out = new ArrayList<>();
        boolean ok = RoundPairing.pairBacktrack(
                pool, new boolean[pool.size()], played, 0, out, new Random(1));
        assertFalse(ok, "no repeat budget => no solution");
        assertTrue(out.isEmpty(), "a failed search must unwind completely");
    }
}
