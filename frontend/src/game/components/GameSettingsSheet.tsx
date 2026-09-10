import { useEffect, useState } from "react"
import { Button, Dialog, HStack, Input, Portal, Separator, Text, VStack } from "@chakra-ui/react"
import { LIMITS, TRICK_REVIEWS } from "@bela/protocol"
import type { ClientMessage, RoomState, TargetScore } from "@bela/protocol"
import { useTranslation } from "../../i18n"
import { formatDate } from "../../utils/format"
import { useGamePrefs } from "../hooks/useGamePrefs"
import { useGameSocket } from "../hooks/useGameSocket"
import { readGuest, saveGuest } from "../hooks/guestIdentity"
import PlayingCard from "./PlayingCard"
import GameOption from "./GameOption"

/**
 * "Ime za igru" — the name this player wears at the card table, which is a
 * DIFFERENT thing from their account name (2026-09-09, user request).
 *
 * The write goes over the game socket (`profile.setName`) rather than the REST
 * API because a guest has no bearer token: their identity is the uid the game
 * server derived from their browser's secret, and that uid is what the
 * once-a-week limit is measured against. So the same control serves both, and
 * a guest who clears their browser name still cannot rename themselves early.
 *
 * The limit belongs to the backend, which owns the clock. This only ever
 * REPORTS it: `profile.name` carries the instant the name may next change,
 * and it arrives on a refusal too, precisely so the screen can name a date
 * instead of saying "no".
 */
function GameNameSetting() {
    const { t } = useTranslation()
    // Passive: the lobby and the room already hold the connection open, and a
    // settings sheet must never be the reason a socket exists.
    const { me, gameName, gameNameNextChangeAt, error, send, clearError } = useGameSocket({ passive: true })
    const current = gameName ?? me?.name ?? ""
    const [draft, setDraft] = useState(current)
    const [sent, setSent] = useState(false)

    // Follow the server whenever it renames us — including the rename we just
    // asked for, and the one another tab asked for.
    useEffect(() => { setDraft(current) }, [current])

    const limited = error?.code === "NAME_RATE_LIMITED"
    const trimmed = draft.trim()
    const changed = trimmed.length > 0 && trimmed !== current
    // `gameNameNextChangeAt` is only in the past once a change has landed, so a
    // player who has never renamed themselves sees no deadline at all.
    const blocked = gameNameNextChangeAt !== null && gameNameNextChangeAt > Date.now()

    function save() {
        if (!changed || blocked) return
        clearError()
        setSent(true)
        send({ t: "profile.setName", name: trimmed })
        // A guest's next `hello` carries the browser's copy; keep it in step so
        // the seat does not flash the old name on a reconnect. (The server's
        // stored name wins either way — this only avoids the flicker.)
        if (readGuest()) saveGuest(trimmed)
    }

    return (
        <VStack align="stretch" gap="1.5">
            <Text fontSize="sm" fontWeight="semibold">{t("game.settings.gameName")}</Text>
            <HStack gap="2">
                <Input flex="1" size="sm" value={draft} maxLength={LIMITS.playerNameMax}
                    autoComplete="nickname" disabled={blocked}
                    aria-label={t("game.settings.gameName")}
                    placeholder={t("game.settings.gameName")}
                    onChange={(e) => { setSent(false); setDraft(e.target.value) }}
                    onKeyDown={(e) => { if (e.key === "Enter") save() }} />
                <Button size="sm" colorPalette="brand" disabled={!changed || blocked} onClick={save}>
                    {t("game.common.save")}
                </Button>
            </HStack>
            <Text fontSize="xs" color={limited ? "fg.error" : "fg.muted"}>
                {blocked
                    ? t("game.settings.gameNameNext", { date: formatDate(new Date(gameNameNextChangeAt).toISOString()) })
                    : sent && !changed
                        ? t("game.settings.gameNameSaved")
                        : t("game.settings.gameNameHint")}
            </Text>
        </VStack>
    )
}

/** What `room.setOptions` carries, minus the tag. */
export type RoomOptionsPatch = Omit<Extract<ClientMessage, { t: "room.setOptions" }>, "t">

const TARGETS: readonly TargetScore[] = [501, 701, 1001]

/**
 * THIS GAME'S settings, at the top of the sheet — 2026-09-09, user request.
 *
 * They were only ever choosable in "Nova igra", which meant a host who wanted
 * 701 instead of 1001 had to leave the room and make another one. They live
 * here now, above the app's own preferences, because that is the order the
 * questions arrive in: what are we playing, then how does my phone behave.
 *
 * Rendered only while the room is in the LOBBY and only for the host — once a
 * deal is running these are the rules it is being judged by, so the server
 * refuses them and the screen must not offer what the server will refuse.
 *
 * "Privatna igra" is NOT here on purpose: it has its own switch on the room
 * screen and its own message (`room.setPrivate`), and one flag with two
 * controls is how the two get out of step.
 */
function RoomSettings({ room, onChange }: {
    room: RoomState
    onChange: (patch: RoomOptionsPatch) => void
}) {
    const { t } = useTranslation()
    return (
        <VStack gap="3" align="stretch">
            <Text fontSize="sm" fontWeight="semibold">{t("game.settings.thisGame")}</Text>

            <VStack align="stretch" gap="1.5">
                <Text fontSize="xs" color="fg.muted">{t("game.lobby.form.target")}</Text>
                <HStack gap="2">
                    {TARGETS.map((target) => (
                        <Button key={target} flex="1" h="10" colorPalette="brand"
                            variant={room.targetScore === target ? "solid" : "outline"}
                            aria-pressed={room.targetScore === target}
                            onClick={() => onChange({ targetScore: target })}>
                            {target}
                        </Button>
                    ))}
                </HStack>
            </VStack>

            <HStack gap="2" minH="44px" px="3" py="2" rounded="lg"
                bg="bg.subtle" borderWidth="1px" borderColor="border.subtle"
                justifyContent="space-between">
                <Text fontSize="sm" fontWeight="semibold" flex="1" minW="0">
                    {t("game.lobby.form.endRule")}
                </Text>
                <HStack gap="1" flexShrink={0}>
                    {(["prolaz", "dosta"] as const).map((rule) => (
                        <Button key={rule} size="xs" px="2" colorPalette="brand"
                            variant={room.gameEndRule === rule ? "solid" : "outline"}
                            aria-pressed={room.gameEndRule === rule}
                            onClick={() => onChange({ gameEndRule: rule })}>
                            {t(`game.lobby.form.endRule.${rule}`)}
                        </Button>
                    ))}
                </HStack>
            </HStack>

            <GameOption compact label={t("game.room.allowSpectators")}
                checked={room.allowSpectators}
                onChange={(allowSpectators) => onChange({ allowSpectators })} />
            {/* Turning declarations back ON re-allows the bela, exactly as the
                create dialog does — with declarations on it always counts, so
                the switch must not be left saying otherwise. */}
            <GameOption compact label={t("game.rules.noDeclarations")}
                checked={room.noDeclarations}
                onChange={(noDeclarations) =>
                    onChange(noDeclarations ? { noDeclarations } : { noDeclarations, allowBela: true })} />
            <GameOption compact label={t("game.rules.allowBela")}
                checked={room.allowBela} disabled={!room.noDeclarations}
                onChange={(allowBela) => onChange({ allowBela })} />

            <HStack gap="2" minH="44px" px="3" py="2" rounded="lg"
                bg="bg.subtle" borderWidth="1px" borderColor="border.subtle"
                justifyContent="space-between">
                <Text fontSize="sm" fontWeight="semibold" flex="1" minW="0">
                    {t("game.rules.trickReview")}
                </Text>
                <HStack gap="1" flexShrink={0}>
                    {TRICK_REVIEWS.map((value) => (
                        <Button key={value} size="xs" px="2" colorPalette="brand"
                            variant={room.trickReview === value ? "solid" : "outline"}
                            aria-pressed={room.trickReview === value}
                            aria-label={t(`game.rules.trickReview.${value}`)}
                            title={t(`game.rules.trickReview.${value}`)}
                            onClick={() => onChange({ trickReview: value })}>
                            {t(`game.rules.trickReviewShort.${value}`)}
                        </Button>
                    ))}
                </HStack>
            </HStack>

            <Separator my="1" />
        </VStack>
    )
}

export default function GameSettingsSheet({ open, onClose, room, isHost = false, onChangeOptions }: {
    open: boolean
    onClose: () => void
    /** The room being sat in, or absent on the lobby screen. */
    room?: RoomState | null
    /** Only the host may change the room's settings. */
    isHost?: boolean
    onChangeOptions?: (patch: RoomOptionsPatch) => void
}) {
    const { t } = useTranslation()
    const [prefs, setPrefs] = useGamePrefs()
    /* Once a deal is running these settings are the rules it is judged by, so
       the server refuses them — and a control that cannot work must not be on
       screen. */
    const canEditRoom =
        room != null && room.status !== "PLAYING" && isHost && onChangeOptions !== undefined
    return (
        <Dialog.Root open={open} onOpenChange={(e) => { if (!e.open) onClose() }} placement="center" scrollBehavior="inside">
            <Portal>
                <Dialog.Backdrop backdropFilter="blur(6px)" />
                <Dialog.Positioner>
                    <Dialog.Content maxW={{ base: "94%", md: "480px" }} rounded="2xl">
                        <Dialog.Header><Dialog.Title fontSize="2xl">{t("game.settings.title")}</Dialog.Title></Dialog.Header>
                        <Dialog.Body>
                            <VStack gap="3" align="stretch">
                                {canEditRoom ? (
                                    <RoomSettings room={room} onChange={onChangeOptions} />
                                ) : null}
                                <GameNameSetting />
                                <Separator my="1" />
                                <GameOption label={t("game.settings.alwaysReady")} hint={t("game.settings.alwaysReadyHint")}
                                    checked={prefs.alwaysReady} onChange={(alwaysReady) => setPrefs({ alwaysReady })} />
                                <GameOption label={t("game.settings.sound")} checked={prefs.sound} onChange={(sound) => setPrefs({ sound })} />
                                <GameOption label={t("game.settings.reduceMotion")} checked={prefs.reduceMotion} onChange={(reduceMotion) => setPrefs({ reduceMotion })} />
                                <Text fontSize="sm" fontWeight="semibold" mt="3">{t("game.settings.deckType")}</Text>
                                <HStack gap="3" align="stretch">
                                    {(["madjarice", "francuske"] as const).map((deck) => (
                                        <Button key={deck} flex="1" h="auto" py="4" flexDirection="column" gap="3" colorPalette="brand"
                                            variant={prefs.deck === deck ? "subtle" : "outline"} aria-pressed={prefs.deck === deck} onClick={() => setPrefs({ deck })}>
                                            <PlayingCard card="JHERC" size="sm" deck={deck} />
                                            {t(`game.settings.deck.${deck}`)}
                                        </Button>
                                    ))}
                                </HStack>
                            </VStack>
                        </Dialog.Body>
                        <Dialog.Footer><Button colorPalette="brand" onClick={onClose}>{t("game.common.close")}</Button></Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    )
}
