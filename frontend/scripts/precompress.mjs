#!/usr/bin/env node
/* Writes `.br` and `.gz` siblings for the compressible files of a build, so
   Caddy (`file_server { precompressed br gzip }`) serves them as they are
   instead of compressing the same bytes again on every request — and at
   brotli 11, which is far too slow to do on the fly.

   Run by frontend/Dockerfile right after `npm run build`:
       node scripts/precompress.mjs dist

   Zero dependencies. A sibling is kept only when it is actually smaller. */

import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { extname, join } from "node:path"
import { brotliCompressSync, constants, gzipSync } from "node:zlib"

// Text formats only. Images, fonts and audio are already compressed, and
// source maps are never requested by a visitor.
const COMPRESSIBLE = new Set([".js", ".mjs", ".css", ".html", ".svg", ".json", ".webmanifest", ".txt", ".xml"])
// Below this the saving does not pay for the extra file lookups.
const MIN_BYTES = 1024

function walk(dir) {
    const out = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) out.push(...walk(path))
        else if (entry.isFile()) out.push(path)
    }
    return out
}

/** Writes `path + suffix` when `body` beats the original; removes a stale one otherwise. */
function keepIfSmaller(path, suffix, body, originalSize) {
    const target = path + suffix
    if (body.length < originalSize) {
        writeFileSync(target, body)
        return body.length
    }
    rmSync(target, { force: true })
    return 0
}

const dir = process.argv[2] ?? "dist"
if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) {
    console.error(`precompress: ${dir} is not a directory`)
    process.exit(1)
}

let files = 0
let originalBytes = 0
let brBytes = 0
let gzBytes = 0

for (const path of walk(dir)) {
    if (!COMPRESSIBLE.has(extname(path).toLowerCase())) continue
    const source = readFileSync(path)
    if (source.length < MIN_BYTES) continue

    const br = brotliCompressSync(source, {
        params: {
            [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
            [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
            [constants.BROTLI_PARAM_SIZE_HINT]: source.length,
        },
    })
    const gz = gzipSync(source, { level: 9 })

    brBytes += keepIfSmaller(path, ".br", br, source.length)
    gzBytes += keepIfSmaller(path, ".gz", gz, source.length)
    originalBytes += source.length
    files++
}

console.log(`precompress: ${files} files, ${originalBytes} bytes -> ${brBytes} br, ${gzBytes} gz`)
