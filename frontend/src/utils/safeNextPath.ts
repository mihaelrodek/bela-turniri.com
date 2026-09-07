/* ──────────────────────────────────────────────────────────────────────────
   Same-site path allowlist for `?next=` (and `state.from`) handoffs.

   Used by `LoginPage` / `RegisterPage` / `RequireAuth` to decide whether
   the redirect-after-login target is safe to navigate to. An attacker
   who can craft a URL like
       https://bela-turniri.com/prijava?next=//evil.tld/phish
   would, without this guard, get the user dumped onto an attacker-controlled
   origin after a real login on our domain. React-router historically
   accepted `//host`, `\\host`, backslash variants, and even `javascript:`
   URIs in `navigate()` — combined with several published advisories in
   the 7.0.0–7.14.2 range — so we treat any non-trivial input as suspect
   and fall back to a known-good route.

   Accepted shapes:
     • A leading "/" path on our SAME origin, with no protocol injection,
       no protocol-relative prefix, and no backslash trick.

   Rejected:
     • Empty / non-string input
     • Absolute URLs (`http://...`, `https://...`)
     • Protocol-relative URLs (`//evil.tld/...`)
     • Backslash variants Windows / IE / WebKit normalise to host changes
       (`/\evil.tld`, `\\evil.tld`)
     • Dangerous schemes (`javascript:`, `data:`, `vbscript:`, `mailto:` —
       any colon before the first `/` past index 0)
     • Bare-host shapes (`evil.tld/foo`) — we want `/foo` style only
   ────────────────────────────────────────────────────────────────────── */

function isSafeNextPath(raw: string | null | undefined): boolean {
    if (!raw || typeof raw !== "string") return false
    if (raw.length > 2048) return false // reject pathological inputs
    // Must be a path on our origin — i.e. start with a single "/" and
    // NOT be a protocol-relative or backslash-escaped host.
    if (!raw.startsWith("/")) return false
    if (raw.startsWith("//")) return false        // //evil.tld/...
    if (raw.startsWith("/\\")) return false       // /\evil.tld → /\/evil.tld
    if (raw.startsWith("/%2f") || raw.startsWith("/%2F")) return false
    if (raw.startsWith("/%5c") || raw.startsWith("/%5C")) return false
    // A colon before any "/" past index 0 indicates a scheme (javascript:,
    // data:, etc.) sneaking in via path encoding tricks. Reject.
    //
    // Only the PATH segment is examined: a colon is perfectly legal inside a
    // query string or fragment (`/turniri?q=10:30`, `/turniri#a:b`), and
    // scanning those rejected legitimate targets — a scheme can only ever
    // appear before the first "?" or "#" anyway.
    const queryOrHash = raw.search(/[?#]/)
    const path = queryOrHash === -1 ? raw : raw.slice(0, queryOrHash)
    const firstSlash = path.indexOf("/", 1)
    const firstColon = path.indexOf(":")
    if (firstColon !== -1 && (firstSlash === -1 || firstColon < firstSlash)) {
        return false
    }
    // No literal CR / LF — header-injection territory.
    if (/[\r\n]/.test(raw)) return false
    return true
}

/**
 * Normalise a react-router `location.state.from` into a path string.
 *
 * `RequireAuth` stores a plain `"/path?query"` string, but other call sites
 * (and anything that predates it) pass the whole location object — reading
 * `.from` as a string there yields `[object Object]`, which fails the guard
 * above and silently drops the user on the default route after login. Accept
 * both shapes; anything else is `null`.
 */
export function nextFromState(state: unknown): string | null {
    if (!state || typeof state !== "object") return null
    const from = (state as { from?: unknown }).from
    if (typeof from === "string") return from
    if (from && typeof from === "object") {
        const loc = from as { pathname?: unknown; search?: unknown }
        if (typeof loc.pathname === "string") {
            const search = typeof loc.search === "string" ? loc.search : ""
            return `${loc.pathname}${search}`
        }
    }
    return null
}

/** Pick the first safe candidate from the provided list (typically the
 *  `?next=` query, then a navigation-state `from`), falling back to
 *  the supplied default route. */
export function pickSafeNext(
    candidates: Array<string | null | undefined>,
    fallback: string,
): string {
    for (const c of candidates) {
        if (isSafeNextPath(c)) return c as string
    }
    return fallback
}
