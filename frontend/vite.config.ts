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

function precacheManifest(): Plugin {
    return {
        name: "bela-precache-manifest",
        apply: "build",
        generateBundle(_options, bundle) {
            const files = new Set<string>()

            const walk = (fileName: string) => {
                const entry = bundle[fileName]
                if (!entry || entry.type !== "chunk") return
                if (files.has(`/${fileName}`)) return
                files.add(`/${fileName}`)
                for (const css of entry.viteMetadata?.importedCss ?? []) files.add(`/${css}`)
                // NOT `importedAssets`. Those are the URLs a module holds, not
                // the bytes it needs to EXECUTE: `game/cards/madjarice`'s
                // `import.meta.glob` puts all 32 card faces (2.8 MB of webp)
                // into the graph of `PlayingCard`, which the scorepad reaches
                // only for `SuitIcon` — four inline SVG paths that touch none
                // of them. A blok never renders a card face, so precaching the
                // deck would be the single biggest thing in the cache and the
                // one thing offline /blok cannot use. An image that is missing
                // offline degrades one picture; a missing chunk stops the app
                // from booting, and only chunks and their CSS can do that.
                for (const imported of entry.imports) walk(imported)
            }

            const found = new Set<string>()
            for (const [fileName, entry] of Object.entries(bundle)) {
                if (entry.type !== "chunk") continue
                const facade = entry.facadeModuleId?.replaceAll("\\", "/") ?? ""
                if (entry.isEntry) walk(fileName)
                for (const module of OFFLINE_ROUTE_MODULES) {
                    if (!facade.endsWith(module)) continue
                    found.add(module)
                    walk(fileName)
                }
            }

            // Loud, not silent: a precache without the scorepad in it would
            // still "work" in every test that is not run on a plane.
            const missing = OFFLINE_ROUTE_MODULES.filter((m) => !found.has(m))
            if (missing.length > 0) {
                this.error(
                    `precache manifest: no chunk for ${missing.join(", ")}. `
                    + "Did the module move, or is it no longer lazily imported? "
                    + "The offline scorepad depends on this.",
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

export default defineConfig({
    plugins: [react(), precacheManifest()],
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