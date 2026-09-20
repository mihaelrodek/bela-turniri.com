import type { Suit } from "@bela/engine"

/* ──────────────────────────────────────────────────────────────────────────
   Season motifs for the aces.

   A Tell ace ("Daus") is the one card in the pack that is a picture rather
   than a count, and each of the four carries a season: srce = proljeće,
   bundeva = ljeto, list = jesen, žir = zima (game/DESIGN.md §2.1).

   Art direction (2026-09-20): the season is the ace's CHARACTER, not its
   identity — the identity is the big suit mark under it and the A in both
   corners. So each motif is one recognisable object drawn around (100, 76)
   in card coordinates and kept inside a 80-unit box, clear of the glyph that
   starts at y = 120. Two flat tones each (`motif` / `motifAlt`), no outlines:
   an outline here would compete with the mark that actually has to be read.
   ────────────────────────────────────────────────────────────────────── */

/** proljeće — a five-petal blossom. */
function Blossom({ motif, motifAlt }: { motif: string; motifAlt: string }) {
    return (
        <g>
            {[0, 72, 144, 216, 288].map((a) => (
                <ellipse key={a} cx={100} cy={58} rx={11} ry={19} fill={motif} transform={`rotate(${a} 100 76)`} />
            ))}
            <circle cx={100} cy={76} r={9} fill={motifAlt} />
        </g>
    )
}

/** ljeto — a high sun with eight rays. */
function Sun({ motif, motifAlt }: { motif: string; motifAlt: string }) {
    return (
        <g>
            {[0, 45, 90, 135].map((a) => (
                <path
                    key={a}
                    d="M100 44v64"
                    stroke={motifAlt}
                    strokeWidth={6}
                    strokeLinecap="round"
                    fill="none"
                    transform={`rotate(${a} 100 76)`}
                />
            ))}
            <circle cx={100} cy={76} r={20} fill={motif} />
        </g>
    )
}

/** jesen — two leaves on the wind. */
function FallingLeaves({ motif, motifAlt }: { motif: string; motifAlt: string }) {
    const leaf = "M0 -26C-13-8-20 2-20 12-20 24-9 31 0 33 9 31 20 24 20 12 20 2 13-8 0-26Z"
    return (
        <g>
            <path d={leaf} fill={motifAlt} transform="translate(74 58) rotate(-36) scale(0.6)" />
            <path d={leaf} fill={motif} transform="translate(112 82) rotate(28) scale(0.86)" />
            <path
                d="M112 62v40"
                stroke={motifAlt}
                strokeWidth={2.6}
                strokeLinecap="round"
                fill="none"
                transform="rotate(28 112 82)"
            />
        </g>
    )
}

/** zima — a six-armed snowflake. */
function Snowflake({ motif, motifAlt }: { motif: string; motifAlt: string }) {
    return (
        <g fill="none" strokeLinecap="round">
            {[0, 60, 120].map((a) => (
                <g key={a} transform={`rotate(${a} 100 76)`}>
                    <path d="M100 40v72" stroke={motif} strokeWidth={6} />
                    <path d="m100 52 10-10M100 52 90 42M100 100l10 10M100 100l-10 10" stroke={motifAlt} strokeWidth={5} />
                </g>
            ))}
            <circle cx={100} cy={76} r={7} fill={motif} stroke="none" />
        </g>
    )
}

/** The motif for a suit's ace, drawn around (100, 76) in card coordinates. */
export default function SeasonVignette({ suit, motif, motifAlt }: { suit: Suit; motif: string; motifAlt: string }) {
    if (suit === "HERC") return <Blossom motif={motif} motifAlt={motifAlt} />
    if (suit === "KARA") return <Sun motif={motif} motifAlt={motifAlt} />
    if (suit === "PIK") return <FallingLeaves motif={motif} motifAlt={motifAlt} />
    return <Snowflake motif={motif} motifAlt={motifAlt} />
}
