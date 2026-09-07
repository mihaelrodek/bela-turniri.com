import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

const p = (rel: string) => fileURLToPath(new URL(rel, import.meta.url))

export default defineConfig({
    resolve: {
        alias: {
            "@bela/engine": p("./packages/engine/src/index.ts"),
            "@bela/protocol": p("./packages/protocol/src/index.ts"),
            "@bela/bots": p("./packages/bots/src/index.ts"),
        },
    },
    test: {
        include: ["packages/*/test/**/*.test.ts", "packages/*/src/**/*.test.ts"],
        environment: "node",
    },
})
