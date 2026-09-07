import React, { useEffect, useRef, useState } from "react"
import { Button, chakra, Dialog, Field, HStack, Input, NativeSelect, Skeleton, VStack } from "@chakra-ui/react"
import { updateProfile as fbUpdateProfile } from "firebase/auth"
import { auth } from "../../firebase"
import { syncProfile, updateProfile } from "../../api/userMe"
import { useInvalidateMyProfile, useMyProfile } from "../../hooks/useMyProfile"
import { errorMessage } from "../../utils/apiError"
import { DEFAULT_DIAL_CODE, PHONE_COUNTRIES } from "../../utils/phone"
import { useTranslation } from "../../i18n"

export function EditProfileDialog({
    open,
    initialName,
    onClose,
    onSaved,
}: {
    open: boolean
    initialName: string
    onClose: () => void
    onSaved: () => Promise<void> | void
}) {
    const { t } = useTranslation()
    const [name, setName] = useState(initialName)
    const [country, setCountry] = useState<string>(DEFAULT_DIAL_CODE)
    const [phone, setPhone] = useState("")
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // This dialog only ever edits the SIGNED-IN user's own profile (it is
    // rendered behind `isOwner`), so it reads the one shared react-query entry
    // instead of firing its own /user/me/profile GET on every open. A warm
    // cache means the phone fields are populated on the first paint.
    const { data: myProfile, isLoading: loadingPhone } = useMyProfile()
    const invalidateMyProfile = useInvalidateMyProfile()

    // Seeding runs on the closed→open transition only, and name and phone
    // latch INDEPENDENTLY. They used to share one `seeded` flag that was set
    // only once `myProfile` had landed — so on a cold open (empty cache) the
    // effect re-ran on every `myProfile` identity change with the flag still
    // false and re-applied `setName(initialName)` over whatever the user had
    // already typed.
    const nameSeeded = useRef(false)
    const phoneSeeded = useRef(false)

    useEffect(() => {
        if (!open) {
            // Reset for the next open. Clearing the phone fields too keeps the
            // next open a genuine re-seed from the server rather than a replay
            // of a cancelled edit.
            nameSeeded.current = false
            phoneSeeded.current = false
            setPhone("")
            setCountry(DEFAULT_DIAL_CODE)
            return
        }
        if (nameSeeded.current) return
        // Latch immediately — the name comes from a prop that is available
        // synchronously, so there is never a reason to seed it twice.
        nameSeeded.current = true
        setName(initialName)
        setError(null)
    }, [open, initialName])

    // Phone/country come from the shared own-profile query, which may still be
    // cold when the dialog opens; this effect waits for it. It only writes
    // while the field is still untouched, so a user who starts typing before
    // the request resolves keeps their input.
    useEffect(() => {
        if (!open || phoneSeeded.current || !myProfile) return
        phoneSeeded.current = true
        if (phone !== "") return
        setCountry(myProfile.phoneCountry || DEFAULT_DIAL_CODE)
        setPhone(myProfile.phone ?? "")
    }, [open, myProfile, phone])

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault()
        const trimmed = name.trim()
        if (!trimmed) {
            setError(t("profile.edit.nameRequired"))
            return
        }
        try {
            setSaving(true)
            setError(null)
            // Firebase displayName is the source of truth — update it first
            // so any subsequent token refresh carries the new name. The
            // backend mirror lands via /user/me/sync.
            const fbUser = auth.currentUser
            if (fbUser && fbUser.displayName !== trimmed) {
                await fbUpdateProfile(fbUser, { displayName: trimmed })
            }
            await syncProfile(trimmed)
            // Phone is optional; null both fields if blank so the backend
            // doesn't keep a stale country code with no number.
            await updateProfile({
                phoneCountry: phone.trim() ? country : null,
                phone: phone.trim() || null,
            })
            // Repaint every consumer of the shared profile entry (navbar
            // avatar/name, the saved-phone prefill on other pages).
            await invalidateMyProfile()
            await onSaved()
        } catch (e) {
            setError(errorMessage(e, t("profile.edit.saveFailed")))
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog.Root
            open={open}
            onOpenChange={(e) => { if (!e.open && !saving) onClose() }}
        >
            <Dialog.Backdrop />
            <Dialog.Positioner>
                <Dialog.Content maxW="md">
                    <form onSubmit={onSubmit}>
                        <Dialog.Header>{t("profile.edit.title")}</Dialog.Header>
                        <Dialog.Body>
                            <VStack align="stretch" gap="4">
                                <Field.Root required invalid={!!error}>
                                    <Field.Label>{t("profile.edit.nameLabel")} <Field.RequiredIndicator /></Field.Label>
                                    <Input
                                        size="sm"
                                        autoFocus
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder={t("profile.edit.namePlaceholder")}
                                    />
                                    {error && <Field.ErrorText>{error}</Field.ErrorText>}
                                </Field.Root>

                                <Field.Root>
                                    <Field.Label>
                                        {t("profile.edit.phoneLabel")}{" "}
                                        <chakra.span color="fg.muted" fontSize="xs">{t("profile.edit.phoneOptional")}</chakra.span>
                                    </Field.Label>
                                    {loadingPhone ? (
                                        <Skeleton h="9" />
                                    ) : (
                                        <HStack gap="2">
                                            <NativeSelect.Root size="sm" w="120px" flexShrink={0}>
                                                <NativeSelect.Field
                                                    value={country}
                                                    onChange={(e) => setCountry((e.target as HTMLSelectElement).value)}
                                                >
                                                    {PHONE_COUNTRIES.map((c) => (
                                                        <option key={c.value} value={c.value}>{c.label}</option>
                                                    ))}
                                                </NativeSelect.Field>
                                            </NativeSelect.Root>
                                            <Input
                                                flex="1"
                                                size="sm"
                                                type="tel"
                                                inputMode="numeric"
                                                pattern="[0-9 ]*"
                                                placeholder={t("profile.edit.phonePlaceholder")}
                                                value={phone}
                                                // Strip non-digits (and non-spaces) so the saved
                                                // value never contains stray "(", "-", or "+"
                                                // characters — the country dial code lives in a
                                                // separate select.
                                                onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, ""))}
                                            />
                                        </HStack>
                                    )}
                                </Field.Root>
                            </VStack>
                        </Dialog.Body>
                        <Dialog.Footer>
                            <Button variant="ghost" type="button" onClick={onClose} disabled={saving}>
                                {t("common.cancel")}
                            </Button>
                            <Button
                                variant="solid"
                                colorPalette="blue"
                                type="submit"
                                loading={saving}
                                disabled={saving || !name.trim() || loadingPhone}
                            >
                                {t("common.save")}
                            </Button>
                        </Dialog.Footer>
                    </form>
                </Dialog.Content>
            </Dialog.Positioner>
        </Dialog.Root>
    )
}
