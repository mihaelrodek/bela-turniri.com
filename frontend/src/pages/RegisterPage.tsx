import React, { useEffect, useState } from "react"
import { Link as RouterLink, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import {
    Box,
    Button,
    Card,
    Field,
    Heading,
    HStack,
    Input,
    Text,
    VStack,
} from "@chakra-ui/react"
import { useAuth } from "../auth/authContextValue"
import { firebaseErrorCode, socialAuthErrorMessage } from "../auth/authErrors"
import { ConsentCheckbox } from "../components/auth/ConsentGate"
import { SocialAuthButtons } from "../components/auth/SocialAuthButtons"
import { nextFromState, pickSafeNext } from "../utils/safeNextPath"
import { t, useTranslation } from "../i18n"

function authErrorMessage(err: unknown): string {
    // Shared with LoginPage — cancellations and the social-provider codes are
    // identical on both screens; "" means "handled, stay silent".
    const social = socialAuthErrorMessage(err)
    if (social !== null) return social
    const code = firebaseErrorCode(err)
    switch (code) {
        case "auth/email-already-in-use":
            return t("forms.register.error.emailInUse")
        case "auth/invalid-email":
            return t("forms.auth.invalidEmail")
        case "auth/weak-password":
            return t("forms.register.error.weakPassword")
        default:
            return err instanceof Error ? err.message : t("forms.register.error.generic")
    }
}

export default function RegisterPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const [searchParams] = useSearchParams()
    const { signUp, signInWithGoogle, signInWithApple, user, loading: authLoading } = useAuth()
    const { t } = useTranslation()

    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [confirm, setConfirm] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    // The Terms of Service require 16+, and every path on this page creates an
    // account — email/password AND the two social buttons — so all three are
    // gated on the same checkbox rather than only the form's submit.
    const [consent, setConsent] = useState(false)

    // Honour ?next= from the URL (claim-name flow uses it), then the
    // navigation-state hint, then the default home for tournaments. Both
    // inputs are attacker-controllable, so pickSafeNext rejects anything that
    // isn't a plain same-origin path (see utils/safeNextPath.ts).
    const redirectTo = pickSafeNext(
        [searchParams.get("next"), nextFromState(location.state)],
        "/turniri",
    )

    /**
     * If the user is already signed in, /register has nothing to do —
     * bounce them to the redirect target with {replace} so the back
     * button doesn't loop here.
     */
    useEffect(() => {
        if (!authLoading && user?.uid) {
            navigate(redirectTo, { replace: true })
        }
    }, [authLoading, user?.uid, redirectTo, navigate])

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        if (!consent) {
            setError(t("forms.auth.consent.required"))
            return
        }
        if (!email.trim() || !password) {
            setError(t("forms.register.validation.required"))
            return
        }
        if (password.length < 6) {
            setError(t("forms.register.validation.weakPassword"))
            return
        }
        if (password !== confirm) {
            setError(t("forms.register.validation.passwordMismatch"))
            return
        }
        try {
            setSubmitting(true)
            await signUp(email.trim(), password, name.trim() || undefined)
            navigate(redirectTo, { replace: true })
        } catch (e: unknown) {
            const msg = authErrorMessage(e)
            if (msg) setError(msg)
        } finally {
            setSubmitting(false)
        }
    }

    /** Both social buttons share one flow — only the provider call differs. */
    async function onSocial(run: () => Promise<void>) {
        setError(null)
        // Belt and braces: the buttons are already disabled without consent,
        // but a social sign-in creates the account outright, so never start
        // one on an unchecked box.
        if (!consent) {
            setError(t("forms.auth.consent.required"))
            return
        }
        try {
            await run()
            navigate(redirectTo, { replace: true })
        } catch (e: unknown) {
            const msg = authErrorMessage(e)
            if (msg) setError(msg)
        }
    }

    return (
        <Box maxW="420px" mx="auto" mt={{ base: "4", md: "10" }}>
            <Card.Root variant="outline" rounded="xl" borderColor="border.emphasized" shadow="sm">
                <Card.Body p={{ base: "5", md: "6" }}>
                    <VStack align="stretch" gap="4">
                        <Heading size="md">{t("forms.register.heading")}</Heading>

                        <ConsentCheckbox checked={consent} onChange={setConsent} />

                        <SocialAuthButtons
                            googleLabel={t("forms.register.googleButton")}
                            appleLabel={t("forms.register.appleButton")}
                            onGoogle={() => onSocial(signInWithGoogle)}
                            onApple={() => onSocial(signInWithApple)}
                            disabled={submitting || !consent}
                        />

                        <HStack>
                            <Box flex="1" h="1px" bg="border.subtle" />
                            <Text fontSize="xs" color="fg.muted">{t("forms.auth.orDivider")}</Text>
                            <Box flex="1" h="1px" bg="border.subtle" />
                        </HStack>

                        <form onSubmit={onSubmit}>
                            <VStack align="stretch" gap="3">
                                <Field.Root>
                                    <Field.Label>{t("forms.register.nameLabel")} <Box as="span" color="fg.muted" fontSize="xs">{t("forms.register.nameOptional")}</Box></Field.Label>
                                    <Input
                                        autoComplete="name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder={t("forms.register.namePlaceholder")}
                                    />
                                </Field.Root>
                                <Field.Root required>
                                    <Field.Label>{t("forms.auth.email")}</Field.Label>
                                    <Input
                                        type="email"
                                        autoComplete="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </Field.Root>
                                <Field.Root required>
                                    <Field.Label>{t("forms.auth.password")}</Field.Label>
                                    <Input
                                        type="password"
                                        autoComplete="new-password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                    <Field.HelperText>{t("forms.register.passwordHelper")}</Field.HelperText>
                                </Field.Root>
                                <Field.Root required>
                                    <Field.Label>{t("forms.register.confirmPasswordLabel")}</Field.Label>
                                    <Input
                                        type="password"
                                        autoComplete="new-password"
                                        value={confirm}
                                        onChange={(e) => setConfirm(e.target.value)}
                                    />
                                </Field.Root>

                                {error && (
                                    <Box borderWidth="1px" borderColor="red.muted" bg="red.subtle" rounded="md" p="2">
                                        <Text fontSize="sm" color="red.fg">{error}</Text>
                                    </Box>
                                )}

                                <Button
                                    type="submit"
                                    variant="solid"
                                    colorPalette="blue"
                                    loading={submitting}
                                    disabled={submitting || !consent}
                                >
                                    {t("forms.register.submit")}
                                </Button>
                            </VStack>
                        </form>

                        <Text fontSize="sm" color="fg.muted" textAlign="center">
                            {t("forms.register.hasAccount")}{" "}
                            <Box as="span" color="blue.fg" fontWeight="medium">
                                <RouterLink to="/prijava">{t("forms.register.loginLink")}</RouterLink>
                            </Box>
                        </Text>
                    </VStack>
                </Card.Body>
            </Card.Root>
        </Box>
    )
}
