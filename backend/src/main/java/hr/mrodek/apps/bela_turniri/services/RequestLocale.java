package hr.mrodek.apps.bela_turniri.services;

import jakarta.enterprise.context.RequestScoped;

import java.util.Locale;

/**
 * The language the CURRENT request asked for, resolved once per request by
 * {@link hr.mrodek.apps.bela_turniri.filters.LocaleRequestFilter} from the
 * {@code X-Locale} header the SPA sends (see {@code frontend/src/api/http.ts}),
 * with {@code Accept-Language} as a fallback.
 *
 * <p>{@link MessageService#t(String, Object...)} reads this instead of always
 * using {@link MessageService#DEFAULT_LOCALE}, so a call site becomes
 * locale-aware without any change of its own.
 *
 * <p>Request-scoped rather than a field on the (application-scoped)
 * {@link MessageService} or on the filter: concurrent requests run on
 * different threads and must never see each other's language.
 */
@RequestScoped
public class RequestLocale {

    private Locale locale = MessageService.DEFAULT_LOCALE;

    public Locale get() {
        return locale;
    }

    public void set(Locale locale) {
        this.locale = locale != null ? locale : MessageService.DEFAULT_LOCALE;
    }
}
