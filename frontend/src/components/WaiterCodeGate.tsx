import { useCallback, useEffect, useRef, useState } from "react"
import { Box, Button, chakra, Flex, Heading, Input, Text, VStack } from "@chakra-ui/react"
import { useSearchParams } from "react-router-dom"
import { FiKey } from "react-icons/fi"
import { waiterErrorText } from "../api/waiterAccess"
import { useWaiterSession } from "../hooks/useWaiterSession"
/* `tStatic` in `submit`, so that callback keeps a stable identity and the
   auto-submit effect below is not rebuilt on every render; `useTranslation`
   for the rendered copy, which must follow a language switch. */
import { t as tStatic, useTranslation } from "../i18n"

/* ──────────────────────────────────────────────────────────────────────────
   WaiterCodeGate — the four letters between a phone and the bill list.

   Shown in place of the Računi section to anyone who is neither the
   organiser nor already holding a session for this tournament. On success
   the session hook notifies every subscriber, so the page's authorised
   branch takes over in the same commit — no reload, no re-navigation.

   THE `?kod=` LINK
   ────────────────
   Dictating four letters across a loud hall is exactly the moment an
   organiser gives up on a feature, so the code panel also produces a
   clickable link: `/turniri/{ref}/racuni?kod=ABCD`. This component reads
   that parameter on mount, fills the field with it and submits ONCE.

   "Once" is the whole trick: the redeem is what turns the gate into the
   list, so a failed auto-submit leaves the gate mounted with the same URL
   still carrying the same bad code. Without `autoSubmittedRef` the effect
   would fire again on the re-render the error state caused, and the page
   would sit in a redeem loop against the backend. After the one attempt the
   code stays in the field so the reader can see what was wrong with it and
   fix a typo by hand.

   The error is rendered inline, under the field, rather than as a toast:
   this is a form with exactly one input, and a message about that input
   belongs beside it — a toast floats away from the thing it is about, and
   on a phone it covers the keyboard.
   ────────────────────────────────────────────────────────────────────── */

/** Length of a waiter code. The backend mints exactly four letters. */
const CODE_LENGTH = 4

/** Keep the field to the shape a code can actually have. */
function sanitizeCode(raw: string): string {
    return raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, CODE_LENGTH)
}

export default function WaiterCodeGate({
    tournamentUuid,
    onSuccess,
}: {
    tournamentUuid: string
    /** Fired after the token is stored. The page re-renders on its own. */
    onSuccess?: () => void
}) {
    const { t } = useTranslation()
    const { redeem } = useWaiterSession(tournamentUuid)
    const [searchParams, setSearchParams] = useSearchParams()

    const [code, setCode] = useState("")
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // `onSuccess` is usually an inline arrow from the page, so it is a new
    // function on every render; mirroring it keeps `submit` — and therefore
    // the auto-submit effect below — from being rebuilt for that reason.
    const onSuccessRef = useRef(onSuccess)
    onSuccessRef.current = onSuccess

    const submit = useCallback(async (raw: string) => {
        const value = sanitizeCode(raw)
        if (value.length !== CODE_LENGTH) return
        setBusy(true)
        setError(null)
        try {
            await redeem(value)
            onSuccessRef.current?.()
        } catch (e) {
            // `redeemWaiterCode` is silent, so nothing else will surface this.
            // A 400 on that endpoint always means "wrong code", and its
            // message already arrives in the reader's language.
            setError(waiterErrorText(e, tStatic("tournament.waiter.gate.invalid")))
        } finally {
            setBusy(false)
        }
    }, [redeem])

    /* Auto-submit from `?kod=`, at most once per mount — see the note above. */
    const autoSubmittedRef = useRef(false)
    useEffect(() => {
        if (autoSubmittedRef.current) return
        const fromUrl = sanitizeCode(searchParams.get("kod") ?? "")
        if (fromUrl.length !== CODE_LENGTH) return
        autoSubmittedRef.current = true
        setCode(fromUrl)
        // Take the code OUT of the address bar now that the field owns it.
        // The page's `setTab` carries `location.search` into every section it
        // navigates to, so a code left in the URL would trail through the
        // whole visit — and end up in any screenshot of any section. Replace,
        // not push, so Back still leaves the tournament.
        const next = new URLSearchParams(searchParams)
        next.delete("kod")
        setSearchParams(next, { replace: true })
        void submit(fromUrl)
    }, [searchParams, setSearchParams, submit])

    const ready = code.length === CODE_LENGTH && !busy

    return (
        <Flex justify="center" py={{ base: "6", md: "10" }} px="0">
            <Box
                w="full"
                maxW="sm"
                bg="bg.panel"
                borderWidth="1px"
                borderColor="border.subtle"
                rounded="xl"
                shadow="card"
                p={{ base: "5", md: "6" }}
            >
                <VStack gap="4" align="stretch">
                    <VStack gap="2" align="center" textAlign="center">
                        <Flex
                            align="center"
                            justify="center"
                            boxSize="12"
                            rounded="2xl"
                            bg="brand.subtle"
                            color="brand.fg"
                        >
                            <FiKey size={22} />
                        </Flex>
                        <Heading size="md" color="fg.ink">
                            {t("tournament.waiter.gate.title")}
                        </Heading>
                        <Text fontSize="sm" color="fg.muted">
                            {t("tournament.waiter.gate.description")}
                        </Text>
                    </VStack>

                    <Box>
                        <chakra.label
                            htmlFor="waiter-code-input"
                            fontSize="2xs"
                            fontWeight="semibold"
                            color="fg.muted"
                            letterSpacing="wider"
                            textTransform="uppercase"
                            mb="1.5"
                            display="block"
                        >
                            {t("tournament.waiter.gate.codeLabel")}
                        </chakra.label>
                        <Input
                            id="waiter-code-input"
                            value={code}
                            onChange={(e) => {
                                setCode(sanitizeCode(e.target.value))
                                // Clear a previous failure the moment the
                                // reader starts fixing it.
                                setError(null)
                            }}
                            onKeyDown={(e) => {
                                if (e.key !== "Enter") return
                                e.preventDefault()
                                if (ready) void submit(code)
                            }}
                            maxLength={CODE_LENGTH}
                            placeholder={t("tournament.waiter.gate.placeholder")}
                            // Same mono, wide-tracked treatment the QR dialog
                            // gives the share URL — a short machine string
                            // read out loud one character at a time.
                            fontFamily="mono"
                            fontSize="2xl"
                            fontWeight="bold"
                            letterSpacing="0.4em"
                            // The tracking is applied AFTER the last glyph too,
                            // so a centred value sits visibly left of centre
                            // without paying that space back.
                            textIndent="0.4em"
                            textAlign="center"
                            size="lg"
                            autoComplete="off"
                            autoCapitalize="characters"
                            autoCorrect="off"
                            spellCheck={false}
                            enterKeyHint="go"
                            disabled={busy}
                            aria-invalid={error !== null}
                            aria-describedby={error ? "waiter-code-error" : undefined}
                        />
                        {error && (
                            <Text
                                id="waiter-code-error"
                                role="alert"
                                fontSize="sm"
                                color="red.fg"
                                mt="2"
                            >
                                {error}
                            </Text>
                        )}
                    </Box>

                    <Button
                        colorPalette="blue"
                        w="full"
                        loading={busy}
                        disabled={!ready}
                        onClick={() => void submit(code)}
                    >
                        {t("tournament.waiter.gate.submit")}
                    </Button>
                </VStack>
            </Box>
        </Flex>
    )
}
