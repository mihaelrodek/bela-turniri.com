import { useCallback, useEffect, useState } from "react"
import { useParams, Link as RouterLink } from "react-router-dom"
import { isAxiosError } from "axios"
import { Box, Button, Card, Grid, Heading, Skeleton, Text, VStack } from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { FiAlertTriangle, FiSlash } from "react-icons/fi"
import { fetchBlokShare, type BlokShareEndRule, type BlokShareSide } from "../api/blokShare"
import { useBlokShareSocket } from "../blok/useBlokShareSocket"
import { BlokGamesList } from "../components/BlokGamesList"
import EmptyState from "../components/EmptyState"
import { useDocumentHead } from "../hooks/useDocumentHead"
import { usePolling } from "../hooks/usePolling"
import { useTranslation, type TParams } from "../i18n"
import { qk } from "../queryClient"

/* ──────────────────────────────────────────────────────────────────────────
   Public, read-only "Bela blok" share page — /blok/z/{token}
   (BLOK-HISTORY.md §5.2). No sign-in, opened straight from a chat-app link,
   almost always on a phone.

   The one state a recipient is most likely to hit is an unknown or revoked
   token (a plain 404 from `GET /blok-share/{token}`, per the contract) — that
   gets the calm "this link no longer works" screen, never a crash, never a
   blank page. `fetchBlokShare` already passes `silent: true` so none of this
   ever surfaces as a red toast.

   A 404 is NOT the same failure as a network error or a 5xx, and must not
   be presented the same way: someone opening the link with no signal, or
   hitting a backend hiccup, would otherwise be told the owner revoked a
   link that is perfectly alive, and give up on it for good. So the two are
   split by status: 404 → dead link, no retry, CTA back to `/blok`;
   anything else (no `response` at all — a network failure — or a 5xx) →
   a separate "something went wrong, try again" state with a `refetch`.

   ── IT UPDATES WHILE YOU WATCH IT (BLOK-HISTORY.md §5.7) ──────────────────
   The owner's scorepad posts its record on every change while the link is
   live, and the backend pings `/ws/live/blok/{token}` after each of those
   commits. This page holds that socket and refetches on every ping, so a deal
   typed at the table appears here within a second or two with no reload. The
   frame carries no data on purpose: the public GET stays the only reader of
   the record, and therefore the only thing that decides the token is still
   valid.

   Polling stays as the FALLBACK, exactly as on the tournament page: an old
   browser, a proxy that strips the upgrade or a captive portal still gets a
   moving page, just slower, and the poll stretches to two minutes while the
   socket is up. Both stop dead on a 404 — see `useBlokShareSocket` for why the
   REST call, and never a failed handshake, is what declares a link revoked.
   ────────────────────────────────────────────────────────────────────── */

/** With the socket up the poll is only a safety net against a missed ping. */
const POLL_LIVE_MS = 120_000
/** Without it, it is the only way this page learns anything. */
const POLL_FALLBACK_MS = 20_000

type Translator = (key: string, params?: TParams) => string

/** `names.us`/`names.them` is `""` when the owner never renamed a side —
 *  same convention as the owner's own view (BLOK-HISTORY.md §2.3). */
function sideName(names: { us: string; them: string }, side: BlokShareSide, t: Translator): string {
    const raw = names[side]
    return raw && raw.trim() ? raw : t(side === "us" ? "blok.side.us" : "blok.side.them")
}

/** The end-of-game rule as a label. Anything other than an explicit
 *  `"dosta"` — including a record saved before the field existed, which is
 *  the common case right after the backend ships it — reads as `"prolaz"`,
 *  the documented default (BLOK-HISTORY.md §5.5). */
function endRuleLabel(rule: BlokShareEndRule | null | undefined, t: Translator): string {
    return t(rule === "dosta" ? "pages.blokShare.rule.dosta" : "pages.blokShare.rule.prolaz")
}

/**
 * Keeps this route out of search results. Deliberately NOT done through the
 * shared `useDocumentHead` hook, which has no concept of `<meta
 * name="robots">` — this is a small, self-contained effect local to this
 * page instead of a change to a hook every other route also uses.
 *
 * Why noindex: a share link is meant for the specific recipient it was sent
 * to, not for search traffic — it carries no content a search engine visitor
 * would be looking for, and the owner can revoke it at any moment (§5.2), at
 * which point an indexed copy would just be a dead link sitting in search
 * results. `og:title`/`og:description` (set below via `useDocumentHead`)
 * stay on, though: those drive the link-preview card in the chat app the
 * link is actually shared through, which is the whole point of the feature.
 */
function useNoIndex() {
    useEffect(() => {
        let el = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')
        const created = !el
        if (!el) {
            el = document.createElement("meta")
            el.setAttribute("name", "robots")
            document.head.appendChild(el)
        }
        const previous = el.getAttribute("content")
        el.setAttribute("content", "noindex, nofollow")
        return () => {
            if (!el) return
            if (created) {
                el.parentElement?.removeChild(el)
            } else if (previous != null) {
                el.setAttribute("content", previous)
            }
        }
    }, [])
}

export default function SharedBlokPage() {
    const { token = "" } = useParams<{ token: string }>()
    const { t } = useTranslation()

    useNoIndex()

    const { data, isLoading, isError, error, isFetching, refetch } = useQuery({
        queryKey: qk.blokShare(token),
        queryFn: () => fetchBlokShare(token),
        enabled: token.length > 0,
        // A 404 means "revoked or never existed" — retrying won't help, and
        // the interceptor already stays silent for this call (`silent: true`
        // in `fetchBlokShare`), so an automatic retry storm would just delay
        // the "this link no longer works" screen for no benefit. A network
        // failure or 5xx gets an explicit, user-triggered `refetch()`
        // instead (below), which is a more honest signal than a silent
        // background retry the recipient never sees.
        retry: false,
    })

    // `isAxiosError` (not a hand-rolled cast) is the project's established
    // way to read a caught request error's status — see `pages/
    // CreateTournamentPage.tsx` / `pages/profile/MyDataCard.tsx`. No
    // `response` at all means a network failure never reached the backend;
    // that and any 5xx are NOT "the link is dead", only a 404 is.
    const status = isAxiosError(error) ? error.response?.status : undefined
    const notFound = !token || status === 404
    const fetchFailed = token.length > 0 && isError && !notFound

    /* ── live updates (BLOK-HISTORY.md §5.7) ─────────────────────────────
       `cancelRefetch: false` on both refreshers below: a ping landing while the
       poll's request is already in flight must ride on that request rather
       than abort and re-issue it, which is what `refetch()` does by default. */
    const refresh = useCallback(() => {
        void refetch({ cancelRefetch: false })
    }, [refetch])

    /* The socket is opened only once the record has actually loaded, and
       dropped the moment the GET says 404 — the two halves of "stop
       reconnecting once the record is gone". Waiting for `data` means a
       mistyped or long-revoked link (the likeliest thing a recipient hits)
       never attempts a single handshake; dropping on 404 is what stops the
       revoke case, where the backend pings once, closes, and would refuse
       every reconnect for ever after.

       A network failure is NOT a revoke: `fetchFailed` deliberately leaves the
       socket alone, because a reconnect is exactly how that state recovers,
       and `data` survives an error in the query cache. */
    const { connected } = useBlokShareSocket(
        data !== undefined && !notFound ? token : undefined,
        refresh,
    )

    /*
     * `connected` must not reach `usePolling` raw. It flips on every reconnect,
     * the flip changes `intervalMs`, a changed interval tears the poll down and
     * rebuilds it — and `usePolling` fires its callback immediately on
     * (re)mount. So a socket flap would cost every open page extra GETs at the
     * exact moment the backend is coming back up. Committing the flip only once
     * it has held for 5 s makes a flap invisible to the interval. Same
     * reasoning, same figure, as `hooks/useTournamentData.ts`.
     */
    const [connectedSettled, setConnectedSettled] = useState(false)
    useEffect(() => {
        const id = setTimeout(() => setConnectedSettled(connected), 5_000)
        return () => clearTimeout(id)
    }, [connected])

    usePolling(
        refresh,
        connectedSettled ? POLL_LIVE_MS : POLL_FALLBACK_MS,
        // A revoked or unknown token is never asked about again: retrying a
        // 404 cannot bring the link back, and the page has already said so.
        token.length > 0 && !notFound,
    )

    const us = data ? sideName(data.names, "us", t) : ""
    const them = data ? sideName(data.names, "them", t) : ""

    useDocumentHead({
        title: t("pages.blokShare.seo.title"),
        description: t("pages.blokShare.seo.description"),
        ogTitle: data ? t("pages.blokShare.seo.ogTitle") : undefined,
        ogDescription: data
            ? t("pages.blokShare.seo.ogDescription", {
                us,
                them,
                gamesUs: data.gamesUs,
                gamesThem: data.gamesThem,
            })
            : undefined,
        canonical: token
            ? `https://bela-turniri.com/blok/z/${encodeURIComponent(token)}`
            : undefined,
    })

    if (notFound) {
        return (
            <Box maxW="md" mx="auto" mt={{ base: "4", md: "8" }}>
                <EmptyState
                    icon={FiSlash}
                    title={t("pages.blokShare.notFoundTitle")}
                    description={t("pages.blokShare.notFoundDescription")}
                    action={
                        <Button asChild colorPalette="brand" variant="solid" size="sm">
                            <RouterLink to="/blok">{t("pages.blokShare.notFoundCta")}</RouterLink>
                        </Button>
                    }
                />
            </Box>
        )
    }

    if (fetchFailed) {
        return (
            <Box maxW="md" mx="auto" mt={{ base: "4", md: "8" }}>
                <EmptyState
                    icon={FiAlertTriangle}
                    title={t("pages.blokShare.fetchFailedTitle")}
                    description={t("pages.blokShare.fetchFailedDescription")}
                    action={
                        <Button
                            colorPalette="brand"
                            variant="solid"
                            size="sm"
                            loading={isFetching}
                            onClick={() => refetch()}
                        >
                            {t("pages.blokShare.retry")}
                        </Button>
                    }
                />
            </Box>
        )
    }

    if (isLoading || !data) {
        return (
            <VStack maxW="lg" mx="auto" mt={{ base: "4", md: "8" }} gap="4" align="stretch">
                <Skeleton h="36" rounded="xl" />
                <Skeleton h="24" rounded="lg" />
                <Skeleton h="24" rounded="lg" />
            </VStack>
        )
    }

    return (
        <VStack maxW="lg" mx="auto" mt={{ base: "2", md: "6" }} gap="4" align="stretch">
            {/* `bg.subtle`, not the card recipe's default `bg.panel`: that
                token is 61% translucent by design (system.ts), which let the
                canvas illustration read straight through a card whose whole
                job is to show a score. Every surface on this page is an
                opaque ladder step for that reason — see BlokGamesList. */}
            <Card.Root
                variant="outline"
                rounded="xl"
                borderColor="border.emphasized"
                bg="bg.subtle"
                shadow="sm"
            >
                <Card.Body p={{ base: "5", md: "6" }}>
                    <VStack gap="3" align="stretch">
                        <Grid
                            templateColumns="minmax(0, 1fr) auto minmax(0, 1fr)"
                            alignItems="end"
                            gap={{ base: "2", md: "4" }}
                        >
                            <VStack align="start" gap="1" minW="0" colorPalette="green">
                                <Text
                                    fontSize="sm"
                                    fontWeight="bold"
                                    lineHeight="1.2"
                                    textTransform="uppercase"
                                    letterSpacing="0.04em"
                                    color="colorPalette.fg"
                                    lineClamp={2}
                                >
                                    {us}
                                </Text>
                                <Heading size="3xl" color="colorPalette.fg" css={{ fontVariantNumeric: "tabular-nums" }}>
                                    {data.gamesUs}
                                </Heading>
                            </VStack>
                            <Text color="fg.subtle" fontSize="sm" pb="2">
                                {t("pages.blokShare.vs")}
                            </Text>
                            <VStack align="end" gap="1" minW="0" textAlign="end" colorPalette="red">
                                <Text
                                    fontSize="sm"
                                    fontWeight="bold"
                                    lineHeight="1.2"
                                    textTransform="uppercase"
                                    letterSpacing="0.04em"
                                    color="colorPalette.fg"
                                    lineClamp={2}
                                >
                                    {them}
                                </Text>
                                <Heading size="3xl" color="colorPalette.fg" css={{ fontVariantNumeric: "tabular-nums" }}>
                                    {data.gamesThem}
                                </Heading>
                            </VStack>
                        </Grid>
                        {/* "Do 1001 · prolaz" (BLOK-HISTORY.md §5.5). The game
                            COUNT deliberately left this line: the games are
                            listed directly below, so counting them here was
                            saying the same thing twice. */}
                        <Text fontSize="xs" color="fg.muted" textAlign="center">
                            {t("pages.blokShare.meta", {
                                target: data.target,
                                rule: endRuleLabel(data.gameEndRule, t),
                            })}
                        </Text>
                    </VStack>
                </Card.Body>
            </Card.Root>

            <BlokGamesList
                games={data.games}
                nameUs={us}
                nameThem={them}
            />
        </VStack>
    )
}
