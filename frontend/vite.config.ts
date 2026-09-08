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

/** The module `App.tsx` lazily imports for the `/blok` route. */
const BLOK_ROUTE_MODULE = "src/blok/pages/BlokPage.tsx"

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

            let blokFound = false
            for (const [fileName, entry] of Object.entries(bundle)) {
                if (entry.type !== "chunk") continue
                const facade = entry.facadeModuleId?.replaceAll("\\", "/") ?? ""
                if (entry.isEntry) walk(fileName)
                if (facade.endsWith(BLOK_ROUTE_MODULE)) {
                    blokFound = true
                    walk(fileName)
                }
            }

            // Loud, not silent: a precache without the scorepad in it would
            // still "work" in every test that is not run on a plane.
            if (!blokFound) {
                this.error(
                    `precache manifest: no chunk for ${BLOK_ROUTE_MODULE}. `
                    + "Did the route move? The offline scorepad depends on this.",
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
                // ALL third-party code goes into ONE vendor chunk. App code
                // stays out of it, so the cache benefit remains (a code
                // change only busts the small entry bundle; the browser keeps
                // the cached vendor chunk across deploys).
                //
                // Why a single chunk and not per-library: splitting React,
                // Chakra and react-leaflet into separate chunks created a
                // cross-chunk initialization cycle, so react-leaflet ran its
                // top-level `createContext()` before the React chunk had
                // initialized → "Cannot read properties of undefined (reading
                // 'createContext')". Keeping everything that touches React in
                // one chunk makes that impossible.
                manualChunks(id) {
                    if (!id.includes("node_modules")) return undefined
                    // ONLY plain `leaflet` gets its own chunk — it's the heavy
                    // part (~150 kB) and imports no React, so it can never hit
                    // the cross-chunk init crash. Anything React-touching
                    // (react-leaflet, react-joyride, react-datepicker, …) MUST
                    // stay in the one vendor chunk: splitting react-leaflet out
                    // shipped "Cannot read properties of undefined (reading
                    // 'forwardRef')" — it executed before the React chunk had
                    // initialized. Don't re-split those.
                    if (id.includes("node_modules/leaflet/")) {
                        return "vendor-map"
                    }
                    // Firebase touches no React and is only reached through the
                    // auth layer — safe as its own chunk, loaded alongside but
                    // cached independently of the app's UI dependencies.
                    if (id.includes("node_modules/firebase/") || id.includes("node_modules/@firebase/")) {
                        return "vendor-firebase"
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