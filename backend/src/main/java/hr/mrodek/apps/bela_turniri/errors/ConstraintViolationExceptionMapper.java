package hr.mrodek.apps.bela_turniri.errors;

import hr.mrodek.apps.bela_turniri.services.MessageService;
import jakarta.inject.Inject;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import org.jboss.logging.Logger;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Maps JSR-303 validation failures to a 400 with a per-field error map.
 * The property path is shortened to the leaf name so consumers don't have to
 * parse JAX-RS-flavoured paths like "create.req.name".
 *
 * <p>Per-field messages are localised here rather than by Hibernate
 * Validator: the DTO annotations carry a {@link hr.mrodek.apps.bela_turniri.services.MessageService}
 * key ({@code validation.*}) as their {@code message}, and this mapper
 * resolves it against the caller's {@code X-Locale}. Doing it at the mapper
 * keeps the whole backend on one bundle instead of adding a parallel
 * {@code ValidationMessages.properties} + locale-resolver stack.
 */
@Provider
public class ConstraintViolationExceptionMapper implements ExceptionMapper<ConstraintViolationException> {

    private static final Logger LOG = Logger.getLogger(ConstraintViolationExceptionMapper.class);

    @Inject MessageService messages;

    @Override
    public Response toResponse(ConstraintViolationException ex) {
        Map<String, List<String>> details = new LinkedHashMap<>();

        for (ConstraintViolation<?> cv : ex.getConstraintViolations()) {
            String field = leafName(cv.getPropertyPath().toString());
            // The DTOs carry a bundle KEY in their `message =` attribute
            // (e.g. "validation.tournament.name.max"), not literal Croatian,
            // so the per-field text comes back in the caller's language.
            // MessageService returns an unknown key unchanged, so a
            // constraint left on its built-in default message (e.g. a bare
            // @NotNull) still passes through verbatim.
            details.computeIfAbsent(field, k -> new ArrayList<>()).add(messages.t(cv.getMessage()));
        }

        // DEBUG only: bean-validation rejections are caller errors. Logging
        // the field map (not the submitted values) keeps PII out of the log
        // while still telling us which constraint the SPA tripped over.
        LOG.debugf("400 VALIDATION_FAILED: %s", details);
        return Response.status(Response.Status.BAD_REQUEST)
                .type(MediaType.APPLICATION_JSON)
                .entity(ApiError.of("VALIDATION_FAILED", messages.t("error.validationFailed"), details))
                .build();
    }

    private static String leafName(String path) {
        if (path == null || path.isEmpty()) return "_";
        int i = path.lastIndexOf('.');
        return (i < 0) ? path : path.substring(i + 1);
    }
}
