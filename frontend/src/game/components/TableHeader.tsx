import type { ReactNode } from "react"
import { Box, Flex, HStack, IconButton, Text, chakra } from "@chakra-ui/react"
import { FiFileText, FiLayers, FiSettings } from "react-icons/fi"
import type { GameEndRule } from "@bela/protocol"
import { useTranslation, usePlural } from "../../i18n"
import { GLASS, INK, INK_MUTED, TEAM, type TeamSide } from "./tableStyles"

/* Compact HUD controls. The room's rules (target score + end rule) sit over
   the trump cell, in place of the room name — a player already inside the
   room knows which one it is; what they glance up for mid-deal is "are we
   playing to 1001" and "is there a re-entry". Navigation pinned to the outer
   corner (settings only — leaving mid-deal is not offered from here). */

export default function TableHeader({
    targetScore,
    gameEndRule,
    chips,
    onSettings,
}: {
    targetScore: number
    gameEndRule: GameEndRule
    /** Spectating / connection / autoplay chips, built by the page. */
    chips?: ReactNode
    onSettings: () => void
}) {
    const { t } = useTranslation()

    return (
        <Flex
            position="relative"
            align="center"
            justify="center"
            minH="32px"
            px="9"
            pt="1"
            flexShrink={0}
            minW="0"
        >
            <HStack gap="1" minW="0" justify="center">
                <Text fontSize="xs" fontWeight="semibold" color={INK} lineClamp={1} minW="0" textAlign="center">
                    {targetScore} · {t(`game.lobby.finishMode.${gameEndRule}`).toUpperCase()}
                </Text>
                {chips}
            </HStack>

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
    chat,
    declarationsEnabled,
    declarationPoints,
    onDeclarations,
    tricksEnabled,
    tricksPlayed,
    onTricks,
}: {
    chat?: ReactNode
    declarationsEnabled: boolean
    declarationPoints: Record<TeamSide, number>
    onDeclarations: () => void
    tricksEnabled: boolean
    tricksPlayed: number
    onTricks: () => void
}) {
    const { t } = useTranslation()
    const plural = usePlural()

    return (
        <HStack gap="1" justify="center" flexWrap="wrap">
            <Flex position="relative" align="center">
                <PillButton
                    icon={<FiFileText />}
                    label={t("game.declarations.title")}
                    badge={null}
                    badgeLabel={t("game.score.declarationBonus")}
                    ariaLabel={`${t("game.declarations.title")} — ${t("game.score.us")}: ${declarationPoints.us}, ${t("game.score.them")}: ${declarationPoints.them}`}
                    disabled={!declarationsEnabled}
                    onClick={onDeclarations}
                />
                {declarationPoints.us > 0 && (
                    <DeclarationBadge side="us" points={declarationPoints.us} position="start" />
                )}
                {declarationPoints.them > 0 && (
                    <DeclarationBadge side="them" points={declarationPoints.them} position="end" />
                )}
            </Flex>
            {tricksEnabled && (
                <PillButton
                    icon={<FiLayers />}
                    label={t("game.tricks.title")}
                    title={t("game.tricks.open")}
                    badge={tricksPlayed > 0 ? `${tricksPlayed}` : null}
                    badgeLabel={plural("game.table.trickCount", tricksPlayed, { n: tricksPlayed })}
                    onClick={onTricks}
                />
            )}
            {chat}
        </HStack>
    )
}

function DeclarationBadge({
    side,
    points,
    position,
}: {
    side: TeamSide
    points: number
    position: "start" | "end"
}) {
    return (
        <Flex
            as="span"
            aria-hidden="true"
            position="absolute"
            top="-6px"
            {...(position === "start" ? { insetStart: "-10px" } : { insetEnd: "-10px" })}
            minW="19px"
            h="17px"
            px="1"
            align="center"
            justify="center"
            rounded="full"
            bg={side === "us" ? "brand.300" : "yellow.400"}
            color="brand.950"
            borderWidth="2px"
            borderColor="bg.opaque"
            fontSize="9px"
            fontWeight="bold"
            fontVariantNumeric="tabular-nums"
            lineHeight="1"
            outline="1px solid"
            outlineColor={TEAM[side]}
        >
            {points}
        </Flex>
    )
}

/**
 * One header action: glass capsule, icon, label from `md` up, and an optional
 * badge.
 *
 * A plain `<Button>` with a `<Box position="absolute">` inside would have
 * done, except that Chakra's Button clips nothing and centres everything —
 * the badge has to hang off the top-right CORNER, which needs the button to
 * be the positioned ancestor. So this is a `chakra.button`, styled from the
 * same `GLASS` every other panel on the felt uses.
 */
function PillButton({
    icon,
    label,
    title,
    badge,
    badgeLabel,
    ariaLabel,
    disabled = false,
    onClick,
}: {
    icon: ReactNode
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
            gap="1.5"
            h="28px"
            minW="32px"
            minH="28px"
            px="2"
            rounded="full"
            {...GLASS}
            color={INK}
            fontSize="xs"
            fontWeight="semibold"
            lineHeight="1"
            flexShrink={0}
            opacity={disabled ? 0.45 : 1}
            cursor={disabled ? "default" : "pointer"}
            disabled={disabled}
            _hover={disabled ? undefined : { bg: "bg.muted" }}
            _focusVisible={{ outline: "2px solid", outlineColor: "brand.300", outlineOffset: "2px" }}
            transition="background 0.12s ease, opacity 0.12s ease"
            aria-label={ariaLabel ?? (badge ? `${label} — ${badgeLabel}` : label)}
            title={badge ? `${title ?? label} — ${badgeLabel}` : (title ?? label)}
            onClick={disabled ? undefined : onClick}
        >
            <Flex as="span" align="center" fontSize="14px" aria-hidden="true">
                {icon}
            </Flex>
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
export function StatusChip({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "warn" }) {
    return (
        <Flex
            align="center"
            px="1.5"
            py="0.5"
            rounded="full"
            flexShrink={0}
            bg={tone === "warn" ? "orange.400" : "bg.opaque"}
            color={tone === "warn" ? "brand.950" : INK_MUTED}
            borderWidth="1px"
            borderColor={tone === "warn" ? "orange.400" : "bg.muted"}
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
