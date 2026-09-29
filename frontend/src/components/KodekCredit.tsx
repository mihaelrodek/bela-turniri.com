import { Box, chakra } from "@chakra-ui/react"

/* ──────────────────────────────────────────────────────────────────────────
   KodekCredit — the Kodek logo signature in the footer (2026-09-29, owner
   request: the app is built by his business, Kodek).

   Adapted from the Kodek brand package's own React badge (KodekBadge.tsx,
   "inline" mode): same outlined logo — the "odek_" wordmark is paths, so no
   font is loaded — same 24px minimum height. Two changes for this app: no
   "Izrada:" label (owner: the logo alone says it), and the light/dark
   colours follow the app's own colour mode (`_dark`) instead of one fixed
   theme, so the wordmark flips with the toggle, not the OS.

   The hex values are the BRAND's, not the app theme's, on purpose: the brand
   rules forbid recolouring the logo (Ink/Navy on light, Paper/Blue on dark,
   the square always Navy with a white K).
   ────────────────────────────────────────────────────────────────────── */

const WORD =
    "M107.8 73.02V45.18L117.69 35.19H145.14L155.03 45.18V73.02L145.14 83H117.69ZM139 72.44 142.36 69.08V49.11L139 45.75H123.83L120.47 49.11V69.08L123.83 72.44ZM164.63 73.02V45.18L174.52 35.19H193.53L199.19 40.09V14.46H211.86V83H199.96V75.61L192.57 83H174.52ZM191.42 72.25 199.19 64.28V51.8L192.66 45.94H180.95L177.3 49.69V68.5L180.95 72.25ZM222.42 73.21V45.18L232.31 35.19H259.29L269.27 45.18V63.32H235.1V69.46L238.17 72.63H253.82L256.7 69.66V67.16H269.18V73.4L259.67 83H232.12ZM256.6 54.49V48.92L253.34 45.56H238.36L235.1 48.92V54.49ZM279.35 14.46H292.02V52.76H300.38L312.57 35.19H326.58L310.65 58.23L327.54 83H313.53L300.09 63.51H292.02V83H279.35Z"
const UNDERSCORE = "M328.02 83.96H374.3V94.71H328.02Z"

const KODEK_URL = "https://kodek.hr"

/** The full Kodek logo, 24px high (the brand minimum), colours by colour mode. */
function KodekLogo() {
    return (
        <svg viewBox="0 0 375 95" height="24" aria-hidden="true" focusable="false" style={{ display: "block", width: "auto", flex: "none" }}>
            <g transform="scale(0.775)">
                <rect width="120" height="120" fill="#15318f" />
                <path d="M13.75 14H31.15V106H13.75Z" fill="#ffffff" />
                <path d="M38.75 60 82.25 14h15.3v9.2L62.75 60l43.5 46h-24Z" fill="#ffffff" />
                <path d="M39.55 14h31.2l-9.5 10h-21.7Z" fill="#4264e3" />
            </g>
            <chakra.path d={WORD} css={{ fill: "#201e1d", _dark: { fill: "#f3f2f2" } }} />
            <chakra.path d={UNDERSCORE} css={{ fill: "#15318f", _dark: { fill: "#4264e3" } }} />
        </svg>
    )
}

export default function KodekCredit() {
    return (
        <Box
            asChild
            display="inline-flex"
            alignItems="center"
            minH="36px"
            opacity={0.85}
            _hover={{ opacity: 1 }}
            _focusVisible={{ outline: "2px solid", outlineColor: "brand.solid", outlineOffset: "2px" }}
        >
            <a href={KODEK_URL} target="_blank" rel="noopener" aria-label="Kodek" title="Kodek">
                <KodekLogo />
            </a>
        </Box>
    )
}
