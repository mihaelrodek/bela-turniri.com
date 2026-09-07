import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
    plugins: [react()],
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