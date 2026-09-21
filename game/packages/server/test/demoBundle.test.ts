import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

/* The server ships as ONE esbuild bundle. A bundler can only follow an import
   whose path is a literal: the demo director was once loaded through a string
   variable, was left out of `dist/index.js`, and never started in production
   while every other test here (which run the sources) passed. This guards the
   one line that decides whether the module is in the bundle at all. */
describe("demo director is bundled", () => {
    it("is imported with a literal path, which esbuild can follow", () => {
        const source = readFileSync(fileURLToPath(new URL("../src/server.ts", import.meta.url)), "utf8")
        expect(source).toMatch(/await import\("\.\/demo\/director\.js"\)/)
        expect(source).not.toMatch(/await import\(\s*[A-Za-z_]/)
    })
})
