import { readFile, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig, type Plugin } from "vite"
import react from "@vitejs/plugin-react"

/* ──────────────────────────────────────────────────────────────────────────
   OFFLINE PRECACHE MANIFEST — what `public/sw.js` has to put in Cache Storage
   so an installed PWA opened with no signal still reaches /blok.

   THE LIST CANNOT BE HAND-WRITTEN. Every chunk Vite emits carries a content
   hash (`BlokPage-BEklaU9U.js`), so a literal array in sw.js would name last
   deploy's files and be wrong from the first `npm run build`. It also cannot
   be derived at RUNTIME by the worker: index.html only names the entry, and
   the route chunk for /blok is reached through a dynamic import that nothing
   in the served HTML mentions.

   So Rollup is asked, at the only moment the answer exists — `generateBundle`,
   with the finished bundle in hand. Two roots:

     • every ENTRY chunk (the app shell's JS), and
     • the chunk that /blok's `React.lazy` resolves to, found by its
       `facadeModuleId` rather than by name, so renaming the file cannot
       silently empty the precache.

   From each root we follow STATIC imports only (`chunk.imports`), plus the CSS
   and assets Vite attributes to each chunk. Static-only is the whole point of
   the closure: it is exactly "what the browser must already have to execute
   this module", so `vendor-map` (Leaflet, only ever dynamically imported by
   /karta) and every other route's chunk stay out of a cache meant for one
   screen. Following `dynamicImports` as well would precache the entire app.

   The output is `/precache-manifest.json`, read by the worker on install and
   again on every page load (see `public/sw.js` → `refreshPrecache`). It is a
   plain public file: no auth, no per-user content, nothing but file names.

   WHY AN ARTEFACT AND NOT A GENERATED sw.js: the worker is `public/sw.js`,
   copied verbatim, and a browser only re-installs a worker whose BYTES
   changed. A worker that carried the file list inside itself would therefore
   need to be rewritten (and re-installed) on every deploy; one that fetches a
   manifest re-checks the current build on every load without the install
   dance. `build` below is the entry chunk's hashed name — a build identity
   that changes exactly when the output does, with no timestamp to make two
   builds of the same source differ.
   ────────────────────────────────────────────────────────────────────── */

/**
 * The modules `App.tsx` reaches through `React.lazy` that MUST still be on the
 * device with no signal, each named by source path so a renamed output chunk
 * cannot silently empty the precache.
 *
 *  • `BlokPage` — the offline scorepad itself, the whole point of the cache.
 *  • `BlokOutbox` — app-shell chrome, mounted on EVERY route. It is lazy so
 *    the blok store stays out of the entry bundle, but that makes it the one
 *    lazy import whose failure is not scoped to a route: it is a sibling of
 *    the router, so an offline import error there reaches the root
 *    ErrorBoundary and replaces the entire app — including /blok — with the
 *    offline notice. Precached, the worker answers from cache and the outbox
 *    mounts offline exactly as it did when it was an eager import.
 *  • `i18n/hr/blok.ts` — the scorepad's STRINGS. The `blok` dictionary
 *    namespace is route-scoped (src/i18n/index.ts): App.tsx's /blok route
 *    awaits `loadNamespace("blok")` next to the page chunk, which is a
 *    DYNAMIC import and therefore outside BlokPage's static closure — the
 *    walk below would never reach it. Without it the offline scorepad boots
 *    and then renders every label as a raw "blok.…" key. Croatian only, on
 *    purpose: `sl/index.ts` is not precached either, so a Slovenian player
 *    offline already falls back to Croatian text, which is the behaviour this
 *    keeps rather than doubling the cache for it.
 *
 * 4. `src/firebaseAuthModule.ts` (2026-09-14, deferred-Firebase change): the
 *    only file with a static `firebase/*` import, reached from `firebase.ts`
 *    through one memoised `import()` so the SDK is off the eager path (see
 *    `AuthContext.tsx`). That makes it a dynamic-import root too, and without
 *    it `vendor-firebase` falls out of the offline cache entirely: an
 *    installed PWA opened with no signal would fail to resolve auth state,
 *    read as signed-out, and show "Prijava" in the navbar even for a user
 *    who is very much signed in — while `BlokOutbox` (which gates uploads on
 *    `user !== null`) silently queues them, which is correct offline, but the
 *    identity shown on screen would not be.
 */
const OFFLINE_ROUTE_MODULES = [
    "src/blok/pages/BlokPage.tsx",
    "src/blok/BlokOutbox.tsx",
    "src/i18n/hr/blok.ts",
    "src/firebaseAuthModule.ts",
]

/* The online table is deliberately warmed as one unit. Its scanned mađarice
 * are emitted as content-hashed /assets files by `imageAssets.ts`; including
 * imported assets only while walking these route roots keeps the offline blok
 * light while ensuring a player never waits on a card image mid-deal. */
const GAME_ROUTE_MODULES = [
    "src/game/GameFeatureGate.tsx",
    "src/game/components/GameIdentityGate.tsx",
    "src/game/components/ActiveRoomWidget.tsx",
    "src/game/components/GameRoomExitGuard.tsx",
    "src/game/pages/GameLobbyPage.tsx",
    "src/game/pages/GameRoomPage.tsx",
    "src/i18n/hr/game.ts",
]

const PRECACHE_ROUTE_MODULES = [...OFFLINE_ROUTE_MODULES, ...GAME_ROUTE_MODULES]

function precacheManifest(): Plugin {
    return {
        name: "bela-precache-manifest",
        apply: "build",
        generateBundle(_options, bundle) {
            const files = new Set<string>()
            const assetsWalked = new Set<string>()

            const walk = (fileName: string, includeAssets = false) => {
                const entry = bundle[fileName]
                if (!entry || entry.type !== "chunk") return
                const key = `/${fileName}`
                if (files.has(key) && (!includeAssets || assetsWalked.has(fileName))) return
                files.add(key)
                for (const css of entry.viteMetadata?.importedCss ?? []) files.add(`/${css}`)
                if (includeAssets) {
                    assetsWalked.add(fileName)
                    for (const asset of entry.viteMetadata?.importedAssets ?? []) {
                        if (asset.startsWith("assets/") && !asset.includes("..")) files.add(`/${asset}`)
                    }
                }
                for (const imported of entry.imports) walk(imported, includeAssets)
            }

            const found = new Set<string>()
            for (const [fileName, entry] of Object.entries(bundle)) {
                if (entry.type !== "chunk") continue
                const facade = entry.facadeModuleId?.replaceAll("\\", "/") ?? ""
                if (entry.isEntry) walk(fileName)
                for (const module of PRECACHE_ROUTE_MODULES) {
                    if (!facade.endsWith(module)) continue
                    found.add(module)
                    walk(fileName, GAME_ROUTE_MODULES.includes(module))
                }
            }

            // Loud, not silent: a precache without a route it promises to
            // serve offline would look valid until a phone loses its signal.
            const missing = PRECACHE_ROUTE_MODULES.filter((m) => !found.has(m))
            if (missing.length > 0) {
                this.error(
                    `precache manifest: no chunk for ${missing.join(", ")}. `
                    + "Did the module move, or is it no longer lazily imported? "
                    + "The offline route cache depends on this.",
                )
            }

            const entryChunk = Object.values(bundle).find(
                (entry) => entry.type === "chunk" && entry.isEntry,
            )

            this.emitFile({
                type: "asset",
                fileName: "precache-manifest.json",
                source: `${JSON.stringify(
                    {
                        build: entryChunk?.fileName ?? "unknown",
                        files: [...files].sort(),
                    },
                    null,
                    4,
                )}\n`,
            })
        },
    }
}

/* ──────────────────────────────────────────────────────────────────────────
   THE SECOND FRONT DOOR'S HTML SHELL — `dist/index.games.html`.

   The games domains (bela.games AND its equal twin belot.games) serve the
   SAME bundle as bela-turniri.com from the SAME container (see the
   Caddyfile's site blocks and `src/site.ts`, which picks the product from
   the hostname at runtime). What they cannot share is
   the <head>: title, description, canonical, Open Graph/Twitter card, the
   JSON-LD and the manifest link all name the full site, and a crawler or a
   link-unfurler reads exactly those bytes — it never runs `site.ts`.

   So this plugin derives a second shell from the FINISHED `dist/index.html`,
   after Vite has injected the hashed <script>/<link> tags. Deriving it (not
   maintaining a second index.html) is the whole point: the two shells can
   never drift on the parts that matter for booting the app — the asset tags
   are byte-identical, because they are copied from the real build output.
   Caddy serves this file as `/` and as the SPA fallback on bela.games.

   EVERY substitution is asserted, with the expected occurrence count. A
   wrong count fails the build loudly instead of silently shipping a page
   titled "Bela Turniri" on bela.games — a failure nobody would notice for
   weeks, by which time Google has indexed it. If you edit index.html's head
   and this build starts failing, that is the mechanism working: update the
   constants below in the same commit.
   ────────────────────────────────────────────────────────────────────── */

/** Strings from `index.html` this transform rewrites, with how many times
 *  each must appear in the built shell. */
const MAIN_TITLE = "Bela Turniri — turniri u beli, online bela i zapisnik"
const MAIN_DESCRIPTION = "Platforma za vođenje i praćenje turnira u beli. Kreiraj turnir, prikupi prijave parova i objavi rezultate, igraj belu online i vodi zapisnik partije u bloku."
const MAIN_OG_CARD = "https://bela-turniri.com/bela-turniri-og-card.png"

/** Croatian copy for the games domains. They show only the online game and
 *  the scorepad, so the promise made in a search result or a WhatsApp
 *  preview has to be exactly that — nothing about organising tournaments.
 *
 *  ONE shell is served by BOTH bela.games and belot.games, so every absolute
 *  URL in it names the CANONICAL twin, bela.games: identical content on two
 *  hostnames is duplicate content, and a canonical that follows the host
 *  would just put two competing copies in the index instead of consolidating
 *  them. belot.games still serves the app in full — it simply tells crawlers
 *  which name to rank. Keep this in step with GAMES_ORIGIN in
 *  frontend/src/site.ts. */
const GAMES_ORIGIN = "https://bela.games"
/** Keep in step with GAMES_BRAND_NAME in frontend/src/site.ts. */
const GAMES_NAME = "Bela Online"
const GAMES_TITLE = `${GAMES_NAME} — igraj belu i vodi zapisnik`
const GAMES_DESCRIPTION = "Igraj belu online protiv prijatelja ili botova i vodi zapisnik partije u bloku. Besplatno, bez instalacije, u pregledniku i na mobitelu."

function gamesShell(): Plugin {
    let outDir = ""

    /** Replace `find` with `to`, insisting it occurred exactly `times`. */
    const swap = (html: string, find: string, to: string, times: number, what: string) => {
        const seen = html.split(find).length - 1
        if (seen !== times) {
            throw new Error(
                `index.games.html: expected ${times}× ${what} in the built shell, found ${seen}. `
                + `Did index.html's <head> change? Searched for: ${JSON.stringify(find.slice(0, 120))}`,
            )
        }
        return html.split(find).join(to)
    }

    const transform = (html: string) => {
        let out = html

        // Title, description and the OG card image. Each appears in several
        // tags (title + og:title + og:image:alt; description + og:description;
        // og:image + og:image:secure_url + twitter:image), which is why the
        // counts below are what they are.
        out = swap(out, MAIN_TITLE, GAMES_TITLE, 3, "the site title")
        out = swap(out, MAIN_DESCRIPTION, GAMES_DESCRIPTION, 2, "the site description")
        // Same picture, served from this domain: the file is in public/ and
        // therefore exists on both hosts, and an og:image on the same origin
        // as og:url is what every unfurler expects.
        // `-v2` in the name on purpose (2026-09-21 redesign): WhatsApp, Viber and
        // Facebook cache a preview image by its URL for weeks, so a new picture
        // under the old name would simply never be fetched. Bump the suffix the
        // next time the card changes. JPEG, not PNG: the card carries card art
        // and a gradient (558 KB as PNG, ~150 KB as JPEG) and WhatsApp drops
        // previews whose image is too heavy.
        out = swap(out, MAIN_OG_CARD, `${GAMES_ORIGIN}/games/og-card-v2.jpg`, 3, "the OG card URL")
        out = swap(out, `<meta property="og:image:type" content="image/png" />`, `<meta property="og:image:type" content="image/jpeg" />`, 1, "the OG image type")

        // The games brand has its own logo files in public/games/ — replace
        // those files to rebrand, this transform only points at them.
        out = swap(out, `<link rel="icon" href="/favicon.ico" sizes="any" />`, `<link rel="icon" href="/games/favicon.ico" sizes="any" />`, 1, "the favicon.ico link")
        out = swap(out, `<link rel="icon" type="image/svg+xml" href="/bela-turniri-symbol.svg" />`, `<link rel="icon" type="image/svg+xml" href="/games/favicon.svg" /><link rel="icon" type="image/svg+xml" href="/games/favicon-mini.svg" sizes="16x16" />`, 1, "the svg icon link")
        out = swap(out, `<link rel="apple-touch-icon" href="/apple-touch-icon.png" />`, `<link rel="apple-touch-icon" href="/games/apple-touch-icon.png" />`, 1, "the apple-touch-icon link")
        out = swap(out, `<img class="boot-logo" src="/bela-turniri-symbol.svg"`, `<img class="boot-logo" src="/games/symbol.svg"`, 1, "the boot-screen logo")

        out = swap(
            out,
            `<meta property="og:url" content="https://bela-turniri.com/" />`,
            `<meta property="og:url" content="${GAMES_ORIGIN}/" />`,
            1,
            "og:url",
        )
        out = swap(
            out,
            `<meta property="og:site_name" content="Bela Turniri" />`,
            `<meta property="og:site_name" content="${GAMES_NAME}" />`,
            1,
            "og:site_name",
        )
        out = swap(
            out,
            `<meta name="application-name" content="Bela Turniri" />`,
            `<meta name="application-name" content="${GAMES_NAME}" />`,
            1,
            "application-name",
        )
        out = swap(
            out,
            `<meta name="apple-mobile-web-app-title" content="Bela Turniri" />`,
            `<meta name="apple-mobile-web-app-title" content="${GAMES_NAME}" />`,
            1,
            "apple-mobile-web-app-title",
        )
        // This domain's own PWA identity: name, start_url /igra, its own
        // shortcuts. Caddy ALSO rewrites /manifest.webmanifest to the same
        // file on bela.games, so the service worker's shell precache (which
        // asks for the canonical name) gets the right one too.
        out = swap(
            out,
            `<link rel="manifest" href="/manifest.webmanifest" />`,
            `<link rel="manifest" href="/manifest.games.webmanifest" />`,
            1,
            "the manifest link",
        )

        // index.html carries no <link rel="canonical"> (useDocumentHead sets
        // one per route client-side). A crawler that does not run JS has to
        // be told which origin owns this page, or the several domains serving
        // one bundle look like duplicate content — so add it here, right
        // before the title. Always bela.games, including when this exact file
        // is served on belot.games; see GAMES_ORIGIN above.
        out = swap(
            out,
            "<title>",
            `<link rel="canonical" href="${GAMES_ORIGIN}/" />\n    <title>`,
            1,
            "the <title> tag",
        )

        // JSON-LD: the full site's block advertises a SearchAction over
        // /turniri?q=, a page that does not exist on this domain (Caddy 301s
        // it away). Replace both records with a plain WebSite + Organization
        // for bela.games.
        const ldBlocks = out.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) ?? []
        if (ldBlocks.length !== 2) {
            throw new Error(
                `index.games.html: expected 2 JSON-LD blocks in the built shell, found ${ldBlocks.length}. `
                + "Update the JSON-LD rewrite in vite.config.ts.",
            )
        }
        const ld = (value: unknown) => `<script type="application/ld+json">\n    ${JSON.stringify(value, null, 2).split("\n").join("\n    ")}\n    </script>`
        out = out.replace(ldBlocks[0], ld({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: GAMES_NAME,
            url: `${GAMES_ORIGIN}/`,
            inLanguage: "hr",
        }))
        out = out.replace(ldBlocks[1], ld({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: GAMES_NAME,
            url: `${GAMES_ORIGIN}/`,
            logo: `${GAMES_ORIGIN}/games/symbol.png`,
            sameAs: [],
        }))

        // BEST-EFFORT (deliberately not asserted): the first-screen seed in
        // index.html prefetches /api/seed for "/" because on the full site
        // "/" IS the tournament listing. On bela.games "/" is the game, so
        // that request would fetch a listing nothing renders. If the line
        // ever changes shape the games shell simply keeps the harmless extra
        // fetch rather than failing a build over a performance nicety.
        out = out.replace(
            `var seeded = p === "/" || p === "/turniri"`,
            `var seeded = p === "/turniri"`,
        )

        return out
    }

    return {
        name: "bela-games-shell",
        apply: "build",
        configResolved(config) {
            outDir = resolve(config.root, config.build.outDir)
        },
        async closeBundle() {
            // Runs after the bundle is on disk, so `index.html` already has
            // the hashed script/style tags this shell must copy verbatim.
            let html: string
            try {
                html = await readFile(join(outDir, "index.html"), "utf8")
            } catch (err) {
                this.error(`index.games.html: cannot read the built index.html (${String(err)})`)
                return
            }
            try {
                await writeFile(join(outDir, "index.games.html"), transform(html), "utf8")
            } catch (err) {
                this.error(err instanceof Error ? err.message : String(err))
            }
        },
    }
}

export default defineConfig({
    plugins: [react(), precacheManifest(), gamesShell()],
    resolve: {
        // The online-bela packages live OUTSIDE this app, in the sibling
        // `game/` workspace, and are consumed straight from TypeScript source
        // — no build step, no published package. See game/README.md: the
        // engine and the protocol are shared verbatim between the Node game
        // server and this client, which is the whole point of writing the
        // rules in TypeScript.
        alias: {
            "@bela/engine": fileURLToPath(new URL("../game/packages/engine/src/index.ts", import.meta.url)),
            "@bela/protocol": fileURLToPath(new URL("../game/packages/protocol/src/index.ts", import.meta.url)),
        },
    },
    server: {
        fs: {
            // Vite's dev server refuses to serve files outside the project
            // root; the aliases above resolve into `../game`, so that path has
            // to be allowed explicitly or every import 403s in dev.
            allow: [
                fileURLToPath(new URL(".", import.meta.url)),
                fileURLToPath(new URL("../game", import.meta.url)),
            ],
        },
        // Pin bela-turniri dev to 5185 (project ID 85, shared with backend
        // 8085) so it doesn't fight other Vite projects for the default
        // 5173 slot. strictPort makes the server fail loudly if 5185 is
        // already taken — better than silently shifting to another port
        // and breaking bookmarks / proxy configs that target the fixed port.
        port: 5185,
        strictPort: true,
        proxy: {
            "/api": {
                target: "http://localhost:8085",
                changeOrigin: true,
            },
            // Online bela. MUST stay ABOVE the generic "/ws" entry below:
            // Vite matches proxy keys in insertion order, so with "/ws" first
            // every game socket would be rewritten to /api/game and land on
            // Quarkus. No rewrite here — the Node game server on 8285 serves
            // /ws/game itself. Caddy has the same ordering rule in prod.
            "/ws/game": {
                target: "http://localhost:8285",
                ws: true,
                changeOrigin: true,
                configure: (proxy) => {
                    proxy.on("error", () => {})
                },
            },
            // Realtime channel. The client always talks to the stable public
            // URL /ws/live/{uuid}; websockets-next registers its routes UNDER
            // quarkus.http.root-path (=/api), so the backend actually serves
            // /api/live/{uuid} — verified against the packaged app: a
            // handshake to /live/{uuid} answers 404, /api/live/{uuid} answers
            // 101. Caddy performs the same rewrite in production.
            "/ws": {
                target: "http://localhost:8085",
                ws: true,
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/ws/, "/api"),
                // A backend restart drops every open socket, and http-proxy
                // reports each one as an ECONNRESET on the dev server's
                // stderr. Swallow it: the client reconnects on its own and
                // the noise buries real errors.
                configure: (proxy) => {
                    proxy.on("error", () => {})
                },
            },
        },
    },
    build: {
        rollupOptions: {
            output: {
                // The app shell's third-party code goes into ONE `vendor`
                // chunk. App code stays out of it, so the cache benefit
                // remains (a code change only busts the small entry bundle;
                // the browser keeps the cached vendor chunk across deploys).
                //
                // `vendor` is EAGER: the entry chunk imports it statically, so
                // index.html modulepreloads it and every visitor pays for
                // everything inside on the very first paint. That makes the
                // rule below the one that matters:
                //
                //   A library may leave `vendor` for a chunk of its own ONLY
                //   IF nothing that stays in `vendor` imports it — i.e. it is
                //   reached exclusively from a lazily-imported route/dialog.
                //
                // That one-way edge (`vendor-x` → `vendor`, never back) is
                // also what keeps the historical crash away. Splitting React,
                // Chakra and react-leaflet apart *while `vendor` still
                // imported them* created a cross-chunk CYCLE, and the browser
                // then executed react-leaflet's top-level `createContext()` /
                // `forwardRef` before the React chunk had initialized →
                // "Cannot read properties of undefined". A chunk nothing in
                // `vendor` imports cannot be in a cycle with it: its own
                // static import of `vendor` orders React first.
                //
                // Every carve-out below therefore states WHO reaches it. If a
                // future eager component imports one of these libraries, the
                // rule for it must be deleted in the same commit — otherwise
                // the cycle (and the crash) comes back.
                manualChunks(id) {
                    if (!id.includes("node_modules")) return undefined
                    // Leaflet (~150 kB) AND its React bindings. react-leaflet
                    // used to stay in `vendor`, which meant the eager vendor
                    // chunk statically imported `vendor-map` and index.html
                    // modulepreloaded 150 kB of mapping library on every
                    // route — /turniri, /blok, /prijava, all of them. Both
                    // halves are reached ONLY from lazily-loaded modules
                    // (`pages/MapPage`, `components/LocationMapPicker`,
                    // `components/MapBaseLayer`, all behind React.lazy), so
                    // moving the bindings in here removes that edge entirely.
                    if (
                        id.includes("node_modules/leaflet/")
                        || id.includes("node_modules/react-leaflet/")
                        || id.includes("node_modules/@react-leaflet/")
                    ) {
                        return "vendor-map"
                    }
                    // react-datepicker + date-fns (~160 kB together). Reached
                    // only from the organiser console — `CreateTournamentPage`
                    // and `tournament/sections/DetailsEditForm`, both lazy —
                    // and date-fns has no other importer in the app. NOTE:
                    // react-datepicker's `@floating-ui/react` dependency is
                    // deliberately NOT pulled along: Chakra uses it too, so it
                    // must stay in `vendor` or this chunk and `vendor` would
                    // import each other.
                    if (
                        id.includes("node_modules/react-datepicker/")
                        || id.includes("node_modules/date-fns/")
                    ) {
                        return "vendor-datepicker"
                    }
                    // The product tour (~80 kB): react-joyride, its floater
                    // and popper.js, plus the small helpers that only they
                    // depend on (verified with a reverse-dependency scan —
                    // `react-is`/`prop-types`/`deepmerge`/`clsx` are shared
                    // with other packages and stay in `vendor`). `PageTour` is
                    // `React.lazy` in both pages that show a tour, and the
                    // tour only ever runs on an explicit "pomoć" tap or a
                    // first-visit flag.
                    if (
                        id.includes("node_modules/react-joyride/")
                        || id.includes("node_modules/react-floater/")
                        || id.includes("node_modules/popper.js/")
                        || id.includes("node_modules/tree-changes/")
                        || id.includes("node_modules/is-lite/")
                        || id.includes("node_modules/deep-diff/")
                        || id.includes("node_modules/scrollparent/")
                        || id.includes("node_modules/react-innertext/")
                        || id.includes("node_modules/@gilbarbara/")
                    ) {
                        return "vendor-tour"
                    }
                    // Avatar cropping — only `components/AvatarCropDialog`,
                    // itself lazily imported by the profile page, and only
                    // once a user actually picks an image file.
                    if (id.includes("node_modules/react-image-crop/")) {
                        return "vendor-crop"
                    }
                    // MapLibre GL (~800 kB) + its Leaflet adapter, used ONLY
                    // when VITE_MAP_PROVIDER=openfreemap. Kept apart from
                    // `vendor-map` because the raster path must not pay for a
                    // WebGL renderer it never draws with. It is reached
                    // exclusively through the `import()`
                    // in `components/MapBaseLayer.tsx`, so nothing static
                    // pulls this chunk in — without the rule below Rollup
                    // would fold it into the eager `vendor` chunk and ship a
                    // WebGL renderer to every CARTO deployment that never
                    // draws a single vector tile.
                    if (id.includes("node_modules/maplibre-gl/") || id.includes("node_modules/@maplibre/")) {
                        return "vendor-maplibre"
                    }
                    // `@capacitor-firebase/messaging`'s browser-fallback class
                    // (only ever reached from a lazy chunk of its own — see the
                    // carve-out below) statically imports `firebase/messaging`,
                    // which would otherwise be swept into "vendor-firebase" by
                    // the general rule right below and ship the web SDK's FCM
                    // code to every browser even though `isNative` guards every
                    // caller and that fallback never actually runs on web. Must
                    // come BEFORE the general firebase check so it wins; leaving
                    // it to Rollup's default chunking merges it with the one
                    // lazy chunk that imports it instead.
                    // `@firebase/installations` rides along for the same
                    // reason and by the same route: it is a dependency of
                    // `@firebase/messaging` and of NOTHING else this app pulls
                    // in (analytics, performance and remote-config are the
                    // other Firebase packages that want it, and none of them
                    // is installed as a direct dependency here — verified by a
                    // reverse-dependency scan of node_modules). Left to the
                    // general rule below it was swept into the EAGER
                    // "vendor-firebase" chunk and shipped to every visitor to
                    // support a code path that only ever runs natively.
                    if (
                        id.includes("node_modules/@firebase/messaging/")
                        || id.includes("node_modules/firebase/messaging/")
                        || id.includes("node_modules/@firebase/installations/")
                    ) {
                        return undefined
                    }
                    // Firebase touches no React and is only reached through the
                    // auth layer — safe as its own chunk, loaded alongside but
                    // cached independently of the app's UI dependencies.
                    if (id.includes("node_modules/firebase/") || id.includes("node_modules/@firebase/")) {
                        return "vendor-firebase"
                    }
                    // Capacitor PLUGINS (@capacitor/app, status-bar, …) are only
                    // ever reached through the lazy loaders in
                    // src/platform/native.ts, behind an `isNative` check. Left
                    // to Rollup they become their own lazy chunks, which the
                    // web build then never requests. Forcing them into "vendor"
                    // would ship native-only bridge code to every browser.
                    // `@capacitor/core` itself is NOT excluded: platform/index.ts
                    // imports it statically for the platform check, so it
                    // belongs in the shared chunk like any other dependency.
                    if (id.includes("node_modules/@capacitor/") && !id.includes("node_modules/@capacitor/core/")) {
                        return undefined
                    }
                    // Same story for `@capacitor-firebase/messaging` (separate
                    // npm scope from the plugins above) — only reached via
                    // `nativeMessaging()` in native.ts, behind `isNative`.
                    if (id.includes("node_modules/@capacitor-firebase/")) {
                        return undefined
                    }
                    return "vendor"
                },
            },
        },
        // The single vendor chunk legitimately exceeds the default 500 kB
        // warning; raise the threshold so the build log isn't noisy.
        chunkSizeWarningLimit: 1600,
    },
})
