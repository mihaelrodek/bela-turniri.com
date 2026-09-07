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
import { FcGoogle } from "react-icons/fc"
import { sendPasswordResetEmail } from "firebase/auth"
import { FirebaseError } from "firebase/app"
import { auth } from "../firebase"
import { useAuth } from "../auth/authContextValue"
import { nextFromState, pickSafeNext } from "../utils/safeNextPath"
import { t, useTranslation } from "../i18n"

/** Translate Firebase auth error codes into user-friendly messages. */
function authErrorMessage(err: unknown): string {
    const code = err instanceof FirebaseError ? err.code : ""
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
        case "auth/popup-closed-by-user":
        case "auth/cancelled-popup-request":
            return "" // user closed popup — not really an error
        default:
            return err instanceof Error ? err.message : t("forms.login.error.generic")
    }
}

export default function LoginPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const [searchParams] = useSearchParams()
    const { signIn, signInWithGoogle, user, loading: authLoading } = useAuth()
    const { t } = useTranslation()

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [resetMsg, setResetMsg] = useState<string | null>(null)

    // Where to send the user after a successful sign-in. Accepts a
    // ?next=/path query param (RequireAuth, the axios 401 interceptor and the
    // claim-name share flow all emit it) and falls back to whatever the
    // navigation state carried. Both are attacker-controllable inputs, so
    // pickSafeNext rejects anything that isn't a plain same-origin path —
    // otherwise ?next=//evil.tld would bounce a freshly-authenticated user
    // onto a phishing origin.
    const redirectTo = pickSafeNext(
        [searchParams.get("next"), nextFromState(location.state)],
        "/turniri",
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
        if (!email.trim() || !password) {
            setError(t("forms.login.validation.emailPassword"))
            return
        }
        try {
            setSubmitting(true)
            await signIn(email.trim(), password)
            navigate(redirectTo, { replace: true })
        } catch (e: unknown) {
            const msg = authErrorMessage(e)
            if (msg) setError(msg)
        } finally {
            setSubmitting(false)
        }
    }

    async function onGoogle() {
        setError(null)
        setResetMsg(null)
        try {
            await signInWithGoogle()
            navigate(redirectTo, { replace: true })
        } catch (e: unknown) {
            const msg = authErrorMessage(e)
            if (msg) setError(msg)
        }
    }

    async function onResetPassword() {
        setError(null)
        setResetMsg(null)
        if (!email.trim()) {
            setError(t("forms.login.validation.emailForReset"))
            return
        }
        try {
            await sendPasswordResetEmail(auth, email.trim())
            setResetMsg(t("forms.login.resetSent"))
        } catch (e: unknown) {
            setError(authErrorMessage(e))
        }
    }

    return (
        <Box maxW="420px" mx="auto" mt={{ base: "4", md: "10" }}>
            <Card.Root variant="outline" rounded="xl" borderColor="border.emphasized" shadow="sm">
                <Card.Body p={{ base: "5", md: "6" }}>
                    <VStack align="stretch" gap="4">
                        <Heading size="md">{t("forms.login.heading")}</Heading>

                        <Button
                            variant="outline"
                            size="md"
                            onClick={onGoogle}
                            disabled={submitting}
                        >
                            <FcGoogle size={18} /> {t("forms.login.googleButton")}
                        </Button>

                        <HStack>
                            <Box flex="1" h="1px" bg="border.subtle" />
                            <Text fontSize="xs" color="fg.muted">{t("forms.auth.orDivider")}</Text>
                            <Box flex="1" h="1px" bg="border.subtle" />
                        </HStack>

                        <form onSubmit={onSubmit}>
                            <VStack align="stretch" gap="3">
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
                                        autoComplete="current-password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
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
                                    variant="solid"
                                    colorPalette="blue"
                                    loading={submitting}
                                    disabled={submitting}
                                >
                                    {t("forms.login.submit")}
                                </Button>
                            </VStack>
                        </form>

                        <HStack justify="space-between" wrap="wrap" gap="2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                onClick={onResetPassword}
                            >
                                {t("forms.login.forgotPassword")}
                            </Button>
                            <Text fontSize="sm" color="fg.muted">
                                {t("forms.login.noAccount")}{" "}
                                <Box as="span" color="blue.fg" fontWeight="medium">
                                    <RouterLink to="/registracija">{t("forms.login.registerLink")}</RouterLink>
                                </Box>
                            </Text>
                        </HStack>
                    </VStack>
                </Card.Body>
            </Card.Root>
        </Box>
    )
}
