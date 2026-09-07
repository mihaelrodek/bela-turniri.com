import { useState } from "react"
import type { FormEvent } from "react"
import { Link as RouterLink } from "react-router-dom"
import {
    Box,
    Button,
    Card,
    Field,
    Heading,
    HStack,
    Input,
    Text,
    Textarea,
    VStack,
} from "@chakra-ui/react"
import { FiArrowLeft, FiCheckCircle } from "react-icons/fi"
import { useAuth } from "../auth/authContextValue"
import { useDocumentHead } from "../hooks/useDocumentHead"
import { submitContactMessage } from "../api/contact"
import { showError } from "../toaster"
import { useTranslation } from "../i18n"

/* ──────────────────────────────────────────────────────────────────────────
   ContactPage — "Kontaktiraj nas" (/kontakt).

   Fully public: anonymous visitors can send a message, and a signed-in
   user's name/email are prefilled from their Firebase account (still
   editable — someone may want to write from a different address).

   `submitContactMessage` is called with `silent: true` on the axios config
   (see api/contact.ts), so neither the shared success toast nor the shared
   error toast fires for this endpoint — the success state is an inline
   panel that replaces the form (it has to stay on screen after the click,
   unlike a toast), and errors get a message tailored to the status code
   (429 rate-limited vs. everything else) rather than a generic one.

   `website` is a honeypot field: real visitors never see it (visually
   hidden, unreachable by Tab, no autofill), so a filled-in value marks the
   submission as spam server-side. It always rides along as an empty string.
   ────────────────────────────────────────────────────────────────────── */

const NAME_MAX = 120
const SUBJECT_MAX = 160
const MESSAGE_MAX = 4000

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/

type SendState = "idle" | "sending" | "sent"

export default function ContactPage() {
    const { t } = useTranslation()
    const { user } = useAuth()

    useDocumentHead({
        title: t("pages.contact.seo.title"),
        description: t("pages.contact.seo.description"),
        ogTitle: t("pages.contact.seo.ogTitle"),
        ogDescription: t("pages.contact.seo.ogDescription"),
        ogType: "website",
        canonical: "https://bela-turniri.com/kontakt",
    })

    const [name, setName] = useState(user?.displayName ?? "")
    const [email, setEmail] = useState(user?.email ?? "")
    const [subject, setSubject] = useState("")
    const [message, setMessage] = useState("")
    // Honeypot — must stay empty. Never rendered with a real label/placeholder
    // so a screen reader has nothing useful to announce for it either.
    const [website, setWebsite] = useState("")
    const [state, setState] = useState<SendState>("idle")
    const [touched, setTouched] = useState(false)

    const trimmedName = name.trim()
    const trimmedEmail = email.trim()
    const trimmedMessage = message.trim()

    const nameOk = trimmedName.length > 0 && trimmedName.length <= NAME_MAX
    const emailOk = EMAIL_RE.test(trimmedEmail)
    const subjectOk = subject.trim().length <= SUBJECT_MAX
    const messageOk = trimmedMessage.length > 0 && trimmedMessage.length <= MESSAGE_MAX
    const canSubmit = nameOk && emailOk && subjectOk && messageOk

    async function onSubmit(e: FormEvent) {
        e.preventDefault()
        setTouched(true)
        if (!canSubmit || state === "sending") return

        try {
            setState("sending")
            const trimmedSubject = subject.trim()
            await submitContactMessage({
                name: trimmedName,
                email: trimmedEmail,
                ...(trimmedSubject ? { subject: trimmedSubject } : {}),
                message: trimmedMessage,
                website,
            })
            setState("sent")
        } catch (err: unknown) {
            const status = (err as { response?: { status?: number } })?.response?.status
            if (status === 429) {
                showError(t("pages.contact.error.rateLimited"))
            } else {
                showError(t("pages.contact.error.generic"))
            }
            setState("idle")
        }
    }

    return (
        <VStack align="stretch" gap="6" maxW="640px" mx="auto" py={{ base: "2", md: "4" }}>
            <Box>
                <Heading size="lg" mb="1">{t("pages.contact.title")}</Heading>
                <Text color="fg.muted" fontSize="sm">{t("pages.contact.intro")}</Text>
            </Box>

            <Card.Root variant="outline" rounded="xl" borderColor="border.emphasized" shadow="sm" bg="bg.panel">
                <Card.Body p={{ base: "4", md: "6" }}>
                    {state === "sent" ? (
                        <VStack align="center" gap="3" py="6" textAlign="center">
                            <Box color="green.fg" fontSize="2xl">
                                <FiCheckCircle />
                            </Box>
                            <Heading size="md">{t("pages.contact.success.title")}</Heading>
                            <Text color="fg.muted" fontSize="sm" maxW="420px">
                                {t("pages.contact.success.description")}
                            </Text>
                            <Button asChild variant="outline" size="sm" mt="2" minH="44px">
                                <RouterLink to="/turniri">
                                    <FiArrowLeft /> {t("pages.contact.success.backLink")}
                                </RouterLink>
                            </Button>
                        </VStack>
                    ) : (
                        <form onSubmit={onSubmit} noValidate>
                            <VStack align="stretch" gap="4">
                                <HStack gap="3" align="start" wrap="wrap">
                                    <Field.Root
                                        required
                                        flex="1"
                                        minW="200px"
                                        invalid={touched && !nameOk}
                                    >
                                        <Field.Label>
                                            {t("pages.contact.nameLabel")} <Field.RequiredIndicator />
                                        </Field.Label>
                                        <Input
                                            size="md"
                                            h="44px"
                                            value={name}
                                            maxLength={NAME_MAX}
                                            autoComplete="name"
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder={t("pages.contact.namePlaceholder")}
                                        />
                                        {touched && !nameOk && (
                                            <Field.ErrorText>{t("pages.contact.validation.nameRequired")}</Field.ErrorText>
                                        )}
                                    </Field.Root>
                                    <Field.Root
                                        required
                                        flex="1"
                                        minW="200px"
                                        invalid={touched && !emailOk}
                                    >
                                        <Field.Label>
                                            {t("pages.contact.emailLabel")} <Field.RequiredIndicator />
                                        </Field.Label>
                                        <Input
                                            size="md"
                                            h="44px"
                                            type="email"
                                            value={email}
                                            maxLength={255}
                                            autoComplete="email"
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder={t("pages.contact.emailPlaceholder")}
                                        />
                                        {touched && !emailOk && (
                                            <Field.ErrorText>{t("pages.contact.validation.emailInvalid")}</Field.ErrorText>
                                        )}
                                    </Field.Root>
                                </HStack>

                                <Field.Root>
                                    <Field.Label>
                                        {t("pages.contact.subjectLabel")}{" "}
                                        <Box as="span" color="fg.muted" fontWeight="normal">
                                            {t("pages.contact.subjectOptional")}
                                        </Box>
                                    </Field.Label>
                                    <Input
                                        size="md"
                                        h="44px"
                                        value={subject}
                                        maxLength={SUBJECT_MAX}
                                        onChange={(e) => setSubject(e.target.value)}
                                        placeholder={t("pages.contact.subjectPlaceholder")}
                                    />
                                </Field.Root>

                                <Field.Root required invalid={touched && !messageOk}>
                                    <Field.Label>
                                        {t("pages.contact.messageLabel")} <Field.RequiredIndicator />
                                    </Field.Label>
                                    <Textarea
                                        value={message}
                                        maxLength={MESSAGE_MAX}
                                        minH="140px"
                                        onChange={(e) => setMessage(e.target.value)}
                                        placeholder={t("pages.contact.messagePlaceholder")}
                                    />
                                    {touched && !messageOk && (
                                        <Field.ErrorText>{t("pages.contact.validation.messageRequired")}</Field.ErrorText>
                                    )}
                                </Field.Root>

                                {/* Honeypot — visually hidden, unreachable by keyboard
                                    or screen reader, no autofill. A bot filling every
                                    field it finds is the only thing that ever
                                    populates this. */}
                                <Box
                                    position="absolute"
                                    left="-9999px"
                                    top="auto"
                                    width="1px"
                                    height="1px"
                                    overflow="hidden"
                                    aria-hidden="true"
                                >
                                    <Input
                                        tabIndex={-1}
                                        autoComplete="off"
                                        value={website}
                                        onChange={(e) => setWebsite(e.target.value)}
                                        name="website"
                                    />
                                </Box>

                                <Button
                                    type="submit"
                                    variant="solid"
                                    colorPalette="blue"
                                    loading={state === "sending"}
                                    loadingText={t("pages.contact.sending")}
                                    minH="44px"
                                >
                                    {t("pages.contact.submit")}
                                </Button>
                            </VStack>
                        </form>
                    )}
                </Card.Body>
            </Card.Root>
        </VStack>
    )
}
