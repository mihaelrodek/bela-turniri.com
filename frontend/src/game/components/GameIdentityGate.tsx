import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react"
import { Badge, Box, Button, Heading, HStack, Input, Text, VStack } from "@chakra-ui/react"
import { FiCheck } from "react-icons/fi"
import { Link, useLocation } from "react-router-dom"
import { useAuth } from "../../auth/authContextValue"
import { LIMITS, validatePlayerName } from "@bela/protocol"
import { useTranslation } from "../../i18n"
import AvatarPicker from "../../components/avatars/AvatarPicker"
import BelaAvatar from "../../components/avatars/BelaAvatar"
import { AVATAR_IDS, type AvatarId } from "../../components/avatars/avatarArt"
import { readGuest, saveGuest, subscribeGuestHydration, getGuestHydrationReady, type GuestIdentity } from "../hooks/guestIdentity"
import { PageLoading } from "../../components/SuitSpinner"
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion"

/* The landing card's row of five faces (2026-09-21, user request — second
   pass: NOT faces circling a centre, but five in a horizontal strip taking
   turns being the big one in the middle). Each face owns a slot −2…+2; every
   `STRIP_STEP_MS` the whole strip moves one place and the transition does the
   rest: the face arriving in the middle grows, the one leaving shrinks.

   SEVEN faces ride the strip, five are visible: the two outermost slots (±3)
   are transparent waiting places. A face leaving on the left fades out INTO
   −3 while the next one fades in FROM +3 in the same move, so the right-hand
   end is never empty (2026-09-21, reported: the first version hid the
   wrapping face for the whole move and the last place stood empty for it).
   The jump from −3 round to +3 happens at opacity 0, where nobody sees it. */
const STRIP_FACE = 92
const STRIP_STEP_MS = 2600
const STRIP_SLOTS: Record<number, { x: number; scale: number; opacity: number }> = {
    [-3]: { x: -162, scale: 0.3, opacity: 0 },
    [-2]: { x: -128, scale: 0.43, opacity: 1 },
    [-1]: { x: -80, scale: 0.57, opacity: 1 },
    0: { x: 0, scale: 1, opacity: 1 },
    1: { x: 80, scale: 0.57, opacity: 1 },
    2: { x: 128, scale: 0.43, opacity: 1 },
    3: { x: 162, scale: 0.3, opacity: 0 },
}

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
    // The first screen only asks WHO you are playing as (2026-09-21, user
    // request): a guest gets the name-and-face form, everybody else goes to
    // sign-in. Nothing about the form is shown until "guest" is chosen.
    const [choosingGuest, setChoosingGuest] = useState(false)
    // The seven faces of the landing strip (five visible at a time): the
    // visitor's own pick first, then six others. Fixed for the life of the page so the strip never reshuffles.
    const [strip] = useState<AvatarId[]>(() => [avatar, ...AVATAR_IDS.filter((id) => id !== avatar).slice(0, 6)])
    const [active, setActive] = useState(0)
    const reducedMotion = usePrefersReducedMotion()
    const stripRunning = !reducedMotion && !choosingGuest && !user && !guest
    useEffect(() => {
        if (!stripRunning) return
        const id = window.setInterval(() => setActive((current) => (current + 1) % strip.length), STRIP_STEP_MS)
        return () => window.clearInterval(id)
    }, [stripRunning, strip.length])
    if (loading || !hydrated) return <PageLoading />
    if (user || guest) return children
    if (!choosingGuest) {
        /* The front door (2026-09-21, user request: "da je jasnije da se može
           igrati bez računa"). Guest play is the PRIMARY action now — it used
           to be the outline button under a solid "Prijavi se", which read as
           "an account is required, and there is some lesser option". The face
           on top is the one already picked for this visitor (`avatar`), with
           four table-mates around it, so the page shows what sitting down
           looks like before anything is asked. */
        return <Box maxW="440px" mx="auto" py={{ base: "5", md: "10" }}>
            <VStack align="stretch" gap="5" p={{ base: "5", md: "6" }} rounded="2xl" bg="bg.panel" borderWidth="1px" borderColor="border.subtle" shadow="card">
                <Box position="relative" mx="auto" w="full" maxW="348px" h={`${STRIP_FACE + 14}px`} aria-hidden="true">
                    {strip.map((id, i) => {
                        // Slot of face `i` when face `active` is in the middle.
                        const raw = (((i - active) % strip.length) + strip.length) % strip.length
                        const slot = raw > 3 ? raw - strip.length : raw
                        const place = STRIP_SLOTS[slot] ?? STRIP_SLOTS[0]
                        const main = slot === 0
                        return (
                            <Box
                                key={id}
                                position="absolute"
                                top="0"
                                left="50%"
                                ml={`-${STRIP_FACE / 2}px`}
                                rounded="full"
                                borderWidth="3px"
                                borderColor={main ? "brand.solid" : "bg.panel"}
                                bg="bg.panel"
                                zIndex={4 - Math.abs(slot)}
                                opacity={place.opacity}
                                style={{ transform: `translateX(${place.x}px) scale(${place.scale})` }}
                                css={{
                                    transformOrigin: "50% 60%",
                                    transition: reducedMotion
                                        ? "none"
                                        : "transform 700ms cubic-bezier(0.22, 1, 0.36, 1), opacity 500ms ease, border-color 400ms ease",
                                }}
                            >
                                <BelaAvatar id={id} size={`${STRIP_FACE}px`} />
                            </Box>
                        )
                    })}
                    <Badge position="absolute" bottom="0" left="50%" transform="translateX(-50%)" zIndex={5} size="sm" variant="solid" colorPalette="brand" rounded="full">
                        {t("game.guest.youBadge")}
                    </Badge>
                </Box>
                <VStack gap="1.5" textAlign="center">
                    <Heading size="xl">{t("game.guest.heroTitle")}</Heading>
                    <Text color="fg.muted">{t("game.guest.heroSubtitle")}</Text>
                </VStack>
                <Button colorPalette="brand" size="xl" onClick={() => { setAvatar(strip[active] ?? avatar); setChoosingGuest(true) }}>
                    {t("game.guest.playNow")}
                </Button>
                <HStack justify="center" gap="4" wrap="wrap" fontSize="sm" color="fg.muted">
                    {(["noAccount", "free", "bots"] as const).map((perk) => (
                        <HStack key={perk} gap="1.5">
                            <Box color="brand.fg" display="inline-flex"><FiCheck /></Box>
                            <Text>{t(`game.guest.perk.${perk}`)}</Text>
                        </HStack>
                    ))}
                </HStack>
                <HStack gap="3" color="fg.subtle" fontSize="xs">
                    <Box flex="1" h="1px" bg="border.subtle" />
                    <Text>{t("game.guest.or")}</Text>
                    <Box flex="1" h="1px" bg="border.subtle" />
                </HStack>
                <VStack align="stretch" gap="2">
                    <Button asChild variant="outline" size="lg"><Link to="/prijava" state={{ from: location }}>{t("game.guest.loginOrRegister")}</Link></Button>
                    <Text fontSize="sm" color="fg.muted" textAlign="center">{t("game.guest.statsHint")}</Text>
                </VStack>
            </VStack>
        </Box>
    }
    // Client-side hint only — the server (`ws.ts`/`auth.ts`) is the
    // authoritative check and rejects the `hello` if this is ever bypassed.
    // Blank/whitespace-only never shows the error text: that state is already
    // covered by the plain "required" disabled button, same as before this
    // check existed.
    const validation = validatePlayerName(name)
    const offensive = validation.ok === false && validation.reason === "OFFENSIVE"
    return <Box maxW="420px" mx="auto" py="8">
        <form onSubmit={(e) => { e.preventDefault(); if (validation.ok) setSavedGuest(saveGuest(validation.name, avatar)) }}>
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
                {offensive && <Text fontSize="sm" color="fg.error">{t("game.guest.nameOffensive")}</Text>}
                <Button type="submit" colorPalette="brand" disabled={!validation.ok}>{t("game.guest.play")}</Button>
                <Button variant="ghost" size="sm" onClick={() => setChoosingGuest(false)}>{t("game.guest.back")}</Button>
            </VStack>
        </form>
    </Box>
}
