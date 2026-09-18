package hr.mrodek.apps.bela_turniri.services;

import hr.mrodek.apps.bela_turniri.model.UserProfile;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

/**
 * The one place that turns a {@link UserProfile} into the name and the link a
 * list row should show.
 *
 * <p>It exists because of account deletion. A deleted account keeps its row
 * (so its slug can never be re-issued) but has no display name left, and every
 * "Prijavio: …" chip, partner link and co-owner label that read
 * {@code profile.getDisplayName()} directly would render an empty string —
 * or, worse, a live-looking link to a profile that now 404s. Routing those
 * reads through here means the deleted state is decided once instead of at a
 * dozen DTO sites.
 *
 * <p>{@link #nameOf} returns the localised {@code profile.deletedUser} string
 * ("Obrisani korisnik" / "Izbrisan uporabnik") for a deleted row, and
 * {@link #slugOf} returns null so the UI renders plain text rather than a dead
 * link. Both tolerate a null profile — an unclaimed pair has no submitter at
 * all, which is a different thing from a deleted one and stays null.
 *
 * <p>The locale is the CALLER's (request-scoped), which is right here: unlike
 * a push notification, this text is rendered into the response the caller is
 * reading right now.
 */
@ApplicationScoped
public class DisplayNames {

    /** i18n key for the stand-in shown in place of a deleted account's name. */
    public static final String DELETED_USER_KEY = "profile.deletedUser";

    @Inject MessageService messages;

    /** Display name to render, or null when there is no profile at all. */
    public String nameOf(UserProfile profile) {
        if (profile == null) return null;
        if (profile.isDeleted()) return messages.t(DELETED_USER_KEY);
        return profile.getDisplayName();
    }

    /** Profile slug to link to, or null when there is nothing to link to. */
    public String slugOf(UserProfile profile) {
        if (profile == null || profile.isDeleted()) return null;
        return profile.getSlug();
    }

    /** The stand-in label on its own — for rows where the profile row is gone entirely. */
    public String deletedLabel() {
        return messages.t(DELETED_USER_KEY);
    }
}
