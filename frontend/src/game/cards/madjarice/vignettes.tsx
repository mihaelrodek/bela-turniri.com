import type { Suit } from "@bela/engine"
import { INK } from "./palette"

/* ──────────────────────────────────────────────────────────────────────────
   Season motifs for the aces.

   A Tell ace ("Daus") is the one card in the pack that is a picture rather
   than a count, and each of the four carries a season: srce = proljeće,
   bundeva = ljeto, list = jesen, žir = zima (game/DESIGN.md §2.1). Each motif
   is drawn small, high in the ace's panel, and the big suit glyph is laid
   over it — so these stay simple shapes: anything fussy just becomes noise
   behind an acorn.
   ────────────────────────────────────────────────────────────────────── */

/** proljeće — a five-petal blossom. */
function Blossom({ motif }: { motif: string }) {
    return (
        <g>
            {[0, 72, 144, 216, 288].map((a) => (
                <ellipse
                    key={a}
                    cx={100}
                    cy={62}
                    rx={9}
                    ry={17}
                    fill={motif}
                    stroke={INK}
                    strokeWidth={1.6}
                    transform={`rotate(${a} 100 78)`}
                />
            ))}
            <circle cx={100} cy={78} r={7} fill="#f0c64f" stroke={INK} strokeWidth={1.6} />
        </g>
    )
}

/** ljeto — a high sun. */
function Sun({ motif }: { motif: string }) {
    return (
        <g stroke={INK} strokeWidth={1.6}>
            {[0, 45, 90, 135].map((a) => (
                <path key={a} d="M100 52v52" stroke={motif} strokeWidth={5} strokeLinecap="round" transform={`rotate(${a} 100 78)`} />
            ))}
            <circle cx={100} cy={78} r={16} fill={motif} />
        </g>
    )
}

/** jesen — a leaf falling on the wind. */
function FallingLeaf({ motif }: { motif: string }) {
    return (
        <g transform="rotate(28 100 78)">
            <path
                d="M100 54c6 8 21 13 22 24 1 10-9 15-17 12l-3-1v11h-4V89l-3 1c-8 3-18-2-17-12 1-11 16-16 22-24Z"
                fill={motif}
                stroke={INK}
                strokeWidth={1.8}
                strokeLinejoin="round"
            />
            <path d="M87 106q13-8 26-24" stroke={INK} strokeWidth={1.6} fill="none" strokeLinecap="round" opacity={0.5} />
        </g>
    )
}

/** zima — a six-armed snowflake. */
function Snowflake({ motif }: { motif: string }) {
    return (
        <g stroke={motif} strokeWidth={4} strokeLinecap="round" fill="none">
            {[0, 60, 120].map((a) => (
                <g key={a} transform={`rotate(${a} 100 78)`}>
                    <path d="M100 54v48" />
                    <path d="m100 62 7-7M100 62l-7-7M100 94l7 7M100 94l-7 7" strokeWidth={3} />
                </g>
            ))}
        </g>
    )
}

/** The motif for a suit's ace, drawn around (100, 78) in card coordinates. */
export default function SeasonVignette({ suit, motif }: { suit: Suit; motif: string }) {
    if (suit === "HERC") return <Blossom motif={motif} />
    if (suit === "KARA") return <Sun motif={motif} />
    if (suit === "PIK") return <FallingLeaf motif={motif} />
    return <Snowflake motif={motif} />
}
