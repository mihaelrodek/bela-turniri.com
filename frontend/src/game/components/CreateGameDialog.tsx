import { useState } from "react"
import { Box, Button, Dialog, HStack, NativeSelect, Portal, Text, VStack, useBreakpointValue } from "@chakra-ui/react"
import { FiArrowRight, FiChevronDown, FiChevronUp } from "react-icons/fi"
import { GAME_END_RULES, TRICK_REVIEWS, WIN_RATE_REQUIREMENTS } from "@bela/protocol"
import type { ClientMessage, GameEndRule, TargetScore, TrickReview, WinRateRequirement } from "@bela/protocol"
import { useTranslation } from "../../i18n"
import GameOption from "./GameOption"

export type CreateGameOptions = Omit<Extract<ClientMessage, { t: "room.create" }>, "t">
const TARGETS: readonly TargetScore[] = [163, 501, 701, 1001]

export default function CreateGameDialog({ open, onOpenChange, onCreate, busy = false }: {
    open: boolean
    onOpenChange: (open: boolean) => void
    onCreate: (options: CreateGameOptions) => void
    busy?: boolean
}) {
    const { t } = useTranslation()
    const [targetScore, setTarget] = useState<TargetScore>(1001)
    const [gameEndRule, setGameEndRule] = useState<GameEndRule>("prolaz")
    const [isPrivate, setPrivate] = useState(false)
    const [allowSpectators, setAllowSpectators] = useState(false)
    const [noDeclarations, setNoDeclarations] = useState(false)
    const [allowBela, setAllowBela] = useState(true)
    const [minWinRatePercent, setMinWinRatePercent] = useState<WinRateRequirement>(0)
    // "Gledanje štihova" (game/README.md §1.8). Three states, OFF by default.
    const [trickReview, setTrickReview] = useState<TrickReview>("off")
    /* Everything but the target starts folded away (2026-09-20, user request):
       almost every game is "just deal", and eight rows of defaults made the
       dialog scroll on a phone before the create button came into view. */
    const [showMore, setShowMore] = useState(false)
    const quickGame = targetScore === 163
    // Keep the player's standard-game choices while quick play pins its rules.
    const effectiveNoDeclarations = quickGame || noDeclarations
    const effectiveAllowBela = quickGame || !noDeclarations || allowBela
    /* Phones get a bottom sheet (2026-10-08, owner, modelled on bela.fun): the
       create button lands under the thumb instead of mid-screen. */
    const sheet = useBreakpointValue({ base: true, md: false }) ?? false

    return (
        <Dialog.Root open={open} onOpenChange={(e) => onOpenChange(e.open)} placement={sheet ? "bottom" : "center"} scrollBehavior="inside">
            <Portal>
                <Dialog.Backdrop backdropFilter="blur(6px)" />
                <Dialog.Positioner px={sheet ? "0" : undefined} pb={sheet ? "0" : undefined}>
                    <Dialog.Content maxW={sheet ? "100%" : "480px"} w={sheet ? "100%" : undefined}
                        mb={sheet ? "0" : undefined} rounded={sheet ? undefined : "2xl"}
                        roundedTop={sheet ? "2xl" : undefined} roundedBottom={sheet ? "0" : undefined}
                        pb={sheet ? "var(--safe-bottom, 0px)" : undefined}>
                        <Dialog.Header pb="2" justifyContent="center">
                            <Dialog.Title fontSize="xl" fontFamily="heading" textAlign="center" w="100%">
                                {t("game.lobby.newGame")}
                            </Dialog.Title>
                        </Dialog.Header>
                        <Dialog.Body>
                            <VStack gap="3" align="stretch">
                                <VStack align="stretch" gap="1.5">
                                    <Text fontSize="sm" fontWeight="semibold">{t("game.lobby.form.target")}</Text>
                                    <HStack gap="2">
                                        {TARGETS.map((target) => (
                                            /* "Brza 163" is a WORD, not a number: at `lg` it
                                               filled the button edge to edge (2026-09-20, user
                                               report). It gets its own smaller size and the row
                                               keeps a little horizontal padding for all four, so
                                               no label can touch a border. */
                                            <Button key={target} flex="1" h="12" px="1"
                                                fontSize={target === 163 ? "sm" : "lg"} colorPalette="brand"
                                                fontFamily={target === 163 ? undefined : "mono"} fontVariantNumeric="tabular-nums"
                                                variant={targetScore === target ? "solid" : "outline"}
                                                aria-pressed={targetScore === target} disabled={busy} onClick={() => setTarget(target)}>
                                                {target === 163 ? t("game.create.quick.name") : target}
                                            </Button>
                                        ))}
                                    </HStack>
                                    {/* Every target has a description and both texts
                                        share one grid cell, the hidden one included, so
                                        the box is always as tall as the longer of them:
                                        picking "Brza 163" used to grow the dialog and
                                        shift everything under the finger (2026-10-08). */}
                                    <Box display="grid" px="3" py="2" rounded="lg"
                                        bg="bg.subtle" borderWidth="1px" borderColor="border.subtle">
                                        {([true, false] as const).map((quick) => (
                                            <VStack key={String(quick)} align="stretch" gap="0.5" gridArea="1 / 1"
                                                visibility={quick === quickGame ? "visible" : "hidden"}
                                                aria-hidden={quick !== quickGame}>
                                                <Text fontSize="sm" fontWeight="semibold">
                                                    {t(quick ? "game.create.quick.title" : "game.create.standard.title")}
                                                </Text>
                                                <Text fontSize="sm" lineHeight="1.45" color="fg">
                                                    {quick
                                                        ? t("game.create.quick.description")
                                                        : t("game.create.standard.description", { target: quickGame ? 1001 : targetScore })}
                                                </Text>
                                            </VStack>
                                        ))}
                                    </Box>
                                </VStack>
                                {/* A full-width row with the same box metrics as the
                                    settings it opens, so it reads as their header
                                    rather than as a stray link (2026-09-20). */}
                                <Button variant="outline" w="100%" minH="44px" px="3" py="2" rounded="lg"
                                    bg="bg.subtle" borderWidth="1px" borderColor="border.subtle"
                                    fontSize="sm" fontWeight="semibold" justifyContent="space-between"
                                    disabled={busy} aria-expanded={showMore}
                                    onClick={() => setShowMore((v) => !v)}>
                                    {t("game.lobby.form.moreOptions")}
                                    {showMore ? <FiChevronUp /> : <FiChevronDown />}
                                </Button>
                                {showMore && (
                                    <VStack gap="3" align="stretch">
                                    {targetScore !== 163 && (
                                        <HStack gap="2" minH="44px" px="3" py="2" rounded="lg"
                                            bg="bg.subtle" borderWidth="1px" borderColor="border.subtle"
                                            justifyContent="space-between">
                                            <Text fontSize="sm" fontWeight="semibold" flex="1" minW="0">
                                                {t("game.lobby.form.endRule")}
                                            </Text>
                                            <HStack gap="1" flexShrink={0}>
                                                {GAME_END_RULES.map((value) => (
                                                    <Button key={value} size="xs" px="3" colorPalette="brand"
                                                        variant={gameEndRule === value ? "solid" : "outline"}
                                                        aria-pressed={gameEndRule === value} disabled={busy}
                                                        onClick={() => setGameEndRule(value)}>
                                                        {t(`game.lobby.form.endRule.${value}`)}
                                                    </Button>
                                                ))}
                                            </HStack>
                                        </HStack>
                                    )}
                                    <HStack gap="2" minH="44px" px="3" py="2" rounded="lg"
                                        bg="bg.subtle" borderWidth="1px" borderColor="border.subtle"
                                        justifyContent="space-between">
                                        <Text fontSize="sm" fontWeight="semibold" flex="1" minW="0">
                                            {t("game.lobby.form.minWinRate")}
                                        </Text>
                                        <NativeSelect.Root size="sm" w="116px" flexShrink={0} disabled={busy}>
                                            <NativeSelect.Field value={minWinRatePercent}
                                                aria-label={t("game.lobby.form.minWinRate")}
                                                onChange={(e) => setMinWinRatePercent(Number(e.target.value) as WinRateRequirement)}>
                                                {WIN_RATE_REQUIREMENTS.map((percent) => (
                                                    <option key={percent} value={percent}>
                                                        {percent === 0 ? t("game.lobby.form.minWinRateNone") : `${percent}%`}
                                                    </option>
                                                ))}
                                            </NativeSelect.Field>
                                            <NativeSelect.Indicator />
                                        </NativeSelect.Root>
                                    </HStack>
                                    {/* These are peer switches, so they share one visual group
                                        and the same spacing instead of reading as sections. */}
                                    <VStack align="stretch" gap="1.5">
                                        <GameOption compact label={t("game.room.privateGame")}
                                            checked={isPrivate} disabled={busy} onChange={setPrivate} />
                                        <GameOption compact label={t("game.room.allowSpectators")}
                                            checked={allowSpectators} disabled={busy} onChange={setAllowSpectators} />
                                        {/* Turning declarations back ON re-allows the
                                            bela — FIX 2026-09-08. Bela is only a
                                            separate choice inside a "bez zvanja"
                                            game; with declarations on it always
                                            counts, which is what the submit below
                                            has always SENT (`!noDeclarations ||
                                            allowBela`). The switch, though, kept
                                            the "off" it was left with and sat there
                                            disabled and dark, so the dialog showed
                                            one rule and the room got another.
                                            Resetting it here keeps the screen and
                                            the wire saying the same thing. */}
                                        <GameOption compact label={t("game.rules.noDeclarations")}
                                            checked={effectiveNoDeclarations} disabled={busy || quickGame}
                                            onChange={(next) => {
                                                setNoDeclarations(next)
                                                if (!next) setAllowBela(true)
                                            }} />
                                        <GameOption compact label={t("game.rules.allowBela")}
                                            checked={effectiveAllowBela} disabled={busy || quickGame || !noDeclarations} onChange={setAllowBela} />
                                        {/* ONE ROW, INSIDE the same group — the row is
                                        a peer of the switches, not a section after
                                        them, so it shares their gap and their box
                                        metrics (`minH="44px"`, same padding, same
                                        `bg.subtle` card). It used to sit outside the
                                        VStack, which gave it the group's own spacing
                                        above it and made one setting look like a
                                        heading. Like the switches above it — the
                                        three states used to sit under their own
                                        heading in full-width buttons, which made
                                        one setting three rows tall in a dialog the
                                        phone already scrolls. Label left, a compact
                                        three-way segment right; the segment's faces
                                        are short words and each carries the full
                                        sentence as its accessible name, so nothing
                                        is lost by shortening them. */}
                                    <HStack gap="2" minH="44px" px="3" py="2" rounded="lg"
                                        bg="bg.subtle" borderWidth="1px" borderColor="border.subtle"
                                        justifyContent="space-between">
                                        <Text fontSize="sm" fontWeight="semibold" flex="1" minW="0">
                                            {t("game.rules.trickReview")}
                                        </Text>
                                        <HStack gap="1" flexShrink={0}>
                                            {TRICK_REVIEWS.map((value) => (
                                                <Button key={value} size="xs" px="2" colorPalette="brand"
                                                    variant={trickReview === value ? "solid" : "outline"}
                                                    aria-pressed={trickReview === value} disabled={busy}
                                                    aria-label={t(`game.rules.trickReview.${value}`)}
                                                    title={t(`game.rules.trickReview.${value}`)}
                                                    onClick={() => setTrickReview(value)}>
                                                    {t(`game.rules.trickReviewShort.${value}`)}
                                                </Button>
                                            ))}
                                        </HStack>
                                        </HStack>
                                    </VStack>
                                    </VStack>
                                )}
                            </VStack>
                        </Dialog.Body>
                        <Dialog.Footer>
                            <Button variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>{t("game.common.cancel")}</Button>
                            <Button colorPalette="brand" size="lg" disabled={busy} flex={sheet ? "1" : undefined}
                                onClick={() => onCreate({ targetScore, gameEndRule: quickGame ? "prolaz" : gameEndRule, private: isPrivate, allowSpectators, noDeclarations: effectiveNoDeclarations, allowBela: effectiveAllowBela, trickReview, minWinRatePercent })}>
                                {t("game.lobby.newGame")} <FiArrowRight />
                            </Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    )
}
