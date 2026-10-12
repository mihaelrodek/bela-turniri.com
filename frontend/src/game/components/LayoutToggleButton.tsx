import { IconButton } from "@chakra-ui/react"
import { MdScreenRotation } from "react-icons/md"
import { useTranslation } from "../../i18n"
import { setPreferNormalLayout } from "../landscapeTableStore"
import { INK } from "./tableStyles"

/* ──────────────────────────────────────────────────────────────────────────
   LayoutToggleButton — the player switches the room's layout by hand
   (2026-10-12, owner).

   On a landscape phone the room is the full-screen table by default. This
   button, in the landscape table's top-right corner beside the gear, goes
   back to the ordinary layout; in the ordinary layout it sits beside the
   header's gear — and ONLY while the phone is held sideways (the page
   decides that from `useLandscapeTableMedia`) — and goes back. The choice
   is `preferNormal` in `landscapeTableStore`, remembered per device.

   `target` is the layout a tap switches TO; it picks the accessible label.
   The same ghost style as the header's settings gear.
   ────────────────────────────────────────────────────────────────────── */

export default function LayoutToggleButton({
    target,
    size = 32,
}: {
    target: "landscape" | "normal"
    /** The tap target, px — 32 in the header, the corner's 36 on the felt. */
    size?: number
}) {
    const { t } = useTranslation()
    const label = target === "landscape" ? t("game.table.layoutLandscape") : t("game.table.layoutNormal")
    return (
        <IconButton
            size="xs"
            minW={`${size}px`}
            minH={`${size}px`}
            rounded="full"
            variant="ghost"
            color={INK}
            _hover={{ bg: "bg.muted" }}
            aria-label={label}
            title={label}
            onClick={() => {
                setPreferNormalLayout(target === "normal")
                lockOrientation(target)
            }}
        >
            <MdScreenRotation />
        </IconButton>
    )
}

/** Ask the browser to hold the screen the way the chosen layout wants it
 *  (2026-10-12). Only Android browsers in fullscreen or an installed PWA
 *  grant it; everywhere else it rejects, and `RotateToPortrait` asks the
 *  player to turn the phone instead. Never throws. */
function lockOrientation(target: "landscape" | "normal"): void {
    try {
        const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
        if (target === "normal") orientation.lock?.("portrait")?.catch(() => {})
        else orientation.unlock?.()
    } catch {
        // No Screen Orientation API: nothing to do.
    }
}
