import { useState } from "react"
import { Button, IconButton } from "@chakra-ui/react"
import { FiCalendar, FiCheck, FiShare2 } from "react-icons/fi"

import { useTranslation } from "../../i18n"
import { downloadTournamentIcs, hasCalendarDate } from "./shareUtils"
import type { TournamentDetails } from "../../types/tournaments"

/**
 * The two "take this tournament with you" controls.
 *
 * They live here rather than inside the Detalji section because the page
 * SHELL renders them: the sidebar's icon row on lg+ and the mobile header's
 * overflow menu below that are both outside any section, and they must not
 * disappear when the reader opens Parovi or Ždrijeb.
 */

/**
 * Share button — uses the native Web Share sheet (mobile gets the OS's full
 * app picker: WhatsApp, Viber, Messages, AirDrop, etc.). On desktop browsers
 * without `navigator.share`, falls back to copying the link to the clipboard
 * and briefly showing "Kopirano!".
 */
export function ShareButton({
    url,
    title,
    iconOnly,
}: {
    url: string
    title: string
    /** Round icon button for the sidebar's secondary-action row. */
    iconOnly?: boolean
}) {
    const { t: tr } = useTranslation()
    const [copied, setCopied] = useState(false)

    async function onShare() {
        // navigator.share isn't in the DOM lib everywhere we build; narrow
        // through a minimal local shape instead of casting to any.
        const nav = typeof navigator !== "undefined"
            ? (navigator as Navigator & { share?: (d: { title: string; url: string }) => Promise<void> })
            : null
        if (nav?.share) {
            try {
                await nav.share({ title, url })
            } catch {
                /* user cancelled — no-op */
            }
            return
        }
        try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            window.prompt(tr("tournament.share.copyPrompt"), url)
        }
    }

    if (iconOnly) {
        return (
            <IconButton
                aria-label={tr("tournament.share.button")}
                title={copied ? tr("tournament.share.copied") : tr("tournament.share.button")}
                size="sm"
                variant="outline"
                rounded="full"
                colorPalette="blue"
                onClick={onShare}
            >
                {copied ? <FiCheck /> : <FiShare2 />}
            </IconButton>
        )
    }

    return (
        <Button size="xs" variant="outline" colorPalette="blue" onClick={onShare}>
            {copied ? <FiCheck /> : <FiShare2 />}
            {copied ? tr("tournament.share.copied") : tr("tournament.share.button")}
        </Button>
    )
}


export function AddToCalendarButton({ t, iconOnly }: { t: TournamentDetails; iconOnly?: boolean }) {
    const { t: tr } = useTranslation()
    if (!hasCalendarDate(t)) return null

    const onAdd = () => downloadTournamentIcs(t)

    if (iconOnly) {
        return (
            <IconButton
                aria-label={tr("tournament.addToCalendar")}
                title={tr("tournament.addToCalendar")}
                size="sm"
                variant="outline"
                rounded="full"
                colorPalette="blue"
                onClick={onAdd}
            >
                <FiCalendar />
            </IconButton>
        )
    }

    return (
        <Button size="xs" variant="outline" colorPalette="blue" onClick={onAdd}>
            <FiCalendar /> {tr("tournament.addToCalendar")}
        </Button>
    )
}
