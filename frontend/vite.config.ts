import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
    plugins: [react()],
    server: {
        // Pin bela-turniri dev to 5180 so it doesn't fight other Vite projects
        // for the default 5173 slot. strictPort makes the server fail loudly
        // if 5180 is already taken — better than silently shifting to 5181
        // and breaking bookmarks / proxy configs that target the fixed port.
        port: 5180,
        strictPort: true,
        proxy: {
            "/api": {
                target: "http://localhost:8085",
                changeOrigin: true,
            },
        },
    },
})