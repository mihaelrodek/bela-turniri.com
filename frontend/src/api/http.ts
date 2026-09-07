import axios, { type AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios"
import { signOut } from "firebase/auth"
import { auth } from "../firebase"
import { getLocale, t } from "../i18n"
import { showError, showSuccess, statusFallback } from "../toaster"

const baseURL = import.meta.env.VITE_API_URL ?? "/api"

/**
 * Per-request flag the call sites can set to opt out of automatic toasts.
 * Useful for high-frequency or background reads (profile sync, polling,
 * health checks) where a toast would just be noise.
 *
 * Usage:
 *   http.get("/foo", { silent: true })
 *   http.post("/bar", body, { silent: true })
 *
 * No `as any` needed — this type is declaration-merged into axios's own
 * `AxiosRequestConfig` below, so `silent`/`successMessage`/`errorMessage`/
 * `silentErrorStatuses` are real, typed options on every call site.
 */
type ToastOpts = {
    /** When true, neither success nor error toasts are shown for this call. */
    silent?: boolean
    /** Override the success toast title (e.g. "Turnir je kreiran"). */
    successMessage?: string
    /** Override the error toast title (the body message becomes the description). */
    errorMessage?: string
    /**
     * Suppress the auto-generated error toast for certain failures without
     * suppressing success toasts on the happy path. Useful when the caller
     * already shows its own context-aware UI for specific status codes —
     * e.g. starting a tournament returns 409 UNPAID_REQUIRED and the page
     * opens an "unpaid pairs" modal; a generic red toast saying
     * UNPAID_REQUIRED on top of that would be noise.
     *
     * Pass `true` to silence ALL error toasts for this call, or an array of
     * HTTP status codes to silence only specific ones.
     */
    silentErrorStatuses?: true | number[]
}

declare module "axios" {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface AxiosRequestConfig extends ToastOpts {}
    interface InternalAxiosRequestConfig extends ToastOpts {
        /**
         * Internal latch: set once a 401 has been retried with a force-refreshed
         * ID token, so a still-401 retry can never loop.
         */
        _retried?: boolean
    }
}

export const http = axios.create({
    baseURL,
    headers: { "Content-Type": "application/json" },
})

/**
 * Attach the current Firebase ID token (if any) to every outgoing request.
 * The Firebase SDK caches and auto-refreshes the token internally, so calling
 * `getIdToken()` is cheap and always returns a fresh, unexpired JWT.
 *
 * Anonymous traffic (no signed-in user) is left as-is — the backend's permission
 * policies allow GETs without auth and only require it on writes.
 */
http.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    // Wait for the persisted session to be restored before reading
    // currentUser. On a cold page load currentUser is null for a moment even
    // for a signed-in user — the very first requests then went out WITHOUT
    // the bearer, so auth-dependent reads (own profile, the organiser-only
    // fields on a tournament) intermittently returned the anonymous variant.
    // Resolves immediately once known; guests resolve to null just as fast.
    await auth.authStateReady()
    const u = auth.currentUser
    if (u) {
        try {
            const token = await u.getIdToken()
            config.headers = config.headers ?? {}
            ;(config.headers as Record<string, string>)["Authorization"] = `Bearer ${token}`
        } catch {
            // Token fetch failed — let the request go without auth header
            // (server will reject with 401 if the endpoint requires auth, which
            // the UI already handles).
        }
    }
    return config
})

/**
 * Tell the backend which language to answer in.
 *
 * A separate interceptor from the auth one above on purpose: that one awaits
 * `auth.authStateReady()` and can fail, and the locale header must be attached
 * to anonymous traffic too. `getLocale()` is a plain module read (src/i18n) —
 * no hook, no await — so this stays synchronous.
 *
 * The backend's `filters/LocaleRequestFilter` reads `X-Locale` into the
 * request-scoped locale that `MessageService` uses, so error envelopes and
 * validation messages come back in the user's language. The header is on the
 * CORS allowlist (`quarkus.http.cors.headers` in application.properties).
 */
http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    config.headers = config.headers ?? {}
    ;(config.headers as Record<string, string>)["X-Locale"] = getLocale()
    return config
})

/**
 * Mutation methods get success toasts; reads stay quiet to avoid noise.
 * The set is intentional — adding HEAD/OPTIONS would not be useful, and
 * GETs that fail still surface as error toasts via the response interceptor.
 */
const TOAST_ON_SUCCESS = new Set(["post", "put", "patch", "delete"])

/**
 * Pull a human-friendly message out of a backend error response. Quarkus's
 * default error mappers return JSON like {"message": "..."} for many of our
 * thrown exceptions; some (e.g. BadRequestException with a string body) come
 * back as plain text. Cover both shapes plus a generic fallback.
 */
function extractServerMessage(err: AxiosError): string | null {
    const data = err.response?.data as unknown
    if (typeof data === "string" && data.trim()) return data.trim()
    if (data && typeof data === "object") {
        const d = data as Record<string, unknown>
        if (typeof d.message === "string" && d.message.trim()) return d.message.trim()
        if (typeof d.error === "string" && d.error.trim()) return d.error.trim()
        if (typeof d.detail === "string" && d.detail.trim()) return d.detail.trim()
    }
    return null
}

/**
 * True when a response body is an HTML *document* rather than our JSON API.
 *
 * During a production deploy Caddy serves a static maintenance page for EVERY
 * route — including `/api/*`. The already-loaded SPA then fires an XHR and gets
 * that HTML back instead of JSON. Without this guard the error interceptor
 * would dump the raw HTML source straight into a red toast.
 */
function isHtmlDocument(data: unknown, headers: unknown): boolean {
    const ct = String(
        (headers as Record<string, unknown> | undefined)?.["content-type"] ?? "",
    ).toLowerCase()
    if (ct.includes("text/html")) return true
    if (typeof data === "string") return /^\s*<(!doctype\s+html|html[\s>])/i.test(data)
    return false
}

/**
 * Specifically the deploy maintenance page, as opposed to some proxy/CDN error
 * page that also happens to be HTML. `public/maintenance.html` carries a
 * `data-maintenance` attribute on its <html> element purely as this marker;
 * the Croatian headline is checked too so an older page still matches.
 */
function isMaintenanceHtml(data: unknown): boolean {
    return typeof data === "string"
        && (/data-maintenance/i.test(data) || /nadogradnja u tijeku/i.test(data))
}

/**
 * Send the tab to the static maintenance page. Guarded so several in-flight
 * requests failing at once can't trigger a navigation loop.
 */
let maintenanceRedirectStarted = false
function goToMaintenancePage() {
    if (maintenanceRedirectStarted) return
    maintenanceRedirectStarted = true
    if (typeof window === "undefined") return
    if (window.location.pathname === "/maintenance.html") return
    window.location.assign("/maintenance.html")
}

/** Routes where bouncing to the login page would be a no-op or a loop. */
const AUTH_ROUTES = new Set(["/prijava", "/registracija"])

/**
 * Hard-navigate to the login page carrying a `?next=` back-link, at most once
 * per 10 s. A single expired session usually fails several parallel requests;
 * without the guard each one would fire its own `location.assign` and the
 * browser would thrash. `assign` (not react-router) is deliberate: an expired
 * session means every cached query is suspect, so a full document reload is
 * the cheapest way to get back to a clean state.
 *
 * The timestamp lives in sessionStorage because the redirect DESTROYS the JS
 * context — a module-level variable resets to 0 on the very navigation it is
 * meant to throttle, so a 401 fired again right after the reload would bounce
 * the browser a second time. The in-memory copy is the fallback for private
 * modes where sessionStorage throws.
 */
const SESSION_REDIRECT_KEY = "bela-auth-redirect-at"
let lastSessionRedirectAt = 0

function readLastRedirectAt(): number {
    try {
        const raw = window.sessionStorage.getItem(SESSION_REDIRECT_KEY)
        const n = raw ? Number(raw) : 0
        return Number.isFinite(n) ? n : 0
    } catch {
        return lastSessionRedirectAt
    }
}

function writeLastRedirectAt(at: number) {
    lastSessionRedirectAt = at
    try {
        window.sessionStorage.setItem(SESSION_REDIRECT_KEY, String(at))
    } catch {
        /* private mode — the in-memory copy is all we get */
    }
}

async function goToLoginWithNext() {
    if (typeof window === "undefined") return
    const { pathname, search } = window.location
    if (AUTH_ROUTES.has(pathname)) return
    const now = Date.now()
    if (now - readLastRedirectAt() < 10_000) return
    writeLastRedirectAt(now)
    // Drop the dead Firebase session BEFORE navigating, so the login page's
    // "already signed in" effect can't bounce the user straight back out. The
    // hash is deliberately dropped: `safeNextPath` only ever hands back a
    // path + query, and a fragment is client-only state anyway.
    try {
        await signOut(auth)
    } catch {
        /* best-effort — navigate regardless */
    }
    const next = `${pathname}${search}`
    window.location.assign(`/prijava?next=${encodeURIComponent(next)}`)
}

http.interceptors.response.use(
    (resp: AxiosResponse) => {
        // A 2xx whose body is an HTML document means the host served the
        // maintenance page in place of our JSON (deploy in progress). Send the
        // browser there instead of letting the SPA render an HTML string as
        // data.
        if (isHtmlDocument(resp.data, resp.headers)) {
            if (isMaintenanceHtml(resp.data)) goToMaintenancePage()
            else showError(t("common.appUpdating"))
            // REJECT — returning `resp` would hand an HTML string to a caller
            // that types it as a DTO, and the page would render garbage (or
            // persist it into the query cache) instead of its error state.
            return Promise.reject(new Error("HTML_RESPONSE"))
        }
        const cfg = (resp.config ?? {}) as InternalAxiosRequestConfig
        if (cfg.silent) return resp
        const method = (cfg.method ?? "get").toLowerCase()
        if (TOAST_ON_SUCCESS.has(method)) {
            showSuccess(cfg.successMessage ?? t("common.saved"))
        }
        return resp
    },
    async (err: AxiosError) => {
        const cfg = (err.config ?? {}) as InternalAxiosRequestConfig
        const status = err.response?.status
        const suppress =
            cfg.silent === true
            || cfg.silentErrorStatuses === true
            || (Array.isArray(cfg.silentErrorStatuses)
                && typeof status === "number"
                && cfg.silentErrorStatuses.includes(status))

        // The response is an HTML page, not our JSON API — almost always the
        // deploy maintenance page (served for every route mid-release) or a
        // proxy/CDN error page. NEVER show the raw HTML source in a toast.
        // Navigate to the maintenance page when we recognise it; otherwise show
        // a short, friendly "temporarily unavailable" message.
        if (isHtmlDocument(err.response?.data, err.response?.headers)) {
            if (isMaintenanceHtml(err.response?.data)) {
                goToMaintenancePage()
            } else if (!suppress) {
                showError(t("common.appUpdating"))
            }
            return Promise.reject(err)
        }

        // A 401 for a signed-in user is usually just a token that expired
        // between the request interceptor reading it and the backend checking
        // it (clock skew, a long-queued request, a revoked-then-reissued
        // session). Force ONE token refresh and replay the original request
        // before declaring the session dead — `_retried` makes a second 401 on
        // the replay fall through to the sign-out path instead of looping.
        if (status === 401 && auth.currentUser && !cfg._retried && err.config) {
            cfg._retried = true
            let refreshed = false
            try {
                await auth.currentUser.getIdToken(true)
                refreshed = true
            } catch {
                // Refresh failed — the session really is gone; fall through to
                // the sign-out path below.
            }
            if (refreshed) {
                // The request interceptor re-reads the (now fresh) token and
                // overwrites the stale Authorization header on this config.
                // If the replay 401s again it re-enters this interceptor with
                // `_retried` already set and takes the sign-out path there, so
                // its rejection is returned untouched — no double toast.
                return http(cfg)
            }
        }

        // Expired / revoked session. Only meaningful when we actually believed
        // someone was signed in — an anonymous 401 just means the endpoint
        // needs auth and the calling UI already handles that, so it rejects
        // silently rather than nagging a guest to "sign in again".
        if (status === 401 && auth.currentUser && cfg.silent !== true) {
            showError(t("common.sessionExpired"))
            // Signs the dead session out and then redirects (throttled).
            void goToLoginWithNext()
            return Promise.reject(err)
        }
        // Anonymous 401: the endpoint simply requires auth. The calling UI
        // already renders its own "prijavi se" affordance, so reject quietly.
        if (status === 401) return Promise.reject(err)

        if (!suppress) {
            const serverMsg = extractServerMessage(err)
            const fallback = statusFallback(status)
            // Prefer the explicit per-call title when set; else the server's
            // own message; else a status-derived fallback. Description is the
            // server message when we used a per-call title (so both show).
            if (cfg.errorMessage) {
                showError(cfg.errorMessage, serverMsg ?? fallback)
            } else {
                showError(serverMsg ?? fallback)
            }
        }
        return Promise.reject(err)
    },
)
