import { useDocumentHead } from "../hooks/useDocumentHead"
import { useTranslation } from "../i18n"
import { publicOrigin } from "../site"
import RulesDocument from "../components/rules/RulesDocument"

/* ──────────────────────────────────────────────────────────────────────────
   RulesPage — "Pravila bele" (/pravila), 2026-09-29, owner request.

   One unified rulebook for tournament bela, cut from three real tournament
   rulebooks (Stefanje 2025., Prvenstvo Hrvatske 2026., Prvomajski turnir
   Vrbovec 2026.). Where they contradicted each other the owner decided; the
   decisions are listed beside the strings in `src/i18n/hr/legal.ts`.

   Since 2026-10-03 the rendering lives in `components/rules/RulesDocument`,
   shared with each tournament's "Pravila" tab; this page is that document
   with the global defaults (no stored rules, the 1001 / prolaz parameters)
   plus the SEO head. Same contract as TermsPage.tsx: flat `legal.rules.*`
   keys. Unlike the legal pages this one is meant to be consulted at a table,
   so it is cards, numbered rules and two tables, not prose.
   ────────────────────────────────────────────────────────────────────── */

export default function RulesPage() {
    const { t } = useTranslation()

    useDocumentHead({
        title: t("legal.rules.documentTitle"),
        description: t("legal.rules.documentDescription"),
        ogTitle: t("legal.rules.title"),
        ogDescription: t("legal.rules.documentDescription"),
        ogType: "website",
        canonical: `${publicOrigin}/pravila`,
    })

    return <RulesDocument />
}
