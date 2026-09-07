package hr.mrodek.apps.bela_turniri.repository;

import hr.mrodek.apps.bela_turniri.model.ContactMessage;
import io.quarkus.panache.common.Page;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;

@ApplicationScoped
public class ContactMessageRepository implements AppRepository<ContactMessage, Long> {

    /**
     * Newest first, capped. The admin screen is a triage inbox, not an
     * archive browser — an unbounded {@code listAll()} here would happily
     * serialise every message ever sent once the form has been live a while.
     */
    public List<ContactMessage> findRecent(int limit) {
        return findAll(Sort.by("createdAt").descending())
                .page(Page.ofSize(Math.max(1, limit)))
                .list();
    }

    /** Messages nobody has answered yet. */
    public long countUnhandled() {
        return count("handled = false");
    }
}
