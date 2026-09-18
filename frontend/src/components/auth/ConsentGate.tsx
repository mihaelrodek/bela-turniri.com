import { Box, Checkbox, Text } from "@chakra-ui/react"
import { Link as RouterLink } from "react-router-dom"
import { useTranslation } from "../../i18n"

/*
 * The 16+ / terms consent gate.
 *
 * The Terms of Service set a minimum age of 16, and both app stores expect the
 * acceptance to happen before an account exists — not on a screen the user
 * meets afterwards. So: a required checkbox on the registration screen, and a
 * plain notice on the login screen, because the social buttons there CREATE an
 * account for anyone who has never signed in before.
 *
 * The sentence is assembled from separate keys instead of interpolated markup
 * because two of its fragments are router links; the i18n engine only
 * interpolates plain strings.
 */

/** The "… Uvjete korištenja i Politiku privatnosti" tail, with both links. */
function ConsentLinks() {
    const { t } = useTranslation()
    return (
        <>
            <Box as="span" color="blue.fg" fontWeight="medium">
                <RouterLink to="/uvjeti">{t("forms.auth.consent.terms")}</RouterLink>
            </Box>
            {" "}{t("forms.auth.consent.and")}{" "}
            <Box as="span" color="blue.fg" fontWeight="medium">
                <RouterLink to="/privatnost">{t("forms.auth.consent.privacy")}</RouterLink>
            </Box>
        </>
    )
}

/** Registration: a real, required opt-in that gates every sign-up path. */
export function ConsentCheckbox({
    checked,
    onChange,
}: {
    checked: boolean
    onChange: (checked: boolean) => void
}) {
    const { t } = useTranslation()
    return (
        <Checkbox.Root
            checked={checked}
            onCheckedChange={(e) => onChange(e.checked === true)}
            alignItems="flex-start"
        >
            <Checkbox.HiddenInput />
            <Checkbox.Control mt="0.5" />
            <Checkbox.Label fontSize="sm" fontWeight="normal" lineHeight="short">
                {t("forms.auth.consent.checkboxPrefix")}{" "}<ConsentLinks />
            </Checkbox.Label>
        </Checkbox.Root>
    )
}

/** Login: the same promise, as a notice — there is nothing to opt into twice. */
export function ConsentNotice() {
    const { t } = useTranslation()
    return (
        <Text fontSize="xs" color="fg.muted" textAlign="center">
            {t("forms.auth.consent.noticePrefix")}{" "}<ConsentLinks />
        </Text>
    )
}
