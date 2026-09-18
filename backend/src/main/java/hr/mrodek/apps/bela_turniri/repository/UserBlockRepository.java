package hr.mrodek.apps.bela_turniri.repository;

import hr.mrodek.apps.bela_turniri.model.UserBlock;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;

/**
 * Who has blocked whom. Every method is scoped by one of the two uids —
 * there is deliberately no "list all blocks" read, because nothing in the app
 * has a reason to see the graph.
 */
@ApplicationScoped
public class UserBlockRepository implements AppRepository<UserBlock, UserBlock.Key> {

    /** True when {@code blockerUid} has blocked {@code blockedUid}. Rides the PK. */
    public boolean exists(String blockerUid, String blockedUid) {
        if (isBlank(blockerUid) || isBlank(blockedUid)) return false;
        return count("blockerUid = ?1 and blockedUid = ?2", blockerUid, blockedUid) > 0;
    }

    /**
     * True when EITHER has blocked the other.
     *
     * <p>The profile page is hidden in both directions on purpose: a one-way
     * hide would let the blocked party keep reading the blocker's profile,
     * which is most of what the blocker was trying to stop.
     */
    public boolean existsEitherWay(String a, String b) {
        if (isBlank(a) || isBlank(b)) return false;
        return count("(blockerUid = ?1 and blockedUid = ?2) or (blockerUid = ?2 and blockedUid = ?1)",
                a, b) > 0;
    }

    /** Uids this user has blocked, newest block first. */
    public List<UserBlock> findByBlocker(String blockerUid) {
        if (isBlank(blockerUid)) return List.of();
        return list("blockerUid", Sort.by("createdAt").descending(), blockerUid);
    }

    /** @return number of rows removed — 0 when the block was not there. */
    public long remove(String blockerUid, String blockedUid) {
        if (isBlank(blockerUid) || isBlank(blockedUid)) return 0;
        return delete("blockerUid = ?1 and blockedUid = ?2", blockerUid, blockedUid);
    }

    /** Every edge this uid is on either side of — used when an account is deleted. */
    public long deleteInvolving(String uid) {
        if (isBlank(uid)) return 0;
        return delete("blockerUid = ?1 or blockedUid = ?1", uid);
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
