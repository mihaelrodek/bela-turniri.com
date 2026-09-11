import { Box, SimpleGrid } from "@chakra-ui/react"
import { useTranslation } from "../../i18n"
import { AVATAR_IDS, type AvatarId } from "./avatarArt"
import BelaAvatar from "./BelaAvatar"

/* ──────────────────────────────────────────────────────────────────────────
   The grid of pickable faces. Used in two places that must feel the same:
   the profile's own avatar section, and the screen where a player sets up
   their identity for online bela.

   Radio semantics, not buttons: a picker is one choice out of a set, and
   `role="radiogroup"` is what makes a screen reader announce it that way and
   what makes arrow keys move between the options. The visible ring is on
   `data-selected`, so nothing depends on colour alone.
   ────────────────────────────────────────────────────────────────────── */

export interface AvatarPickerProps {
    /** Currently picked preset, or null when the player has none yet. */
    value: string | null
    onChange: (id: AvatarId) => void
    /** Edge of one face. The grid reflows to fit. */
    size?: string
    /** Accessible name for the whole group. */
    label?: string
}

export default function AvatarPicker({ value, onChange, size = "56px", label }: AvatarPickerProps) {
    const { t } = useTranslation()
    const groupLabel = label ?? t("profile.avatar.pickerLabel")

    return (
        <SimpleGrid
            role="radiogroup"
            aria-label={groupLabel}
            columns={{ base: 4, sm: 6, md: 8 }}
            gap="2"
        >
            {AVATAR_IDS.map((id) => {
                const selected = value === id
                return (
                    <Box
                        key={id}
                        as="button"
                        // `type` is not in Chakra's Box prop union; it has to
                        // ride through `asProp`-agnostic spread instead.
                        {...{ type: "button" as const }}
                        role="radio"
                        aria-checked={selected}
                        aria-label={t(`profile.avatar.name.${id}`)}
                        title={t(`profile.avatar.name.${id}`)}
                        data-selected={selected ? "" : undefined}
                        onClick={() => onChange(id)}
                        rounded="full"
                        lineHeight="0"
                        p="1"
                        borderWidth="3px"
                        borderColor="transparent"
                        transition="border-color 120ms, box-shadow 120ms, transform 120ms"
                        _hover={{ borderColor: "border.emphasized" }}
                        /* The ring is the ONLY thing marking the pick, so it has
                           to win over the hover rule above — hence the attribute
                           selector rather than a plain `_selected` prop. A 2 px
                           `brand.solid` hairline was the first attempt and read
                           as nothing at all against the dark panel (reported
                           2026-09-11): the pick now carries a thick ring, a
                           brand halo and a slight lift, so it is obvious at a
                           glance which face is yours. */
                        css={{
                            "&[data-selected]": {
                                borderColor: "var(--chakra-colors-brand-solid)",
                                boxShadow: "0 0 0 3px var(--chakra-colors-brand-subtle)",
                                transform: "scale(1.06)",
                            },
                        }}
                    >
                        <BelaAvatar id={id} size={size} />
                    </Box>
                )
            })}
        </SimpleGrid>
    )
}
