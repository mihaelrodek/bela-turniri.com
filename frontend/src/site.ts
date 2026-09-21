/* Which PRODUCT this bundle is serving (2026-09-20).

   One codebase, one backend, one game server, one Firebase project — two
   front doors:

     full   bela-turniri.com   tournaments, calendar, map, profiles + igra + blok
     games  bela.games         ONLY igra + blok (plus sign-in, profile, legal)
            belot.games        — an EQUAL twin of bela.games, not a redirect:
                               same shell, same rules, its own address bar

   The lobby, the rooms, the accounts and every rule are shared; `games` is a
   narrower window onto the same house, not a fork. So this module decides
   only what is SHOWN and where links POINT — never what the server does.

   Resolution order:
     1. `VITE_SITE` ("games" | "full") — build-time. The games-only native app
        is built with it, because a Capacitor shell runs on
        `capacitor://localhost` and has no hostname to read.
     2. the hostname — so ONE web build serves both domains from one container.

   Dependency-free on purpose: it is imported by the router, the nav and the
   share helpers, and must never pull a chunk in. */

export type SiteMode = "full" | "games"

export const MAIN_ORIGIN = "https://bela-turniri.com"
export const GAMES_ORIGIN = "https://bela.games"

/** Apex hostnames that ARE the games site — equal twins, each served in its
 *  own right (Caddyfile). `www.` of each is accepted too. A domain that merely
 *  301s to one of these never reaches the SPA and does not belong here. */
export const GAMES_DOMAINS: readonly string[] = ["bela.games", "belot.games"]

/** `hostname` without a leading `www.`, lower-cased. */
function apexOf(hostname: string): string {
    return hostname.toLowerCase().replace(/^www\./, "")
}

/** True for any hostname the games site is served on. */
export function isGamesHost(hostname: string): boolean {
    return GAMES_DOMAINS.includes(apexOf(hostname))
}

function resolveSiteMode(): SiteMode {
    const forced: unknown = import.meta.env.VITE_SITE
    if (forced === "games" || forced === "full") return forced
    if (typeof window === "undefined") return "full"
    return isGamesHost(window.location.hostname) ? "games" : "full"
}

export const siteMode: SiteMode = resolveSiteMode()
export const isGamesSite: boolean = siteMode === "games"

/**
 * The canonical public origin of THIS product, for links that leave the app
 * (share, copy-link, QR). Never `window.location.origin`: in the native shell
 * that is `capacitor://localhost`, which nobody can open.
 */
export const publicOrigin: string = isGamesSite ? gamesOrigin() : MAIN_ORIGIN

/** The twin the visitor is actually on, so a link shared from belot.games
 *  says belot.games. The native app has no hostname and uses the primary. */
function gamesOrigin(): string {
    if (typeof window === "undefined") return GAMES_ORIGIN
    const host = window.location.hostname
    return isGamesHost(host) ? `https://${apexOf(host)}` : GAMES_ORIGIN
}

/** ONE brand for both games domains (bela.games and belot.games are twins,
 *  not two products). Keep in step with GAMES_NAME in vite.config.ts, which
 *  writes the same name into the games HTML shell. */
export const GAMES_BRAND_NAME = "Bela Online"

/** Brand name for titles, share text, notifications. */
export const siteName: string = isGamesSite ? GAMES_BRAND_NAME : "Bela Turniri"

/**
 * The logo/icon files of THIS product. The games site has its own set in
 * `public/games/` — replace those files to rebrand it, nothing else changes.
 * (`vite.config.ts` points the games HTML shell and `manifest.games.webmanifest`
 * at the same files, and Caddy serves them as /favicon.ico and
 * /apple-touch-icon.png on the games hosts.)
 */
export const brand = isGamesSite
    ? { symbolSvg: "/games/symbol.svg", symbolPng: "/games/symbol.png" }
    : { symbolSvg: "/bela-turniri-symbol.svg", symbolPng: "/bela-turniri-symbol.png" }

/** Where "/" and "back to start" lead. */
export const homePath: string = isGamesSite ? "/igra" : "/turniri"

/** Route prefixes that exist only on the full site. Kept here, next to the
 *  mode, so the router, the nav and Caddy's redirect list have ONE list to
 *  stay in sync with (Caddyfile: `@full_only` in the bela.games block). */
const FULL_SITE_ONLY_PREFIXES: readonly string[] = [
    "/turniri",
    "/kalendar",
    "/karta",
    "/pronadi-para",
    "/preuzmi-par",
    "/preuzmi-ime",
    // English legacy aliases of the above
    "/tournaments",
    "/calendar",
    "/map",
    "/find-pair",
    "/claim-pair",
    "/claim-name",
]

/** True when `pathname` is a page the games site does not have. */
export function isFullSiteOnlyPath(pathname: string): boolean {
    return FULL_SITE_ONLY_PREFIXES.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
}

/** Absolute URL of `path` on the full site. */
export function mainSiteUrl(path: string): string {
    return `${MAIN_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`
}
