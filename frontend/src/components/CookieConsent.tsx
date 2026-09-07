import { useEffect, useState } from "react"
import { Box, Button, HStack, Text, chakra } from "@chakra-ui/react"
import { Link as RouterLink } from "react-router-dom"
import { useTranslation } from "../i18n"
import { MOBILE_TABBAR_CLEARANCE } from "./navChrome"

/* ──────────────────────────────────────────────────────────────────────────
   GDPR consent banner for the GA4 analytics tag.

   index.html's inline GA4 snippet always loads gtag.js on the prod hostnames
   and immediately calls `gtag('consent', 'default', {analytics_storage:
   'denied', ...})` before anything is configured — so no cookie is set and
   no identifier is attached to any hit until a visitor actively grants it.
   This component is the other half: it renders the choice, and on accept
   calls `gtag('consent', 'update', {analytics_storage: 'granted'})` to lift
   that default for the rest of the session (and future ones, since the
   decision is persisted).

   Persistence is a plain localStorage flag, not a cookie — the site needs no
   cookie of its own to remember "decided", and storing the decision itself
   client-side needs no consent to begin with (it isn't tracking, it's
   remembering a UI choice).
   ────────────────────────────────────────────────────────────────────── */

// index.html defines `window.gtag` imperatively (a plain JS snippet, no
// npm package) — TS has no ambient type for it anywhere else in the repo,
// so it's declared here where it's first consumed from TypeScript.
declare global {
    interface Window {
        gtag?: (...args: unknown[]) => void
    }
}

const STORAGE_KEY = "bela:consent:v1"

type ConsentDecision = "accepted" | "declined"

function readDecision(): ConsentDecision | null {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        return raw === "accepted" || raw === "declined" ? raw : null
    } catch {
        // Private mode / storage blocked — treat as "no decision yet" every
        // visit; the banner will just show again, which is the safe default.
        return null
    }
}

function persistDecision(decision: ConsentDecision) {
    try {
        window.localStorage.setItem(STORAGE_KEY, decision)
    } catch {
        /* non-fatal — the banner just reappears next visit */
    }
}

export default function CookieConsent() {
    const { t } = useTranslation()
    // Lazy initializer so the very first render already knows the answer —
    // avoids a flash of the banner for someone who already decided.
    const [decision, setDecision] = useState<ConsentDecision | null>(() => readDecision())

    // If the visitor already accepted on a previous visit, tell gtag as soon
    // as this mounts — index.html's default runs on every page load, so the
    // "granted" update has to be re-applied on every load too, not just at
    // the moment of the original click.
    useEffect(() => {
        if (decision === "accepted") {
            window.gtag?.("consent", "update", { analytics_storage: "granted" })
        }
    }, [decision])

    if (decision !== null) return null

    function choose(next: ConsentDecision) {
        setDecision(next)
        persistDecision(next)
        if (next === "accepted") {
            window.gtag?.("consent", "update", { analytics_storage: "granted" })
        }
        // On decline we do nothing further — index.html's "denied" default
        // already stands and is never overridden.
    }

    return (
        <Box
            position="fixed"
            left="3"
            right="3"
            // Clears MobileTabBar on mobile (it's fixed at the same viewport
            // edge); on md+ the tab bar doesn't exist, so a small fixed gap
            // is enough.
            bottom={{ base: MOBILE_TABBAR_CLEARANCE, md: "4" }}
            maxW="2xl"
            mx={{ base: 0, md: "auto" }}
            zIndex={950}
            layerStyle="glass.bar"
            borderWidth="1px"
            borderColor="border.glass"
            rounded="l2"
            boxShadow="raised"
            p="4"
        >
            <HStack gap="4" align="center" wrap="wrap" justify="space-between">
                <Text fontSize="sm" color="fg.soft" flex="1" minW="200px">
                    {t("common.cookieConsent.description")}{" "}
                    <chakra.a asChild color="blue.fg" textDecoration="underline">
                        <RouterLink to="/privatnost">{t("common.cookieConsent.privacyLink")}</RouterLink>
                    </chakra.a>
                </Text>
                <HStack gap="2" flexShrink={0}>
                    <Button size="sm" variant="ghost" onClick={() => choose("declined")}>
                        {t("common.cookieConsent.decline")}
                    </Button>
                    <Button size="sm" variant="solid" colorPalette="blue" onClick={() => choose("accepted")}>
                        {t("common.cookieConsent.accept")}
                    </Button>
                </HStack>
            </HStack>
        </Box>
    )
}
