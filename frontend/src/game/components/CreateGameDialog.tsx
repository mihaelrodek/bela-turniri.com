import { useState } from "react"
import { Button, Dialog, HStack, NativeSelect, Portal, Text, VStack } from "@chakra-ui/react"
import { FiArrowRight } from "react-icons/fi"
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

    return (
        <Dialog.Root open={open} onOpenChange={(e) => onOpenChange(e.open)} placement="center" scrollBehavior="inside">
            <Portal>
                <Dialog.Backdrop backdropFilter="blur(6px)" />
                <Dialog.Positioner>
                    <Dialog.Content maxW={{ base: "94%", md: "480px" }} rounded="2xl">
                        <Dialog.Header pb="2" justifyContent="center">
                            <Dialog.Title fontSize="xl" textAlign="center" w="100%">
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
                                                variant={targetScore === target ? "solid" : "outline"}
                                                aria-pressed={targetScore === target} disabled={busy} onClick={() => setTarget(target)}>
                                                {target === 163 ? t("game.create.quick.name") : target}
                                            </Button>
                                        ))}
                                    </HStack>
                                    {targetScore === 163 && (
                                        <VStack align="stretch" gap="0.5" px="2.5" py="1.5" rounded="lg"
                                            bg="bg.subtle" borderWidth="1px" borderColor="border.subtle">
                                            <Text fontSize="xs" fontWeight="semibold" color="fg.muted">
                                                {t("game.create.quick.title")}
                                            </Text>
                                            <Text fontSize="xs" lineHeight="1.35" color="fg.muted">
                                                {t("game.create.quick.description")}
                                            </Text>
                                        </VStack>
                                    )}
                                </VStack>
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
                                        checked={noDeclarations} disabled={busy}
                                        onChange={(next) => {
                                            setNoDeclarations(next)
                                            if (!next) setAllowBela(true)
                                        }} />
                                    <GameOption compact label={t("game.rules.allowBela")}
                                        checked={allowBela} disabled={busy || !noDeclarations} onChange={setAllowBela} />
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
                        </Dialog.Body>
                        <Dialog.Footer>
                            <Button variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>{t("game.common.cancel")}</Button>
                            <Button colorPalette="brand" size="lg" disabled={busy}
                                onClick={() => onCreate({ targetScore, gameEndRule: targetScore === 163 ? "prolaz" : gameEndRule, private: isPrivate, allowSpectators, noDeclarations, allowBela: !noDeclarations || allowBela, trickReview, minWinRatePercent })}>
                                {t("game.lobby.newGame")} <FiArrowRight />
                            </Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    )
}
