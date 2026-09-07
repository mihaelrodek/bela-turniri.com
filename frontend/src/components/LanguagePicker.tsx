import { Box, Button, HStack } from "@chakra-ui/react"
import { LOCALES, LOCALE_LABELS, setLocale, useLocale, type Locale } from "../i18n"

/* ──────────────────────────────────────────────────────────────────────────
   Language switcher — HR / SL. Picking one calls `setLocale()` (src/i18n),
   which re-renders every `useTranslation()` call site immediately and is also
   read by `api/http.ts`'s request interceptor (`X-Locale`), so server-produced
   strings (error envelopes, validation text) switch with it.

   Persisting to the signed-in user's profile is NOT done here — `LocaleSync`
   watches the locale and writes it, the same split ThemeSync uses for the
   colour mode. That keeps this component free of auth/query concerns.

   Shape: a plain inline row of flag+code toggles, the active one solid.
   Deliberately NOT a Menu any more — it now lives *inside* the navbar's user
   menu (and the guest menu), and nesting a portalled Menu inside another open
   overlay makes it render underneath and fight the parent's outside-click
   dismissal. Colours are semantic tokens only, so it follows the theme with
   no `useColorModeValue` round-trip.
   ────────────────────────────────────────────────────────────────────── */

export default function LanguagePicker() {
    const active = useLocale()

    function pick(locale: Locale) {
        setLocale(locale)
    }

    return (
        <HStack gap="1.5">
            {LOCALES.map((locale) => (
                <Button
                    key={locale}
                    type="button"
                    size="xs"
                    px="2"
                    variant={locale === active ? "solid" : "outline"}
                    colorPalette={locale === active ? "blue" : undefined}
                    aria-label={LOCALE_LABELS[locale].name}
                    aria-pressed={locale === active}
                    title={LOCALE_LABELS[locale].name}
                    onClick={() => pick(locale)}
                >
                    <Box as="span" fontSize="14px" lineHeight="1" aria-hidden="true">
                        {LOCALE_LABELS[locale].flag}
                    </Box>
                    {LOCALE_LABELS[locale].code}
                </Button>
            ))}
        </HStack>
    )
}
