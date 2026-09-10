import { useState, type ReactNode } from "react"
import { Box, Button, Heading, Input, Spinner, Text, VStack } from "@chakra-ui/react"
import { Link, useLocation } from "react-router-dom"
import { useAuth } from "../../auth/authContextValue"
import { LIMITS } from "@bela/protocol"
import { useTranslation } from "../../i18n"
import { readGuest, saveGuest } from "../hooks/guestIdentity"

export default function GameIdentityGate({ children }: { children: ReactNode }) {
    const { user, loading } = useAuth()
    const { t } = useTranslation()
    const location = useLocation()
    const [guest, setGuest] = useState(readGuest)
    const [name, setName] = useState("")
    if (loading) return <Spinner />
    if (user || guest) return children
    return <Box maxW="420px" mx="auto" py="8">
        <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) setGuest(saveGuest(name)) }}>
            <VStack align="stretch" gap="4" p="5" rounded="xl" bg="bg.panel" borderWidth="1px" borderColor="border.subtle">
                <Heading size="lg">{t("game.guest.title")}</Heading>
                <Text fontSize="sm" color="fg.muted">{t("game.guest.nameHint")}</Text>
                <Input aria-label={t("game.guest.name")} placeholder={t("game.guest.name")} value={name} maxLength={LIMITS.playerNameMax} autoComplete="nickname" onChange={(e) => setName(e.target.value)} required />
                <Button type="submit" colorPalette="brand" disabled={!name.trim()}>{t("game.guest.play")}</Button>
                <Text fontSize="sm" color="fg.muted">{t("game.guest.statsHint")}</Text>
                <Button asChild variant="outline"><Link to="/prijava" state={{ from: location }}>{t("game.guest.login")}</Link></Button>
            </VStack>
        </form>
    </Box>
}
