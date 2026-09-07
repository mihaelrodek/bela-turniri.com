package hr.mrodek.apps.bela_turniri.errors;

import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

/**
 * Bare machine-readable status codes, thrown instead of returned.
 *
 * <p>A handful of endpoints answer with a naked code string rather than the
 * {@link ApiError} envelope — {@code UNPAID_REQUIRED},
 * {@code TOURNAMENT_ALREADY_STARTED}, {@code ALREADY_REGISTERED} and
 * friends. The SPA compares the raw response body against those literals
 * ({@code res.data === "UNPAID_REQUIRED"}), so the wire format is part of
 * the contract and must not drift into the envelope.
 *
 * <p>Those bodies used to be built with {@code return Response.status(...)}
 * inside the controller, which is why the domain rules that produce them
 * could not move out of the controller. Wrapping the identical
 * {@link Response} in a {@link WebApplicationException} lets a service throw
 * one: {@code GenericExceptionMapper} passes a
 * {@code WebApplicationException}'s response through untouched, so the
 * client sees exactly the same status, content type and body as before.
 * The media type is set explicitly here because an exception's response is
 * no longer covered by the resource method's {@code @Produces}.
 */
public final class ApiCodes {

    private ApiCodes() {
    }

    /** 409 with {@code code} as the whole body. */
    public static WebApplicationException conflict(String code) {
        return coded(Response.Status.CONFLICT, code);
    }

    /** 400 with {@code code} as the whole body. */
    public static WebApplicationException badRequest(String code) {
        return coded(Response.Status.BAD_REQUEST, code);
    }

    /** 404 with {@code code} as the whole body. */
    public static WebApplicationException notFound(String code) {
        return coded(Response.Status.NOT_FOUND, code);
    }

    /**
     * Plain 404 with no body at all — distinct from {@link #notFound(String)}.
     * Used where the resource simply doesn't exist and there is no code for
     * the SPA to key on; a {@link jakarta.ws.rs.NotFoundException} would not
     * do here because {@code WebNotFoundExceptionMapper} rewraps it into the
     * {@link ApiError} envelope, which is not this endpoint's wire contract.
     */
    public static WebApplicationException notFound() {
        return new WebApplicationException(Response.status(Response.Status.NOT_FOUND).build());
    }

    private static WebApplicationException coded(Response.Status status, String code) {
        return new WebApplicationException(
                Response.status(status)
                        .type(MediaType.APPLICATION_JSON)
                        .entity(code)
                        .build());
    }
}
