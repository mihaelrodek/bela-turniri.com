import { Box, HStack, IconButton, Text, VStack } from "@chakra-ui/react"
import { FiAlertCircle, FiClock, FiLink2, FiSlash, FiUploadCloud, FiX } from "react-icons/fi"

import { useTranslation } from "../../i18n"
import type { BlokLink, BlokLinkStatus } from "../types"

/* ──────────────────────────────────────────────────────────────────────────
   BlokLinkStrip — the one line in the scoreboard that says whether what the
   player is typing is reaching the organiser (BLOK-LINK.md §3.4).

   It renders ONLY when a link exists, which is the visible half of the
   feature's central promise: a scorepad nobody linked looks and behaves
   exactly as it did before any of this was written.

   Four states, four different things a player needs to know:
     PENDING   — the organiser has not answered yet, nothing is being sent;
     APPROVED  — where the score is going (round and table, because that is
                 how a table is identified out loud in a hall);
     REJECTED  — the organiser said no;
     REVOKED   — it is over: the player broke it, the organiser broke it, or
                 the round closed underneath it.

   The last two are dismissable rather than self-clearing. A strip that
   removed itself the moment a link died would leave the player wondering why
   their score stopped arriving, with nothing on screen to explain it.

   `pendingSince` is shown as a quiet second line, never as a toast: it means
   "the last push has not landed yet", which on bar Wi-Fi is a normal thing
   that fixes itself. Colour is never the only carrier — every state has its
   own icon and its own sentence.
   ────────────────────────────────────────────────────────────────────── */

/** Colour and icon per state. `yellow` for "waiting on the organiser" is the
 *  same language the organiser's own pair list uses for pending approvals. */
const LOOK: Record<
    BlokLinkStatus,
    { palette: "yellow" | "green" | "red" | null; icon: typeof FiLink2; titleKey: string }
> = {
    PENDING: { palette: "yellow", icon: FiClock, titleKey: "blok.link.status.pending" },
    APPROVED: { palette: "green", icon: FiLink2, titleKey: "blok.link.status.approved" },
    REJECTED: { palette: "red", icon: FiSlash, titleKey: "blok.link.status.rejected" },
    // Ended for an ordinary reason — neutral, not an alarm.
    REVOKED: { palette: null, icon: FiAlertCircle, titleKey: "blok.link.status.revoked" },
}

export default function BlokLinkStrip({
    link,
    usName,
    themName,
    onUnlink,
    onDismiss,
}: {
    link: BlokLink
    /** The local side names, already resolved through `useSideNames` — the
     *  strip says "MI = Ivan i Marko" in whatever the player calls the sides. */
    usName: string
    themName: string
    /** Break a live link (PENDING / APPROVED) — the page confirms first. */
    onUnlink: () => void
    /** Clear a finished link (REJECTED / REVOKED) — nothing left to lose. */
    onDismiss: () => void
}) {
    const { t } = useTranslation()
    const look = LOOK[link.status]
    const Icon = look.icon
    const live = link.status === "PENDING" || link.status === "APPROVED"

    /* "Runda 3 · Stol 4", prefixed by the tournament when we know its name.
       Joined with a middot rather than a translated sentence: these are
       labels, not grammar, and the order is the same in both languages. */
    const where = [
        link.tournamentName,
        link.status === "APPROVED" ? t("blok.link.round", { n: link.roundNumber }) : null,
        link.status === "APPROVED"
            ? link.tableNo === null
                ? t("blok.link.tableUnknown")
                : t("blok.link.table", { n: link.tableNo })
            : null,
    ]
        .filter((part): part is string => typeof part === "string" && part !== "")
        .join(" · ")

    return (
        <Box
            {...(look.palette ? { colorPalette: look.palette } : {})}
            mt="3"
            px="3"
            py="2"
            rounded="l2"
            borderWidth="1px"
            borderColor={look.palette ? "colorPalette.emphasized" : "border.subtle"}
            bg={look.palette ? "colorPalette.subtle" : "bg.subtle"}
        >
            <HStack gap="2.5" align="start">
                <Box
                    color={look.palette ? "colorPalette.fg" : "fg.muted"}
                    flexShrink="0"
                    mt="0.5"
                    display="flex"
                    aria-hidden="true"
                >
                    <Icon size={16} />
                </Box>

                <VStack gap="0" align="start" flex="1" minW="0">
                    <Text
                        fontSize="sm"
                        fontWeight="semibold"
                        color={look.palette ? "colorPalette.fg" : "fg.ink"}
                        truncate
                        maxW="100%"
                    >
                        {t(look.titleKey)}
                    </Text>
                    {where ? (
                        <Text fontSize="xs" color="fg.muted" truncate maxW="100%">
                            {where}
                        </Text>
                    ) : null}
                    {link.status === "APPROVED" ? (
                        <Text fontSize="xs" color="fg.subtle" truncate maxW="100%">
                            {t("blok.link.sideMapping", {
                                us: usName,
                                usPair: link.usPairName,
                                them: themName,
                                themPair: link.themPairName,
                            })}
                        </Text>
                    ) : null}
                    {link.status === "APPROVED" && link.pendingSince !== null ? (
                        <HStack gap="1.5" mt="1" color="fg.muted">
                            <Box flexShrink="0" display="flex" aria-hidden="true">
                                <FiUploadCloud size={12} />
                            </Box>
                            <Text fontSize="xs">{t("blok.link.pendingSend")}</Text>
                        </HStack>
                    ) : null}
                </VStack>

                <IconButton
                    aria-label={live ? t("blok.link.unlink") : t("blok.link.dismiss")}
                    title={live ? t("blok.link.unlink") : t("blok.link.dismiss")}
                    size="xs"
                    variant="ghost"
                    rounded="full"
                    flexShrink="0"
                    onClick={live ? onUnlink : onDismiss}
                >
                    <FiX />
                </IconButton>
            </HStack>
        </Box>
    )
}
