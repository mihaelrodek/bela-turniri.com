import { useSyncExternalStore, type ReactNode } from "react"
import { keyframes } from "@emotion/react"
import { Box, Flex, Portal, Text } from "@chakra-ui/react"
import type { Suit } from "@bela/engine"
import { RANKS, makeCard, type DeckStyle } from "../util/cards"
import PlayingCard, { CardBack, SuitIcon } from "./PlayingCard"

/* ──────────────────────────────────────────────────────────────────────────
   BelotShowcase — the one moment a belot gets (2026-09-20, user request;
   second pass the same day: "treba jači dojam", a living background, all
   eight cards in the CLASSIC deck, and cards that themselves move).

   Eight cards of one suit end a game on the spot and happen maybe once in a
   hundred evenings, so both places that can see one share this overlay: the
   online table (`BelotFlash`, which knows the seat and the suit) and the
   blok (`BelotCelebration`, which is handed a random suit by its caller).

   The cards are ALWAYS `klasicne`, whatever deck the player plays with: the
   painted mađarice are the picture everybody has of "osam istih", and a
   showpiece is no place for a preference.

   THE SEQUENCE — CSS keyframes only, no new dependency:
     0 ms      stage fades in; it never stands still afterwards: drifting
               aurora lights, two counter-turning sets of rays, embers and
               faint suit marks rising for as long as it is up
     0–1200    the packet rises FACE DOWN, lands at the left end of the arc
               and spreads along it into a fan, like a hand being opened
     1150–2260 the cards turn over one after another, left to right (a real
               3D flip — and the time the classic artwork needs to decode)
     2250      impact: flash, two shockwave rings, a burst of suit marks and
               sparks, the stage shakes once, and the word SLAMS in
     then      the fan lives: a wave runs through the cards, light sweeps
               across them on a loop, the whole fan sways in 3D, the word
               shimmers and ripples
     end       everything fades over its last 400 ms (`durationMs`)

   ONE DRAWING, EVERY SCREEN. The fan is laid out once in a fixed design box
   (`FAN_W` × `FAN_H`, cards drawn at `md`) and scaled by one factor from the
   real viewport — width on a phone, height in landscape, capped on a
   desktop. Everything else is in `vmin`/`vmax`/`clamp`.

   Under reduced motion nothing moves: face-up fan, the word, a still glow.
   ────────────────────────────────────────────────────────────────────── */

const DECK: DeckStyle = "klasicne"
/** A `klasicne` card drawn at `md` (CARD_METRICS.md.w × MADJARICA_HEIGHT.md). */
const CARD_W = 72
const CARD_H = 116
/** Distance from the fan's pivot up to the bottom edge of a card. */
const FAN_RADIUS = 260
/** Degrees between two neighbouring cards; eight cards span ±3.5 steps. */
const FAN_STEP = 6.5
const FAN_START = -((RANKS.length - 1) / 2) * FAN_STEP
/** The fan's bounding box at scale 1, measured from the geometry above. */
const FAN_W = 360
const FAN_H = 156
/** Never larger than this, however big the monitor. */
const MAX_SCALE = 1.7
const GOLD = "246, 196, 83"

/** When the last card has turned and everything goes off at once. */
const IMPACT_MS = 2250

/** Suit marks and sparks thrown from the centre of the fan. Computed once at
 *  module load — `Math.random` in a render body reshuffles on every render
 *  (and twice under StrictMode). Distances in `vmin`: same shape everywhere. */
const BURST = Array.from({ length: 30 }, (_, i) => {
    const angle = ((i * 360) / 30 + (i % 2) * 7) * (Math.PI / 180)
    const reach = 34 + ((i * 37) % 26)
    const mark = i % 3 === 0
    return {
        dx: `${(Math.cos(angle) * reach).toFixed(1)}vmin`,
        dy: `${(Math.sin(angle) * reach * 0.85).toFixed(1)}vmin`,
        spin: `${(i % 2 === 0 ? 1 : -1) * (140 + ((i * 53) % 260))}deg`,
        delayMs: IMPACT_MS + ((i * 29) % 140),
        durationMs: 1200 + ((i * 71) % 700),
        mark,
        size: mark ? 24 + ((i * 7) % 16) : 5 + ((i * 5) % 6),
    }
})

/** Embers that keep rising for as long as the stage is up. Negative delays,
 *  so the air is already full on the first frame instead of filling up. */
const EMBERS = Array.from({ length: 28 }, (_, i) => ({
    left: `${(i * 37 + 5) % 100}%`,
    drift: `${((i * 53) % 25) - 12}vw`,
    size: 3 + ((i * 7) % 5),
    durationMs: 3600 + ((i * 97) % 3200),
    delayMs: -((i * 431) % 6000),
}))

/** Large, faint suit marks drifting up behind the fan. */
const GHOSTS = Array.from({ length: 9 }, (_, i) => ({
    left: `${(i * 23 + 4) % 92}%`,
    size: `${9 + ((i * 5) % 9)}vmin`,
    spin: `${(i % 2 === 0 ? 1 : -1) * (25 + ((i * 17) % 40))}deg`,
    durationMs: 7000 + ((i * 613) % 5000),
    delayMs: -((i * 977) % 9000),
}))

/* Keyframes through emotion's `keyframes()` at module scope — the way `Hand`
   does it. The first version nested "@keyframes" blocks in the root's `css`
   prop and NONE of them ran in the browser (user report, 2026-09-20: a still
   stack of cards). Every resting style below is therefore also the FINAL
   frame, so a dead animation can never again leave the fan closed. */
const KF = {
    belotStageIn: keyframes({ from: { opacity: 0 }, to: { opacity: 1 } }),
    belotStageOut: keyframes({ from: { opacity: 1 }, to: { opacity: 0 } }),
    belotAuroraA: keyframes({
        "0%": { transform: "translate(-30%, -20%) scale(1)" },
        "50%": { transform: "translate(25%, 10%) scale(1.35)" },
        "100%": { transform: "translate(-10%, 30%) scale(0.9)" },
    }),
    belotAuroraB: keyframes({
        "0%": { transform: "translate(30%, 25%) scale(1.2)" },
        "50%": { transform: "translate(-25%, -5%) scale(0.85)" },
        "100%": { transform: "translate(15%, -30%) scale(1.3)" },
    }),
    belotRaysTurn: keyframes({ to: { transform: "translate(-50%, -50%) rotate(360deg)" } }),
    belotRaysBack: keyframes({ to: { transform: "translate(-50%, -50%) rotate(-360deg)" } }),
    belotRaysPulse: keyframes({
        "0%, 100%": { opacity: 0.55 },
        "50%": { opacity: 1 },
    }),
    belotEmber: keyframes({
        "0%": { transform: "translate3d(0, 0, 0) scale(0.6)", opacity: 0 },
        "12%": { opacity: 1 },
        "80%": { opacity: 0.8 },
        "100%": { transform: "translate3d(var(--belot-drift), -115vh, 0) scale(1.1)", opacity: 0 },
    }),
    belotGhost: keyframes({
        "0%": { transform: "translate3d(0, 0, 0) rotate(0deg)", opacity: 0 },
        "15%": { opacity: 0.16 },
        "85%": { opacity: 0.16 },
        "100%": { transform: "translate3d(0, -130vh, 0) rotate(var(--belot-spin))", opacity: 0 },
    }),
    belotCardDeal: keyframes({
        "0%": { transform: `translateY(75vh) rotate(${FAN_START}deg) scale(0.7)`, opacity: 0 },
        "10%": { opacity: 1 },
        "50%": { transform: `translateY(0) rotate(${FAN_START}deg) scale(1)`, opacity: 1 },
        "100%": { transform: "translateY(0) rotate(var(--belot-angle)) scale(1)", opacity: 1 },
    }),
    belotCardFlip: keyframes({
        "0%": { transform: "translateY(0) rotateY(180deg) scale(1)" },
        "50%": { transform: "translateY(-26px) rotateY(90deg) scale(1.18)" },
        "100%": { transform: "translateY(0) rotateY(0deg) scale(1)" },
    }),
    belotCardWave: keyframes({
        "0%, 55%, 100%": { transform: "translateY(0) scale(1)" },
        "25%": { transform: "translateY(-16px) scale(1.06)" },
    }),
    belotFanSway: keyframes({
        "0%, 100%": { transform: "rotateX(7deg) rotateY(-11deg)" },
        "50%": { transform: "rotateX(-3deg) rotateY(11deg)" },
    }),
    belotShine: keyframes({
        "0%": { transform: "translateX(-180%) skewX(-18deg)" },
        "35%, 100%": { transform: "translateX(320%) skewX(-18deg)" },
    }),
    belotGlowPulse: keyframes({
        "0%, 100%": { opacity: 0.55, transform: "translate(-50%, -50%) scale(0.92)" },
        "50%": { opacity: 1, transform: "translate(-50%, -50%) scale(1.08)" },
    }),
    belotFlash: keyframes({
        "0%": { opacity: 0 },
        "18%": { opacity: 0.85 },
        "100%": { opacity: 0 },
    }),
    belotRing: keyframes({
        from: { transform: "translate(-50%, -50%) scale(0.15)", opacity: 1 },
        to: { transform: "translate(-50%, -50%) scale(1)", opacity: 0 },
    }),
    belotBurst: keyframes({
        "0%": { transform: "translate(-50%, -50%) scale(0.3) rotate(0deg)", opacity: 0 },
        "12%": { opacity: 1 },
        "100%": {
            transform:
                "translate(calc(-50% + var(--belot-dx)), calc(-50% + var(--belot-dy))) scale(1) rotate(var(--belot-spin))",
            opacity: 0,
        },
    }),
    belotShake: keyframes({
        "0%, 100%": { transform: "translate(0, 0)" },
        "15%": { transform: "translate(-7px, 4px)" },
        "30%": { transform: "translate(6px, -5px)" },
        "45%": { transform: "translate(-5px, -3px)" },
        "60%": { transform: "translate(4px, 3px)" },
        "80%": { transform: "translate(-2px, 1px)" },
    }),
    belotWordSlam: keyframes({
        "0%": { transform: "scale(3.4)", opacity: 0, filter: "blur(14px)" },
        "55%": { transform: "scale(0.92)", opacity: 1, filter: "blur(0)" },
        "75%": { transform: "scale(1.05)", opacity: 1, filter: "blur(0)" },
        "100%": { transform: "scale(1)", opacity: 1, filter: "blur(0)" },
    }),
    belotLetterWave: keyframes({
        "0%, 40%, 100%": { transform: "translateY(0)" },
        "20%": { transform: "translateY(-0.12em)" },
    }),
    belotShimmer: keyframes({
        from: { backgroundPosition: "0% 50%" },
        to: { backgroundPosition: "200% 50%" },
    }),
    belotLineIn: keyframes({
        from: { transform: "translateY(12px)", opacity: 0 },
        to: { transform: "translateY(0)", opacity: 1 },
    }),
}

function subscribeResize(onChange: () => void): () => void {
    window.addEventListener("resize", onChange)
    window.addEventListener("orientationchange", onChange)
    return () => {
        window.removeEventListener("resize", onChange)
        window.removeEventListener("orientationchange", onChange)
    }
}

/** A number, so `useSyncExternalStore` compares snapshots by value. */
function fanScale(): number {
    const byWidth = (window.innerWidth - 28) / FAN_W
    // The fan may take about 40 % of the height; the word and the two lines
    // under it need the rest (a landscape phone is the case that decides).
    const byHeight = (window.innerHeight * 0.4) / FAN_H
    const k = Math.min(byWidth, byHeight, MAX_SCALE)
    return Math.round(Math.max(0.5, k) * 100) / 100
}

export default function BelotShowcase({
    suit,
    kicker,
    winner,
    title,
    subtitle,
    footnote,
    durationMs,
    reducedMotion,
    onDismiss,
}: {
    suit: Suit
    /** A short line ABOVE the word — "Čestitamo!". */
    kicker?: string
    /** WHO has the belot (2026-09-20, user request: the table must say which
     *  person got it). A plate under the word: face, name, and which side. */
    winner?: { name: string; team?: string; avatar: ReactNode }
    /** The word itself — split into letters, so keep it a word. */
    title: string
    subtitle?: string
    footnote?: string
    /** How long the caller keeps this mounted; the fade-out is timed off it. */
    durationMs: number
    reducedMotion: boolean
    /** Given: a tap anywhere dismisses. Omitted: taps pass straight through. */
    onDismiss?: () => void
}) {
    const k = useSyncExternalStore(subscribeResize, fanScale, () => 1)
    const still = reducedMotion
    const letters = Array.from(title)

    return (
        <Portal>
            <Box
                position="fixed"
                inset="0"
                zIndex={1600}
                overflow="hidden"
                role="status"
                pointerEvents={onDismiss ? "auto" : "none"}
                onClick={onDismiss}
                userSelect="none"
                // A dark stage in BOTH themes, like the table itself: the
                // cards and the gold need something to glow against.
                bg="radial-gradient(ellipse at 50% 42%, rgba(16, 54, 37, 0.96) 0%, rgba(3, 12, 8, 0.97) 72%)"
                css={{
                    animation: still
                        ? undefined
                        : `${KF.belotStageIn} 260ms ease-out both, ${KF.belotStageOut} 400ms ease-in ${Math.max(0, durationMs - 400)}ms forwards`,
                }}
            >
                {/* ── BACKGROUND ─────────────────────────────────────────── */}
                {!still && (
                    <>
                        <Box
                            aria-hidden="true"
                            position="absolute"
                            top="10%"
                            left="15%"
                            w="70vmax"
                            h="70vmax"
                            rounded="full"
                            pointerEvents="none"
                            bg={`radial-gradient(circle, rgba(${GOLD}, 0.30) 0%, transparent 62%)`}
                            filter="blur(30px)"
                            css={{ animation: `${KF.belotAuroraA} 9s ease-in-out infinite alternate` }}
                        />
                        <Box
                            aria-hidden="true"
                            position="absolute"
                            top="20%"
                            left="10%"
                            w="80vmax"
                            h="80vmax"
                            rounded="full"
                            pointerEvents="none"
                            bg="radial-gradient(circle, rgba(36, 190, 130, 0.30) 0%, transparent 60%)"
                            filter="blur(30px)"
                            css={{ animation: `${KF.belotAuroraB} 11s ease-in-out infinite alternate` }}
                        />
                    </>
                )}
                {/* Two sets of rays turning against each other: where they
                    cross, the light flickers. `vmax` covers a portrait phone
                    and a wide monitor alike; the mask fades them out early. */}
                {[0, 1].map((layer) => (
                    <Box
                        key={layer}
                        aria-hidden="true"
                        position="absolute"
                        top="40%"
                        left="50%"
                        w="160vmax"
                        h="160vmax"
                        pointerEvents="none"
                        transform="translate(-50%, -50%)"
                        css={{
                            background:
                                layer === 0
                                    ? `repeating-conic-gradient(from 0deg, rgba(${GOLD}, 0.16) 0deg 8deg, transparent 8deg 22deg)`
                                    : `repeating-conic-gradient(from 5deg, rgba(255, 246, 214, 0.10) 0deg 4deg, transparent 4deg 30deg)`,
                            maskImage: "radial-gradient(circle, black 0%, rgba(0,0,0,0.55) 22%, transparent 50%)",
                            WebkitMaskImage: "radial-gradient(circle, black 0%, rgba(0,0,0,0.55) 22%, transparent 50%)",
                            animation: still
                                ? undefined
                                : layer === 0
                                    ? `${KF.belotRaysTurn} 26s linear infinite, ${KF.belotRaysPulse} 3.4s ease-in-out infinite`
                                    : `${KF.belotRaysBack} 38s linear infinite`,
                        }}
                    />
                ))}
                {!still &&
                    GHOSTS.map((ghost, i) => (
                        <Box
                            key={`g${i}`}
                            aria-hidden="true"
                            position="absolute"
                            top="105%"
                            pointerEvents="none"
                            lineHeight="0"
                            style={{
                                left: ghost.left,
                                ["--belot-spin" as string]: ghost.spin,
                                animationDuration: `${ghost.durationMs}ms`,
                                animationDelay: `${ghost.delayMs}ms`,
                            }}
                            css={{
                                opacity: 0,
                                // Duration and delay come from the inline style above.
                                animation: `${KF.belotGhost} 1s linear infinite`,
                            }}
                        >
                            <SuitIcon suit={suit} style={DECK} size={ghost.size} />
                        </Box>
                    ))}
                {!still &&
                    EMBERS.map((ember, i) => (
                        <Box
                            key={`e${i}`}
                            aria-hidden="true"
                            position="absolute"
                            top="104%"
                            rounded="full"
                            pointerEvents="none"
                            bg={`rgb(${GOLD})`}
                            boxShadow={`0 0 8px 1px rgba(${GOLD}, 0.9)`}
                            style={{
                                left: ember.left,
                                width: ember.size,
                                height: ember.size,
                                ["--belot-drift" as string]: ember.drift,
                                animationDuration: `${ember.durationMs}ms`,
                                animationDelay: `${ember.delayMs}ms`,
                            }}
                            css={{
                                opacity: 0,
                                // Duration and delay come from the inline style above.
                                animation: `${KF.belotEmber} 1s ease-out infinite`,
                            }}
                        />
                    ))}

                {/* ── CONTENT (shaken once, on impact) ───────────────────── */}
                <Flex
                    position="absolute"
                    inset="0"
                    direction="column"
                    align="center"
                    justify="center"
                    gap={{ base: "6", md: "8" }}
                    css={{
                        // The stage itself stays full-bleed — its gradient and
                        // embers are supposed to run off every edge — but the
                        // fan and the title sit inside the safe area. The `4`
                        // gutter this replaces is preserved by the max() terms
                        // in OVERLAY_SAFE_INSET's siblings; spelled out here
                        // because this layer wants the wider one.
                        paddingTop: "var(--safe-top)",
                        paddingBottom: "var(--safe-bottom)",
                        paddingInlineStart: "max(var(--chakra-spacing-4), var(--safe-left))",
                        paddingInlineEnd: "max(var(--chakra-spacing-4), var(--safe-right))",
                        animation: still ? undefined : `${KF.belotShake} 420ms ease-out ${IMPACT_MS}ms both`,
                    }}
                >
                    {/* The fan. The outer box reserves the SCALED size in the
                        layout; the inner one is the fixed design box, scaled
                        from its top-left corner. */}
                    <Box position="relative" flexShrink={0} style={{ width: FAN_W * k, height: FAN_H * k }}>
                        {/* A breathing pool of light the cards stand in. */}
                        <Box
                            aria-hidden="true"
                            position="absolute"
                            top="55%"
                            left="50%"
                            w="135%"
                            h="190%"
                            rounded="full"
                            pointerEvents="none"
                            transform="translate(-50%, -50%)"
                            bg={`radial-gradient(ellipse, rgba(${GOLD}, 0.42) 0%, rgba(${GOLD}, 0.12) 40%, transparent 68%)`}
                            css={{ animation: still ? undefined : `${KF.belotGlowPulse} 2.6s ease-in-out infinite` }}
                        />
                        <Box
                            position="absolute"
                            top="0"
                            left="0"
                            w={`${FAN_W}px`}
                            h={`${FAN_H}px`}
                            transformOrigin="top left"
                            style={{ transform: `scale(${k})`, perspective: "900px" }}
                        >
                            <Box
                                position="absolute"
                                inset="0"
                                css={{
                                    transformStyle: "preserve-3d",
                                    animation: still
                                        ? undefined
                                        : `${KF.belotFanSway} 5.2s ease-in-out ${IMPACT_MS + 300}ms infinite`,
                                }}
                            >
                                {RANKS.map((rank, i) => {
                                    const angle = FAN_START + i * FAN_STEP
                                    const flipAt = 1150 + i * 70
                                    return (
                                        <Box
                                            key={rank}
                                            position="absolute"
                                            bottom="0"
                                            left={`${(FAN_W - CARD_W) / 2}px`}
                                            w={`${CARD_W}px`}
                                            h={`${CARD_H}px`}
                                            transformOrigin={`50% calc(100% + ${FAN_RADIUS}px)`}
                                            style={{
                                                ["--belot-angle" as string]: `${angle}deg`,
                                                // Also the resting state when animated — see KF.
                                                transform: `rotate(${angle}deg)`,
                                                animationDelay: still ? undefined : `${i * 40}ms`,
                                            }}
                                            css={{
                                                perspective: "700px",
                                                animation: still
                                                    ? undefined
                                                    : `${KF.belotCardDeal} 1000ms cubic-bezier(0.16, 1, 0.3, 1) both`,
                                            }}
                                        >
                                            {/* The wave: one card after another
                                                lifts along its own axis, forever. */}
                                            <Box
                                                w="100%"
                                                h="100%"
                                                style={{ animationDelay: still ? undefined : `${IMPACT_MS + 500 + i * 110}ms` }}
                                                css={{
                                                    transformStyle: "preserve-3d",
                                                    animation: still ? undefined : `${KF.belotCardWave} 2.4s ease-in-out infinite`,
                                                }}
                                            >
                                                <Box
                                                    position="relative"
                                                    w="100%"
                                                    h="100%"
                                                    style={{ animationDelay: still ? undefined : `${flipAt}ms` }}
                                                    css={{
                                                        transformStyle: "preserve-3d",
                                                        animation: still
                                                            ? undefined
                                                            : `${KF.belotCardFlip} 620ms cubic-bezier(0.3, 0.7, 0.2, 1) both`,
                                                    }}
                                                >
                                                    <Box
                                                        position="absolute"
                                                        inset="0"
                                                        css={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
                                                    >
                                                        <PlayingCard card={makeCard(rank, suit)} size="md" deck={DECK} />
                                                        {!still && (
                                                            <Box
                                                                aria-hidden="true"
                                                                position="absolute"
                                                                inset="0"
                                                                overflow="hidden"
                                                                rounded="4px"
                                                                pointerEvents="none"
                                                            >
                                                                <Box
                                                                    position="absolute"
                                                                    top="-10%"
                                                                    bottom="-10%"
                                                                    left="0"
                                                                    w="45%"
                                                                    bg="linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent)"
                                                                    style={{ animationDelay: `${flipAt + 500}ms` }}
                                                                    css={{
                                                                        transform: "translateX(-180%) skewX(-18deg)",
                                                                        animation: `${KF.belotShine} 2.6s ease-out infinite`,
                                                                    }}
                                                                />
                                                            </Box>
                                                        )}
                                                    </Box>
                                                    {!still && (
                                                        <Box
                                                            aria-hidden="true"
                                                            position="absolute"
                                                            inset="0"
                                                            css={{
                                                                transform: "rotateY(180deg)",
                                                                backfaceVisibility: "hidden",
                                                                WebkitBackfaceVisibility: "hidden",
                                                            }}
                                                        >
                                                            <CardBack size="md" deck={DECK} />
                                                        </Box>
                                                    )}
                                                </Box>
                                            </Box>
                                        </Box>
                                    )
                                })}
                            </Box>
                        </Box>

                        {!still && (
                            <>
                                {[0, 1].map((ring) => (
                                    <Box
                                        key={ring}
                                        aria-hidden="true"
                                        position="absolute"
                                        top="50%"
                                        left="50%"
                                        w={ring === 0 ? "120vmin" : "80vmin"}
                                        h={ring === 0 ? "120vmin" : "80vmin"}
                                        rounded="full"
                                        pointerEvents="none"
                                        borderWidth={ring === 0 ? "3px" : "2px"}
                                        borderColor={`rgba(${GOLD}, 0.85)`}
                                        boxShadow={`0 0 50px rgba(${GOLD}, 0.55), inset 0 0 50px rgba(${GOLD}, 0.3)`}
                                        css={{
                                            opacity: 0,
                                            animation: `${KF.belotRing} ${ring === 0 ? 1000 : 1200}ms cubic-bezier(0.16, 1, 0.3, 1) ${IMPACT_MS + ring * 160}ms forwards`,
                                        }}
                                    />
                                ))}
                                {BURST.map((piece, i) => (
                                    <Box
                                        key={i}
                                        aria-hidden="true"
                                        position="absolute"
                                        top="50%"
                                        left="50%"
                                        pointerEvents="none"
                                        lineHeight="0"
                                        style={{
                                            ["--belot-dx" as string]: piece.dx,
                                            ["--belot-dy" as string]: piece.dy,
                                            ["--belot-spin" as string]: piece.spin,
                                            animationDelay: `${piece.delayMs}ms`,
                                            animationDuration: `${piece.durationMs}ms`,
                                        }}
                                        css={{
                                            // Duration and delay come from the inline style above.
                                            animation: `${KF.belotBurst} 1s cubic-bezier(0.16, 0.8, 0.3, 1) both`,
                                        }}
                                    >
                                        {piece.mark ? (
                                            <SuitIcon suit={suit} style={DECK} size={piece.size} />
                                        ) : (
                                            <Box
                                                rounded="full"
                                                bg={`rgb(${GOLD})`}
                                                boxShadow={`0 0 10px rgba(${GOLD}, 0.9)`}
                                                style={{ width: piece.size, height: piece.size }}
                                            />
                                        )}
                                    </Box>
                                ))}
                            </>
                        )}
                    </Box>

                    <Flex direction="column" align="center" gap="2" position="relative" textAlign="center" maxW="600px">
                        {kicker && (
                            <Text
                                fontSize="clamp(18px, 4.6vmin, 34px)"
                                fontWeight="bold"
                                letterSpacing="0.22em"
                                textTransform="uppercase"
                                color="yellow.100"
                                textShadow={`0 2px 14px rgba(${GOLD}, 0.6)`}
                                // The tracking adds a trailing gap; pull the
                                // line back so it stays optically centred.
                                mr="-0.22em"
                                css={{ animation: still ? undefined : `${KF.belotLineIn} 420ms ease-out ${IMPACT_MS + 250}ms both` }}
                            >
                                {kicker}
                            </Text>
                        )}
                        {/* The glow lives on a wrapper: the slam animates
                            `filter` (blur) and would overwrite it. */}
                        <Box css={{ filter: `drop-shadow(0 4px 26px rgba(${GOLD}, 0.55))` }}>
                        <Text
                            as="div"
                            fontSize="clamp(48px, 15vmin, 128px)"
                            lineHeight="1"
                            fontWeight="black"
                            letterSpacing="0.06em"
                            textTransform="uppercase"
                            css={{
                                animation: still
                                    ? undefined
                                    : `${KF.belotWordSlam} 560ms cubic-bezier(0.2, 0.9, 0.25, 1) ${IMPACT_MS - 60}ms both`,
                            }}
                        >
                            {/* Read as one word; the letters are decoration. */}
                            <Box as="span" srOnly>{title}</Box>
                            {letters.map((letter, i) => (
                                <Box
                                    as="span"
                                    key={i}
                                    aria-hidden="true"
                                    display="inline-block"
                                    color="transparent"
                                    style={{
                                        animationDelay: still ? undefined : `${IMPACT_MS + 700 + i * 90}ms, 0ms`,
                                    }}
                                    css={{
                                        backgroundImage:
                                            "linear-gradient(100deg, #f6c453 0%, #fff6d6 25%, #f6c453 50%, #fff6d6 75%, #f6c453 100%)",
                                        backgroundSize: "200% 100%",
                                        backgroundClip: "text",
                                        WebkitBackgroundClip: "text",
                                        animation: still
                                            ? undefined
                                            : `${KF.belotLetterWave} 2.2s ease-in-out infinite, ${KF.belotShimmer} 2.2s linear infinite`,
                                    }}
                                >
                                    {letter}
                                </Box>
                            ))}
                        </Text>
                        </Box>
                        {winner && (
                            <Flex
                                align="center"
                                gap="3"
                                mt="1"
                                maxW="100%"
                                rounded="full"
                                borderWidth="1px"
                                borderColor={`rgba(${GOLD}, 0.7)`}
                                bg="rgba(0, 0, 0, 0.42)"
                                boxShadow={`0 0 28px rgba(${GOLD}, 0.35)`}
                                py="1.5"
                                ps="1.5"
                                pe={{ base: "4", md: "5" }}
                                css={{ animation: still ? undefined : `${KF.belotLineIn} 460ms cubic-bezier(0.16, 1, 0.3, 1) ${IMPACT_MS + 300}ms both` }}
                            >
                                <Box flexShrink={0}>{winner.avatar}</Box>
                                <Flex direction="column" align="flex-start" minW="0" lineHeight="1.15">
                                    {winner.team && (
                                        <Text fontSize="2xs" fontWeight="bold" letterSpacing="0.16em" textTransform="uppercase" color="yellow.200">
                                            {winner.team}
                                        </Text>
                                    )}
                                    <Text
                                        fontSize={{ base: "xl", md: "2xl" }}
                                        fontWeight="black"
                                        color="white"
                                        maxW={{ base: "56vw", md: "360px" }}
                                        truncate
                                    >
                                        {winner.name}
                                    </Text>
                                </Flex>
                            </Flex>
                        )}
                        {subtitle && (
                            <Text
                                fontSize={{ base: "md", md: "xl" }}
                                fontWeight="bold"
                                color="white"
                                textShadow="0 2px 10px rgba(0, 0, 0, 0.6)"
                                css={{ animation: still ? undefined : `${KF.belotLineIn} 420ms ease-out ${IMPACT_MS + 650}ms both` }}
                            >
                                {subtitle}
                            </Text>
                        )}
                        {footnote && (
                            <Text
                                fontSize={{ base: "sm", md: "md" }}
                                fontWeight="semibold"
                                color="yellow.200"
                                css={{ animation: still ? undefined : `${KF.belotLineIn} 420ms ease-out ${IMPACT_MS + 850}ms both` }}
                            >
                                {footnote}
                            </Text>
                        )}
                    </Flex>
                </Flex>

                {/* The flash sits over everything, for a fifth of a second. */}
                {!still && (
                    <Box
                        aria-hidden="true"
                        position="absolute"
                        inset="0"
                        pointerEvents="none"
                        bg={`radial-gradient(circle at 50% 42%, rgba(255, 250, 225, 0.95) 0%, rgba(${GOLD}, 0.5) 35%, transparent 70%)`}
                        css={{ opacity: 0, animation: `${KF.belotFlash} 520ms ease-out ${IMPACT_MS - 40}ms both` }}
                    />
                )}
            </Box>
        </Portal>
    )
}
