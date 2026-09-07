package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.model.ContactMessage;
import hr.mrodek.apps.bela_turniri.repository.ContactMessageRepository;
import hr.mrodek.apps.bela_turniri.services.MessageService;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Admin-only read side of the contact form.
 *
 * <p>A separate resource from {@code ContactController} purely so the paths
 * can be honest — {@code /admin/contact-messages} rather than a
 * {@code /contact/admin/...} sub-path — and separate from
 * {@code AdminController} so the contact feature stays self-contained.
 *
 * <p>Everything here is {@code @RolesAllowed("admin")}: the rows contain the
 * sender's e-mail address and IP.
 */
@Path("/admin/contact-messages")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RolesAllowed("admin")
public class AdminContactController {

    /** Hard cap on one page of the triage inbox. */
    private static final int LIMIT = 100;

    @Inject ContactMessageRepository repo;
    @Inject MessageService messages;

    public record ContactMessageDto(
            Long id, String createdAt, String name, String email, String subject,
            String message, String userUid, String ip, String locale, boolean handled
    ) {}

    /** Body of the PATCH — {@code null} is treated as "mark handled". */
    public record SetHandledBody(Boolean handled) {}

    /** Newest first, capped at {@value #LIMIT}. */
    @GET
    public List<ContactMessageDto> list() {
        return repo.findRecent(LIMIT).stream().map(AdminContactController::toDto).toList();
    }

    /** Flips the triage flag. Clearing it puts the message back in the queue. */
    @PATCH
    @Path("/{id}/handled")
    @Transactional
    public ContactMessageDto setHandled(@PathParam("id") Long id, SetHandledBody body) {
        ContactMessage msg = repo.findByIdOptional(id)
                .orElseThrow(() -> new NotFoundException(messages.t("contact.notFound")));
        msg.setHandled(body == null || body.handled() == null || body.handled());
        repo.save(msg);
        return toDto(msg);
    }

    private static ContactMessageDto toDto(ContactMessage m) {
        return new ContactMessageDto(
                m.getId(),
                m.getCreatedAt() == null ? null
                        : m.getCreatedAt().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME),
                m.getName(),
                m.getEmail(),
                m.getSubject(),
                m.getMessage(),
                m.getUserUid(),
                m.getIp(),
                m.getLocale(),
                m.isHandled());
    }
}
