import type { ReactNode } from "react"
import { Box, Flex, HStack, IconButton, Text, chakra } from "@chakra-ui/react"
import { FiEye, FiSettings } from "react-icons/fi"
import type { GameEndRule } from "@bela/protocol"
import { useTranslation, usePlural } from "../../i18n"
import { INK, INK_MUTED, TEAM, type TeamSide } from "./tableStyles"

/* Compact HUD controls. The room's rules (target score + end rule) sit over
   the trump cell, in place of the room name — a player already inside the
   room knows which one it is; what they glance up for mid-deal is "are we
   playing to 1001" and "is there a re-entry". Navigation pinned to the outer
   corner (settings only — leaving mid-deal is not offered from here). */

/** "1001 · PROLAZ" — the room's rules, one line of mono. The quick game has
 *  no end rule to show; its name says it all. */
export function TableTitle({ targetScore, gameEndRule, compact = false }: { targetScore: number; gameEndRule: GameEndRule; compact?: boolean }) {
    const { t } = useTranslation()
    return (
        // `compact` is the score panel's foot: the exact type of the two
        // match totals beside it (2xs, mono, regular, 1.2) so the three sit
        // on one line at one size.
        <Text
            fontSize={compact ? "2xs" : "xs"}
            lineHeight={compact ? "1.2" : undefined}
            fontFamily="mono"
            fontVariantNumeric="tabular-nums"
            fontWeight={compact ? "normal" : "semibold"}
            color={compact ? INK_MUTED : INK}
            whiteSpace="nowrap"
            minW="0"
            textAlign="center"
        >
            {targetScore === 163
                ? t("game.create.quick.name").toUpperCase()
                : `${targetScore} · ${t(`game.lobby.finishMode.${gameEndRule}`).toUpperCase()}`}
        </Text>
    )
}

export default function TableHeader({
    targetScore,
    gameEndRule,
    center,
    chips,
    spectators = null,
    onSettings,
}: {
    targetScore: number
    gameEndRule: GameEndRule
    /** What the middle of the row shows instead of the rules label — the
     *  "Zvanja" / "Štihovi" pills (`TableActions`) since 2026-10-08; the
     *  label then lives at the score panel's foot. */
    center?: ReactNode
    /** Spectating / connection / autoplay chips, built by the page. */
    chips?: ReactNode
    /** How many people are watching. Null when the room takes no spectators
     *  at all — the number would always be 0. Sits beside the settings gear
     *  (2026-09-29, user request — moved off the Zvanja/Štihovi row, where it
     *  read as one more action button rather than a status). */
    spectators?: number | null
    onSettings: () => void
}) {
    const { t } = useTranslation()

    return (
        <Flex
            position="relative"
            align="center"
            justify="center"
            // Shorter on a phone (2026-09-20): one line of 12 px type does
            // not need 32 px of row, and the gear keeps its own 32 px tap
            // target by overhanging it.
            minH={{ base: "28px", md: "32px" }}
            px="9"
            pt="0"
            flexShrink={0}
            minW="0"
        >
            <HStack gap="1" minW="0" w="100%" justify="center">
                {center ?? <TableTitle targetScore={targetScore} gameEndRule={gameEndRule} />}
                {chips}
            </HStack>

            {spectators !== null && (
                <Box position="absolute" insetEnd="36px" top="50%" transform="translateY(-50%)">
                    <StatusChip label={t("game.table.spectatorCount", { count: spectators })}>
                        <FiEye aria-hidden="true" size={11} />
                        {spectators}
                    </StatusChip>
                </Box>
            )}

            <IconButton
                position="absolute"
                insetEnd="0"
                top="0"
                size="xs"
                minW="32px"
                minH="32px"
                variant="ghost"
                color={INK}
                _hover={{ bg: "bg.muted" }}
                aria-label={t("game.table.settings")}
                title={t("game.table.settings")}
                onClick={onSettings}
            >
                <FiSettings />
            </IconButton>
        </Flex>
    )
}

export function TableActions({
    declarationsEnabled,
    declarationPoints,
    onDeclarations,
}: {
    declarationsEnabled: boolean
    declarationPoints: Record<TeamSide, number>
    onDeclarations: () => void
}) {
    const { t } = useTranslation()

    return (
        <HStack gap="1" justify="center" flexWrap="wrap">
            <Flex position="relative" align="center">
                <PillButton
                    label={t("game.table.declarationsPill")}
                    badge={null}
                    badgeLabel={t("game.score.declarationBonus")}
                    ariaLabel={`${t("game.declarations.title")} — ${t("game.score.us")}: ${declarationPoints.us}, ${t("game.score.them")}: ${declarationPoints.them}`}
                    disabled={!declarationsEnabled}
                    onClick={onDeclarations}
                />
            </Flex>
        </HStack>
    )
}

/**
 * "Štihovi" — the played-tricks review. Not in the header row any more
 * (2026-10-08, owner): it lives in the felt's top-left corner, and only
 * once there IS a trick to look at; an empty deal shows nothing there.
 */
export function TricksPill({
    tricksPlayed,
    onTricks,
}: {
    tricksPlayed: number
    onTricks: () => void
}) {
    const { t } = useTranslation()
    const plural = usePlural()
    return (
        <PillButton
            label={t("game.tricks.title")}
            title={t("game.tricks.open")}
            // No count on the corner (2026-10-08, owner); the number stays
            // in the accessible name and the tooltip.
            badge={null}
            badgeLabel={plural("game.table.trickCount", tricksPlayed, { n: tricksPlayed })}
            ariaLabel={`${t("game.tricks.title")} — ${plural("game.table.trickCount", tricksPlayed, { n: tricksPlayed })}`}
            onClick={onTricks}
        />
    )
}

/**
 * One header action. Not a glass capsule any more (2026-10-08, owner: it
 * read as a foreign widget on the cream): a mono, letter-spaced, uppercase
 * word in the brand green — the exact voice of the "MI" / "ONI" labels under
 * it. Disabled, it drops to the muted ink.
 *
 * A plain `<Button>` with a `<Box position="absolute">` inside would have
 * done, except that Chakra's Button clips nothing and centres everything —
 * the badge has to hang off the top-right CORNER, which needs the button to
 * be the positioned ancestor. So this is a `chakra.button`.
 */
function PillButton({
    label,
    title,
    badge,
    badgeLabel,
    ariaLabel,
    disabled = false,
    onClick,
}: {
    label: string
    /** A fuller sentence for the tooltip, when the label is only a noun. */
    title?: string
    /** The number on the corner, already formatted; null = no badge. */
    badge: string | null
    /** What that number MEANS, for the screen reader and the tooltip. */
    badgeLabel: string
    ariaLabel?: string
    disabled?: boolean
    onClick: () => void
}) {
    return (
        <chakra.button
            type="button"
            position="relative"
            display="inline-flex"
            alignItems="center"
            gap="0.5"
            h={{ base: "24px", md: "28px" }}
            minW="32px"
            minH={{ base: "24px", md: "28px" }}
            px="2.5"
            rounded="full"
            bg="transparent"
            // The one hairline the whole panel allows itself: the same
            // `border.subtle` as the match lines, so it belongs here.
            borderWidth="1px"
            borderColor={disabled ? "border.subtle" : "brand.300"}
            color={disabled ? INK_MUTED : TEAM.us}
            fontSize="2xs"
            fontFamily="mono"
            fontWeight="bold"
            textTransform="uppercase"
            letterSpacing="widest"
            lineHeight="1"
            flexShrink={0}
            cursor={disabled ? "default" : "pointer"}
            disabled={disabled}
            _hover={disabled ? undefined : { "@media (hover: hover)": { bg: "bg.muted" } }}
            _active={disabled ? undefined : { bg: "bg.muted" }}
            _focusVisible={{ outline: "2px solid", outlineColor: "brand.300", outlineOffset: "2px" }}
            transition="background 0.12s ease, color 0.12s ease"
            aria-label={ariaLabel ?? (badge ? `${label} — ${badgeLabel}` : label)}
            title={badge ? `${title ?? label} — ${badgeLabel}` : (title ?? label)}
            onClick={disabled ? undefined : onClick}
        >
            <Box as="span" className="fold-game-header-label">
                {label}
            </Box>

            {badge !== null && (
                <Flex
                    as="span"
                    aria-hidden="true"
                    position="absolute"
                    top="-5px"
                    insetEnd="-4px"
                    minW="17px"
                    h="17px"
                    px="1"
                    align="center"
                    justify="center"
                    rounded="full"
                    bg="brand.300"
                    color="brand.950"
                    borderWidth="2px"
                    borderColor="brand.950"
                    fontSize="9px"
                    fontFamily="mono"
                    fontWeight="bold"
                    fontVariantNumeric="tabular-nums"
                    lineHeight="1"
                >
                    {badge}
                </Flex>
            )}
        </chakra.button>
    )
}

/** The header's little state chips — connection, autoplay, spectating. Lives
 *  here rather than in the page because it is the header's own vocabulary,
 *  and the page had two copies of it. */
export function StatusChip({
    children,
    tone = "muted",
    label,
}: {
    children: ReactNode
    tone?: "muted" | "warn"
    /** Spoken/hover text for a chip whose visible content is only an icon. */
    label?: string
}) {
    return (
        <Flex
            align="center"
            gap="1"
            title={label}
            role={label ? "img" : undefined}
            aria-label={label}
            px="1.5"
            py="0.5"
            rounded="full"
            flexShrink={0}
            bg={tone === "warn" ? "live" : "bg.opaque"}
            color={tone === "warn" ? "brand.950" : INK_MUTED}
            borderWidth="1px"
            borderColor={tone === "warn" ? "live" : "bg.muted"}
            fontSize="9px"
            fontWeight="bold"
            textTransform="uppercase"
            letterSpacing="wide"
            whiteSpace="nowrap"
        >
            {children}
        </Flex>
    )
}
