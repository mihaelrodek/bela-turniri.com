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
    Text,
    VStack,
} from "@chakra-ui/react"
import { FiEye, FiEyeOff } from "react-icons/fi"
import { useAuth } from "../auth/authContextValue"
import { firebaseErrorCode, socialAuthErrorMessage } from "../auth/authErrors"
import { NAME_MAX, normalizeEmail, normalizeName, validateEmail, validateName, validatePassword } from "../auth/validation"
import { ConsentCheckbox } from "../components/auth/ConsentGate"
import { SocialAuthButtons } from "../components/auth/SocialAuthButtons"
import { nextFromState, pickSafeNext } from "../utils/safeNextPath"
import { t, useTranslation } from "../i18n"
import { brand, homePath, siteName } from "../site"

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
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    // The Terms of Service require 16+, and every path on this page creates an
    // account — email/password AND the two social buttons — so all three are
    // gated on the same checkbox rather than only the form's submit.
    const [consent, setConsent] = useState(false)
    // Set once the user has tried to submit; from then on every field shows
    // its own inline error instead of one combined banner — same pattern as
    // ContactPage.tsx / LoginPage.tsx.
    const [touched, setTouched] = useState(false)

    const nameResult = validateName(name)
    const emailResult = validateEmail(email)
    const passwordResult = validatePassword(password)
    const passwordsMatch = password === confirm

    // Honour ?next= from the URL (claim-name flow uses it), then the
    // navigation-state hint, then the default home for tournaments. Both
    // inputs are attacker-controllable, so pickSafeNext rejects anything that
    // isn't a plain same-origin path (see utils/safeNextPath.ts).
    const redirectTo = pickSafeNext(
        [searchParams.get("next"), nextFromState(location.state)],
        homePath,
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
        setTouched(true)
        if (!consent) {
            setError(t("forms.auth.consent.required"))
            return
        }
        if (!nameResult.ok || !emailResult.ok || !passwordResult.ok || !passwordsMatch) return
        try {
            setSubmitting(true)
            await signUp(normalizeEmail(email), password, normalizeName(name) || undefined)
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
                    <Heading size="xl">{t("forms.register.heading")}</Heading>
                    <Text color="fg.muted" fontSize="sm">{t("forms.register.subtitle")}</Text>
                </VStack>

                <ConsentCheckbox checked={consent} onChange={setConsent} />

                <SocialAuthButtons
                    googleLabel={t("forms.register.googleButton")}
                    appleLabel={t("forms.register.appleButton")}
                    onGoogle={() => onSocial(signInWithGoogle)}
                    onApple={() => onSocial(signInWithApple)}
                    disabled={submitting || !consent}
                />

                <HStack gap="3" color="fg.subtle" fontSize="xs">
                    <Box flex="1" h="1px" bg="border.subtle" />
                    <Text>{t("forms.auth.orDivider")}</Text>
                    <Box flex="1" h="1px" bg="border.subtle" />
                </HStack>

                <form onSubmit={onSubmit} noValidate>
                    <VStack align="stretch" gap="4">
                        <Field.Root invalid={touched && !nameResult.ok}>
                            <Field.Label>{t("forms.register.nameLabel")} <Box as="span" color="fg.muted" fontSize="xs">{t("forms.register.nameOptional")}</Box></Field.Label>
                            <Input
                                size="lg"
                                autoComplete="name"
                                value={name}
                                maxLength={NAME_MAX}
                                onChange={(e) => setName(e.target.value)}
                                placeholder={t("forms.register.namePlaceholder")}
                            />
                            {touched && !nameResult.ok && (
                                <Field.ErrorText>{t(nameResult.key)}</Field.ErrorText>
                            )}
                        </Field.Root>
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
                        <Field.Root required invalid={touched && !passwordResult.ok}>
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
                                    autoComplete="new-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </InputGroup>
                            {touched && !passwordResult.ok ? (
                                <Field.ErrorText>{t(passwordResult.key)}</Field.ErrorText>
                            ) : (
                                <Field.HelperText>{t("forms.register.passwordHelper")}</Field.HelperText>
                            )}
                        </Field.Root>
                        <Field.Root required invalid={touched && !passwordsMatch}>
                            <Field.Label>{t("forms.register.confirmPasswordLabel")}</Field.Label>
                            <InputGroup
                                endElement={
                                    <IconButton
                                        type="button"
                                        aria-label={showConfirm ? t("forms.auth.password.hide") : t("forms.auth.password.show")}
                                        aria-pressed={showConfirm}
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowConfirm((v) => !v)}
                                    >
                                        {showConfirm ? <FiEyeOff /> : <FiEye />}
                                    </IconButton>
                                }
                                endElementProps={{ pointerEvents: "auto" }}
                            >
                                <Input
                                    size="lg"
                                    type={showConfirm ? "text" : "password"}
                                    autoComplete="new-password"
                                    value={confirm}
                                    onChange={(e) => setConfirm(e.target.value)}
                                />
                            </InputGroup>
                            {touched && !passwordsMatch && (
                                <Field.ErrorText>{t("forms.register.validation.passwordMismatch")}</Field.ErrorText>
                            )}
                        </Field.Root>

                        {error && (
                            <Box borderWidth="1px" borderColor="red.muted" bg="red.subtle" rounded="md" p="2">
                                <Text fontSize="sm" color="red.fg">{error}</Text>
                            </Box>
                        )}

                        <Button
                            type="submit"
                            size="lg"
                            w="full"
                            colorPalette="brand"
                            loading={submitting}
                            disabled={submitting || !consent}
                        >
                            {t("forms.register.submit")}
                        </Button>
                    </VStack>
                </form>

                <Text fontSize="sm" color="fg.muted" textAlign="center">
                    {t("forms.register.hasAccount")}{" "}
                    <Box as="span" color="brand.fg" fontWeight="medium">
                        <RouterLink to="/prijava">{t("forms.register.loginLink")}</RouterLink>
                    </Box>
                </Text>
            </VStack>
        </Box>
    )
}
