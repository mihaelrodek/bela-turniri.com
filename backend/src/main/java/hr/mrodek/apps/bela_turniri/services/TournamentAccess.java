package hr.mrodek.apps.bela_turniri.services;

import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.repository.TournamentsRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.NotFoundException;

import java.util.Objects;

/**
 * The single place that answers "may this caller touch this tournament?".
 *
 * <p>Every controller used to hand-roll the same four lines
 * ({@code hasRole("admin")} → {@code jwt.getSubject()} → compare against
 * {@code createdByUid} → throw 403), each with its own English message and
 * its own idea of whether a missing tournament is a 403 or a 404. Those
 * copies are gone; this bean is now the only implementation.
 *
 * <p>{@code @ApplicationScoped} while {@link CurrentUser} is
 * {@code @RequestScoped}: CDI injects a client proxy, so each call resolves
 * the identity of the request that is actually running.
 *
 * <p>Note that nothing here opens a transaction. Callers (the JAX-RS
 * resource methods) are already {@code @Transactional}, and loading an
 * entity in one transaction only to mutate it in another would hand the
 * caller a detached instance whose writes are silently dropped.
 */
@ApplicationScoped
public class TournamentAccess {

    @Inject TournamentsRepository tournamentsRepo;
    @Inject CurrentUser currentUser;
    @Inject MessageService messages;

    /*
     * The frontend renders {@code ApiError.message} verbatim in a toast, so
     * these are user-facing copy and go through {@link MessageService} — a
     * Slovenian client must not be told "Turnir nije pronađen.". The Croatian
     * wording is unchanged; it now lives in
     * {@code resources/i18n/messages_hr.properties}.
     */
    private static final String NOT_FOUND_KEY = "tournament.notFound";
    private static final String FORBIDDEN_KEY = "tournament.forbidden.edit";

    /**
     * Resolve a tournament by UUID or slug — both forms appear in the wild
     * because slugs landed after the first shared links did — or 404.
     */
    public Tournaments load(String idOrSlug) {
        return tournamentsRepo.findByUuidOrSlug(idOrSlug)
                .orElseThrow(() -> new NotFoundException(messages.t(NOT_FOUND_KEY)));
    }

    /**
     * True when the caller may manage the tournament: an admin, or its
     * creator. Legacy rows without a {@code createdByUid} can only be
     * managed by admins — there is no original owner to defer to.
     */
    public boolean canManage(Tournaments t) {
        if (currentUser.isAdmin()) return true;
        if (t == null || t.getCreatedByUid() == null) return false;
        String me = currentUser.uidOrNull();
        return me != null && Objects.equals(me, t.getCreatedByUid());
    }

    /** 403 unless {@link #canManage(Tournaments)}. */
    public void assertCanEdit(Tournaments t) {
        if (!canManage(t)) {
            throw new ForbiddenException(messages.t(FORBIDDEN_KEY));
        }
    }

    /**
     * Same gate as {@link #assertCanEdit(Tournaments)} but answers 404
     * instead of 403, for endpoints where "you are not allowed" would
     * itself leak information the caller shouldn't have — the drink bill
     * being the case in point: prices are private to the organiser and
     * the two pairs that played, and a 403 would confirm to any signed-in
     * stranger that a given match has a bill at all.
     */
    public void assertCanEditOrHide(Tournaments t) {
        if (!canManage(t)) {
            throw new NotFoundException(messages.t("error.notFound"));
        }
    }

    /** {@link #load} + {@link #assertCanEdit} — the shape almost every mutating endpoint wants. */
    public Tournaments loadForEdit(String idOrSlug) {
        Tournaments t = load(idOrSlug);
        assertCanEdit(t);
        return t;
    }
}
