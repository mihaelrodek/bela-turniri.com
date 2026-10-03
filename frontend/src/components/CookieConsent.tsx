import { useEffect, useState } from "react"
import { Box, Button, Flex, HStack, Text, chakra } from "@chakra-ui/react"
import { FiShield } from "react-icons/fi"
import { Link as RouterLink } from "react-router-dom"
import { useTranslation } from "../i18n"
import { isNative } from "../platform"

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

    // Never inside the iOS/Android shells: index.html only injects gtag.js on
    // the production web hostnames, and the WebView serves from
    // capacitor://localhost / https://localhost, so there is no analytics to
    // consent to. Asking anyway would be a banner about cookies the app never
    // sets. Nothing else reads the stored decision (the effect above only
    // re-grants a tag that is absent natively), so leaving it unset is safe.
    // Checked AFTER the hooks so their call order never depends on it.
    if (isNative || decision !== null) return null

    function choose(next: ConsentDecision) {
        setDecision(next)
        persistDecision(next)
        if (next === "accepted") {
            window.gtag?.("consent", "update", { analytics_storage: "granted" })
        }
        // On decline we do nothing further — index.html's "denied" default
        // already stands and is never overridden.
    }

    /* PHONE: a bottom sheet over a dimmed page (2026-09-29, user report).
       It used to be the desktop's small translucent glass strip floating
       above the tab bar — on a phone the page showed through it and it sat
       among the page's own bottom controls ("Pokreni igru"), so it read as
       one more of them. Now it is opaque, full width, above the tab bar, with
       a title and two full-size buttons, and the scrim says "answer this
       first". Declining is exactly as easy as accepting (same size, side by
       side), as GDPR consent requires.
       DESKTOP: the same card, opaque, bottom centre — no scrim; a wide screen
       has room for it without covering anything that matters. */
    return (
        <>
            <Box
                display={{ base: "block", md: "none" }}
                position="fixed"
                inset="0"
                bg="blackAlpha.500"
                zIndex={1400}
                aria-hidden="true"
            />
            <Box
                role="dialog"
                aria-labelledby="cookie-consent-title"
                position="fixed"
                left={{ base: "0", md: "max(var(--chakra-spacing-3), var(--safe-left))" }}
                right={{ base: "0", md: "max(var(--chakra-spacing-3), var(--safe-right))" }}
                // md+: clear of the sticky footer (~60px) instead of hiding behind it
                bottom={{ base: "0", md: "76px" }}
                maxW={{ base: "none", md: "2xl" }}
                mx={{ base: 0, md: "auto" }}
                zIndex={1401}
                bg="bg.panel"
                borderWidth={{ base: "0", md: "1px" }}
                borderTopWidth="1px"
                borderColor="border.subtle"
                roundedTop={{ base: "l3", md: "l2" }}
                roundedBottom={{ base: "0", md: "l2" }}
                boxShadow="raised"
                px={{ base: "5", md: "4" }}
                pt={{ base: "5", md: "4" }}
                style={{ paddingBottom: "max(var(--chakra-spacing-5), calc(var(--chakra-spacing-3) + var(--safe-bottom)))" }}
            >
                <Flex direction={{ base: "column", md: "row" }} gap={{ base: "4", md: "4" }} align={{ base: "stretch", md: "center" }}>
                    <Box flex="1" minW="0">
                        <HStack gap="2" mb="1.5" color="fg">
                            <FiShield aria-hidden="true" />
                            <Text id="cookie-consent-title" fontWeight="semibold" fontSize={{ base: "md", md: "sm" }}>
                                {t("common.cookieConsent.title")}
                            </Text>
                        </HStack>
                        <Text fontSize="sm" color="fg.muted">
                            {t("common.cookieConsent.description")}{" "}
                            <chakra.a asChild color="blue.fg" textDecoration="underline">
                                <RouterLink to="/privatnost">{t("common.cookieConsent.privacyLink")}</RouterLink>
                            </chakra.a>
                        </Text>
                    </Box>
                    <HStack gap="2" flexShrink={0}>
                        <Button flex={{ base: "1", md: "none" }} size={{ base: "lg", md: "sm" }} variant="outline" onClick={() => choose("declined")}>
                            {t("common.cookieConsent.decline")}
                        </Button>
                        <Button flex={{ base: "1", md: "none" }} size={{ base: "lg", md: "sm" }} variant="solid" colorPalette="blue" onClick={() => choose("accepted")}>
                            {t("common.cookieConsent.accept")}
                        </Button>
                    </HStack>
                </Flex>
            </Box>
        </>
    )
}
