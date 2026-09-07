import { chakra, Field } from "@chakra-ui/react"

import { useTranslation } from "../i18n"
import { numberToMoneyStr, parseMoneyLoose } from "../utils/format"

/**
 * The "€/par → €/igrač" helper line shown under every price input.
 *
 * One component for both forms. CreateTournamentPage held `PerPairHint`
 * (taking an already-parsed number) and TournamentDetailsPage held
 * `EditPerPairHint` (taking the raw input string and parsing it); the markup
 * and the copy were identical, so `value` simply accepts either shape now and
 * a string is parsed with the same `parseMoneyLoose` the edit form used.
 *
 * Renders nothing when the value doesn't resolve to a finite number — an
 * empty or half-typed field gets no hint rather than a "NaN€" one.
 */
export default function PerPairHint({ value }: { value: number | string }) {
    const { t } = useTranslation()
    const n = typeof value === "number" ? value : parseMoneyLoose(value)
    if (!Number.isFinite(n)) return null
    return (
        <Field.HelperText>
            {numberToMoneyStr(n)}€
            <chakra.span color="fg.muted">{t("forms.createTournament.perPairSuffix")}</chakra.span>{" "}
            • {numberToMoneyStr(n / 2)}€
            <chakra.span color="fg.muted">{t("forms.createTournament.perPlayerSuffix")}</chakra.span>
        </Field.HelperText>
    )
}
