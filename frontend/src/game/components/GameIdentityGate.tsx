import { useState, useSyncExternalStore, type ReactNode } from "react"
import { Box, Button, Heading, HStack, Input, Spinner, Text, VStack } from "@chakra-ui/react"
import { Link, useLocation } from "react-router-dom"
import { useAuth } from "../../auth/authContextValue"
import { LIMITS } from "@bela/protocol"
import { useTranslation } from "../../i18n"
import AvatarPicker from "../../components/avatars/AvatarPicker"
import BelaAvatar from "../../components/avatars/BelaAvatar"
import { AVATAR_IDS, type AvatarId } from "../../components/avatars/avatarArt"
import { readGuest, saveGuest, subscribeGuestHydration, getGuestHydrationReady, type GuestIdentity } from "../hooks/guestIdentity"

/** A face to start from, so nobody ever looks at an empty slot. Random rather
 *  than fixed: the first preset would otherwise be what half the tables wear. */
function randomAvatar(): AvatarId {
    return AVATAR_IDS[Math.floor(Math.random() * AVATAR_IDS.length)] ?? AVATAR_IDS[0]
}

export default function GameIdentityGate({ children }: { children: ReactNode }) {
    const { user, loading } = useAuth()
    const { t } = useTranslation()
    const location = useLocation()
    // On web this is true from the first render (nothing to hydrate); natively
    // it flips once `NativeShell` finishes restoring the guest record from the
    // Preferences mirror, so a reinstalled/relaunched app doesn't flash the
    // "type a name" form before its old identity has had a chance to load.
    const hydrated = useSyncExternalStore(subscribeGuestHydration, getGuestHydrationReady)
    // Not `useState(readGuest)`: that initializer only runs once, at the
    // pre-hydration mount, and would freeze `guest` at null forever on
    // native. `savedGuest` only tracks the post-form-submit case; before that
    // the record comes straight from `readGuest()`, re-evaluated on every
    // render — including the one hydration triggers when it flips `hydrated`.
    const [savedGuest, setSavedGuest] = useState<GuestIdentity | null>(null)
    const guest = savedGuest ?? (hydrated ? readGuest() : null)
    const [name, setName] = useState("")
    // Pre-picked on the FIRST render (the initializer runs once), so the face
    // above the name field is never an empty circle and a guest who never
    // touches the grid still sits down as somebody.
    const [avatar, setAvatar] = useState<AvatarId>(randomAvatar)
    if (loading || !hydrated) return <Spinner />
    if (user || guest) return children
    return <Box maxW="420px" mx="auto" py="8">
        <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) setSavedGuest(saveGuest(name, avatar)) }}>
            <VStack align="stretch" gap="4" p="5" rounded="xl" bg="bg.panel" borderWidth="1px" borderColor="border.subtle">
                <Heading size="lg">{t("game.guest.title")}</Heading>
                <Text fontSize="sm" color="fg.muted">{t("game.guest.nameHint")}</Text>
                {/* Face first, then name: it is the picked one, big, so the
                    grid below reads as "choose this" rather than "here are
                    sixteen unrelated buttons". */}
                <HStack gap="3" align="center">
                    <BelaAvatar id={avatar} size="64px" />
                    <Text fontSize="sm" color="fg.muted">{t("game.guest.avatarHint")}</Text>
                </HStack>
                <AvatarPicker value={avatar} onChange={setAvatar} size="44px" label={t("game.guest.avatar")} />
                <Input aria-label={t("game.guest.name")} placeholder={t("game.guest.name")} value={name} maxLength={LIMITS.playerNameMax} autoComplete="nickname" onChange={(e) => setName(e.target.value)} required />
                <Button type="submit" colorPalette="brand" disabled={!name.trim()}>{t("game.guest.play")}</Button>
                <Text fontSize="sm" color="fg.muted">{t("game.guest.statsHint")}</Text>
                <Button asChild variant="outline"><Link to="/prijava" state={{ from: location }}>{t("game.guest.login")}</Link></Button>
            </VStack>
        </form>
    </Box>
}
