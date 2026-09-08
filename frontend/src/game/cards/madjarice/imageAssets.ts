import type { Card, Rank, Suit } from "@bela/engine"

// Only bundled files are registered: unfinished cards retain the SVG face
// instead of requesting a missing image. Names follow engine IDs (7HERC).
const files = import.meta.glob<string>("./assets/*.{png,webp,jpg,svg}", {
    eager: true,
    query: "?url",
    import: "default",
})

const faces = new Map<Card, string>()
for (const [path, url] of Object.entries(files)) {
    const id = path.match(/\/(7|8|9|10|J|Q|K|A)(HERC|KARA|PIK|TREF)\.(png|webp|jpg|svg)$/)
    if (id) faces.set(`${id[1]}${id[2]}` as Card, url)
}

export function cardImage(rank: Rank, suit: Suit): string | undefined {
    return faces.get(`${rank}${suit}`)
}
