import React, { useEffect, useState } from "react"
import { Link as RouterLink, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import {
    Box,
    Button,
    Field,
    Heading,
    HStack,
    IconButton,
    Image,
    Input,
    InputGroup,
    Stack,
    Text,
    VStack,
} from "@chakra-ui/react"
import { FiEye, FiEyeOff } from "react-icons/fi"
import { loadFirebaseAuth } from "../firebase"
import { useAuth } from "../auth/authContextValue"
import { firebaseErrorCode, socialAuthErrorMessage } from "../auth/authErrors"
import { normalizeEmail, validateEmail } from "../auth/validation"
import { ConsentNotice } from "../components/auth/ConsentGate"
import { SocialAuthButtons } from "../components/auth/SocialAuthButtons"
import { nextFromState, pickSafeNext } from "../utils/safeNextPath"
import { t, useTranslation } from "../i18n"
import { brand, homePath, siteName } from "../site"

/** Translate Firebase auth error codes into user-friendly messages. */
function authErrorMessage(err: unknown): string {
    // Cancellations and the Google/Apple-specific codes are the same on both
    // auth pages, so they live in one place; "" means "handled, stay silent".
    const social = socialAuthErrorMessage(err)
    if (social !== null) return social
    const code = firebaseErrorCode(err)
    switch (code) {
        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
            return t("forms.login.error.invalidCredential")
        case "auth/invalid-email":
            return t("forms.auth.invalidEmail")
        case "auth/user-disabled":
            return t("forms.login.error.userDisabled")
        case "auth/too-many-requests":
            return t("forms.login.error.tooManyRequests")
        default:
            return err instanceof Error ? err.message : t("forms.login.error.generic")
    }
}

export default function LoginPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const [searchParams] = useSearchParams()
    const { signIn, signInWithGoogle, signInWithApple, user, loading: authLoading } = useAuth()
    const { t } = useTranslation()

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [resetMsg, setResetMsg] = useState<string | null>(null)
    // Set once the user has tried to submit; from then on the two fields show
    // their own inline error instead of the old combined banner message —
    // same pattern as ContactPage.tsx.
    const [touched, setTouched] = useState(false)

    const emailResult = validateEmail(email)
    const passwordMissing = password.length === 0

    // Where to send the user after a successful sign-in. Accepts a
    // ?next=/path query param (RequireAuth, the axios 401 interceptor and the
    // claim-name share flow all emit it) and falls back to whatever the
    // navigation state carried. Both are attacker-controllable inputs, so
    // pickSafeNext rejects anything that isn't a plain same-origin path —
    // otherwise ?next=//evil.tld would bounce a freshly-authenticated user
    // onto a phishing origin.
    const redirectTo = pickSafeNext(
        [searchParams.get("next"), nextFromState(location.state)],
        homePath,
    )

    /**
     * If the user is already authenticated, /login has nothing to do —
     * send them straight to the redirect target. Use {replace} so the
     * browser back button doesn't bounce them back to /login.
     */
    useEffect(() => {
        if (!authLoading && user?.uid) {
            navigate(redirectTo, { replace: true })
        }
    }, [authLoading, user?.uid, redirectTo, navigate])

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setResetMsg(null)
        setTouched(true)
        if (!emailResult.ok || passwordMissing) return
        try {
            setSubmitting(true)
            await signIn(normalizeEmail(email), password)
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
        setResetMsg(null)
        try {
            await run()
            navigate(redirectTo, { replace: true })
        } catch (e: unknown) {
            const msg = authErrorMessage(e)
            if (msg) setError(msg)
        }
    }

    async function onResetPassword() {
        setError(null)
        setResetMsg(null)
        const trimmed = normalizeEmail(email)
        if (!trimmed) {
            setError(t("forms.login.validation.emailForReset"))
            return
        }
        try {
            const fb = await loadFirebaseAuth()
            await fb.sendPasswordResetEmail(fb.auth, trimmed)
            setResetMsg(t("forms.login.resetSent"))
        } catch (e: unknown) {
            setError(authErrorMessage(e))
        }
    }

    return (
        <Box maxW="440px" mx="auto" px={{ base: "4", md: "0" }} py={{ base: "6", md: "10" }}>
            <VStack
                align="stretch"
                gap="5"
                p={{ base: "5", md: "6" }}
                rounded="2xl"
                bg="bg.panel"
                borderWidth="1px"
                borderColor="border.subtle"
                shadow="card"
            >
                <VStack gap="2" textAlign="center">
                    <Image src={brand.symbolSvg} alt={siteName} boxSize="44px" mx="auto" draggable={false} />
                    <Heading size="xl">{t("forms.login.heading")}</Heading>
                    <Text color="fg.muted" fontSize="sm">{t("forms.login.subtitle")}</Text>
                </VStack>

                <SocialAuthButtons
                    googleLabel={t("forms.login.googleButton")}
                    appleLabel={t("forms.login.appleButton")}
                    onGoogle={() => onSocial(signInWithGoogle)}
                    onApple={() => onSocial(signInWithApple)}
                    disabled={submitting}
                />

                {/* The social buttons sign UP anyone who has never used
                    the app, so the 16+/terms promise has to be visible
                    here too — not only on the registration screen. */}
                <ConsentNotice />

                <HStack gap="3" color="fg.subtle" fontSize="xs">
                    <Box flex="1" h="1px" bg="border.subtle" />
                    <Text>{t("forms.auth.orDivider")}</Text>
                    <Box flex="1" h="1px" bg="border.subtle" />
                </HStack>

                <form onSubmit={onSubmit} noValidate>
                    <VStack align="stretch" gap="4">
                        <Field.Root required invalid={touched && !emailResult.ok}>
                            <Field.Label>{t("forms.auth.email")}</Field.Label>
                            <Input
                                size="lg"
                                type="email"
                                inputMode="email"
                                autoCapitalize="none"
                                spellCheck={false}
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                            {touched && !emailResult.ok && (
                                <Field.ErrorText>{t(emailResult.key)}</Field.ErrorText>
                            )}
                        </Field.Root>
                        <Field.Root required invalid={touched && passwordMissing}>
                            <Field.Label>{t("forms.auth.password")}</Field.Label>
                            <InputGroup
                                endElement={
                                    <IconButton
                                        type="button"
                                        aria-label={showPassword ? t("forms.auth.password.hide") : t("forms.auth.password.show")}
                                        aria-pressed={showPassword}
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowPassword((v) => !v)}
                                    >
                                        {showPassword ? <FiEyeOff /> : <FiEye />}
                                    </IconButton>
                                }
                                endElementProps={{ pointerEvents: "auto" }}
                            >
                                <Input
                                    size="lg"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </InputGroup>
                            {touched && passwordMissing && (
                                <Field.ErrorText>{t("forms.auth.validation.passwordRequired")}</Field.ErrorText>
                            )}
                        </Field.Root>

                        {error && (
                            <Box borderWidth="1px" borderColor="red.muted" bg="red.subtle" rounded="md" p="2">
                                <Text fontSize="sm" color="red.fg">{error}</Text>
                            </Box>
                        )}
                        {resetMsg && (
                            <Box borderWidth="1px" borderColor="green.muted" bg="green.subtle" rounded="md" p="2">
                                <Text fontSize="sm" color="green.fg">{resetMsg}</Text>
                            </Box>
                        )}

                        <Button
                            type="submit"
                            size="lg"
                            w="full"
                            colorPalette="brand"
                            loading={submitting}
                            disabled={submitting}
                        >
                            {t("forms.login.submit")}
                        </Button>
                    </VStack>
                </form>

                {/* Stacked and centred on a phone (2026-09-20, user
                    request): the two links used to share one wrapped
                    row and sat ragged against opposite edges. From
                    `sm` up they are the same left/right pair. */}
                <Stack
                    direction={{ base: "column", sm: "row" }}
                    justify={{ base: "center", sm: "space-between" }}
                    align="center"
                    gap="2"
                >
                    <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={onResetPassword}
                    >
                        {t("forms.login.forgotPassword")}
                    </Button>
                    <Text fontSize="sm" color="fg.muted" textAlign="center">
                        {t("forms.login.noAccount")}{" "}
                        <Box as="span" color="brand.fg" fontWeight="medium">
                            <RouterLink to="/registracija">{t("forms.login.registerLink")}</RouterLink>
                        </Box>
                    </Text>
                </Stack>
            </VStack>
        </Box>
    )
}
