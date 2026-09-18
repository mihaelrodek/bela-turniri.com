package hr.mrodek.apps.bela_turniri.services;

import hr.mrodek.apps.bela_turniri.dtos.BlockedUserDto;
import hr.mrodek.apps.bela_turniri.errors.ApiCodes;
import hr.mrodek.apps.bela_turniri.model.UserBlock;
import hr.mrodek.apps.bela_turniri.model.UserProfile;
import hr.mrodek.apps.bela_turniri.repository.UserBlockRepository;
import hr.mrodek.apps.bela_turniri.repository.UserProfileRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.util.ArrayList;
import java.util.List;

/**
 * Blocking, and the reads that enforce it — App Store guideline 1.2.
 *
 * <h2>What a block actually does</h2>
 * <ul>
 *   <li>{@code GET /public/users/{slug}} 404s in BOTH directions
 *       ({@link UserBlockRepository#existsEitherWay}) — enforced in
 *       {@link PublicProfileService}.</li>
 *   <li>{@code GET /tournaments} and {@code /tournaments/count} drop
 *       tournaments created by a blocked uid, but ONLY for an authenticated
 *       caller — see {@link #blockerUidFor} and
 *       {@code TournamentsRepository.findFinishedPaged(int,int,String,String)}.</li>
 * </ul>
 *
 * <h2>What a block deliberately does NOT do</h2>
 * A blocked user's PAIRS still appear in a tournament they registered for.
 * The pair list is the organiser's roster and the other players' draw: hiding
 * a pair from one viewer would leave them looking at a round whose opponents
 * do not exist, and would let anyone edit somebody else's tournament by
 * blocking them. Blocking controls what YOU see of a person, not who is
 * allowed to play.
 *
 * <p>Everything is enforced server-side so it holds for the SPA, the iOS and
 * Android shells, and anything else that ever talks to this API.
 */
@ApplicationScoped
public class UserBlockService {

    @Inject UserBlockRepository blockRepo;
    @Inject UserProfileRepository profileRepo;
    @Inject AvatarPresetService avatarPresets;
    @Inject DisplayNames displayNames;

    /**
     * Block {@code blockedUid} on behalf of {@code blockerUid}. Idempotent —
     * the (blocker, blocked) pair is the primary key, so re-blocking writes
     * nothing and still answers 204.
     *
     * @throws jakarta.ws.rs.WebApplicationException 400 {@code CANNOT_BLOCK_SELF},
     *         404 when there is no such profile
     */
    public void block(String blockerUid, String blockedUid) {
        if (blockedUid == null || blockedUid.isBlank()) throw ApiCodes.notFound();
        if (blockerUid.equals(blockedUid)) throw ApiCodes.badRequest("CANNOT_BLOCK_SELF");
        // The uid must belong to somebody. Without this the endpoint would
        // happily accept typos and fill the table with rows that can never
        // match anything, and the block list would render empty entries.
        if (profileRepo.findByUid(blockedUid).isEmpty()) throw ApiCodes.notFound();
        if (blockRepo.exists(blockerUid, blockedUid)) return;
        blockRepo.persist(new UserBlock(blockerUid, blockedUid));
    }

    /** Unblock. Idempotent: removing a block that is not there is still 204. */
    public void unblock(String blockerUid, String blockedUid) {
        blockRepo.remove(blockerUid, blockedUid);
    }

    /** The caller's block list, newest first, enriched for rendering. */
    public List<BlockedUserDto> list(String blockerUid) {
        List<UserBlock> edges = blockRepo.findByBlocker(blockerUid);
        if (edges.isEmpty()) return List.of();

        var profiles = profileRepo.findByUids(edges.stream().map(UserBlock::getBlockedUid).toList());
        var out = new ArrayList<BlockedUserDto>(edges.size());
        for (UserBlock e : edges) {
            UserProfile p = profiles.get(e.getBlockedUid());
            String avatarUrl = null;
            if (p != null && !p.isDeleted() && p.getAvatar() != null && p.getAvatar().getId() != null) {
                avatarUrl = "/api/resources/" + p.getAvatar().getId() + "/image";
            }
            out.add(new BlockedUserDto(
                    e.getBlockedUid(),
                    displayNames.slugOf(p),
                    // A profile row that has vanished entirely still has to be
                    // unblockable, so it gets the deleted-user label too.
                    p == null ? displayNames.deletedLabel() : displayNames.nameOf(p),
                    avatarUrl,
                    p == null || p.isDeleted() ? null : avatarPresets.presetFor(p, avatarUrl)));
        }
        return out;
    }

    /**
     * The uid to filter listings by, or null when there is nothing to filter.
     *
     * <p>Returns null for an anonymous caller AND for a signed-in caller who
     * has blocked nobody. The second half is what keeps the common case free:
     * no block list means no subquery, and the SQL is exactly what it was
     * before this feature existed.
     */
    public String blockerUidFor(String callerUid) {
        if (callerUid == null || callerUid.isBlank()) return null;
        // A count, not a fetch: this runs on every tournament listing.
        return blockRepo.count("blockerUid", callerUid) == 0 ? null : callerUid;
    }

    /** True when either party has blocked the other. */
    public boolean blockedEitherWay(String a, String b) {
        return blockRepo.existsEitherWay(a, b);
    }
}
