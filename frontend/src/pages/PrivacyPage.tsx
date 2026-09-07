import type { ReactNode } from "react"
import { Box, Heading, Text, VStack } from "@chakra-ui/react"
import { useDocumentHead } from "../hooks/useDocumentHead"
import { useTranslation } from "../i18n"

/* ──────────────────────────────────────────────────────────────────────────
   PrivacyPage — "Pravila privatnosti" (/privatnost).

   Grounded in what the app actually stores and does today (see
   `src/i18n/hr/legal.ts` for the full sourcing notes and CLAUDE.md's
   Auth/Storage/Push sections) rather than a generic template. All copy
   lives in the `legal` i18n namespace, flat key-per-string like the rest of
   the dictionaries — the section list below is assembled here, not stored
   as an array in the dictionary, since `t()` only ever resolves a single
   string per key.

   No operator name, address, OIB or email is invented anywhere on this
   page — the "voditelj obrade" section names only "the owner of
   bela-turniri.com" and points every request at /kontakt, per product
   instruction.
   ────────────────────────────────────────────────────────────────────── */

/** One prose section: a heading plus one or more paragraph keys, rendered in
 *  order, with an optional bullet list (used only by "Koje podatke"). */
type Section = {
    headingKey: string
    bodyKeys?: string[]
    itemKeys?: string[]
}

const SECTIONS: Section[] = [
    { headingKey: "controller", bodyKeys: ["body"] },
    {
        headingKey: "dataCollected",
        bodyKeys: ["intro"],
        itemKeys: [
            "item.account",
            "item.profile",
            "item.tournament",
            "item.media",
            "item.push",
            "item.game",
            "item.analytics",
            "item.logs",
            "item.device",
        ],
    },
    { headingKey: "purpose", bodyKeys: ["body1", "body2", "body3"] },
    { headingKey: "recipients", bodyKeys: ["body1", "body2", "body3", "body4"] },
    { headingKey: "retention", bodyKeys: ["body"] },
    { headingKey: "rights", bodyKeys: ["body1", "body2", "body3"] },
    { headingKey: "cookies", bodyKeys: ["body1", "body2"] },
    { headingKey: "children", bodyKeys: ["body"] },
    { headingKey: "changes", bodyKeys: ["body"] },
]

function SectionBlock({ title, children }: { title: string; children: ReactNode }) {
    return (
        <Box>
            <Heading as="h2" size="sm" mb="2" color="fg">
                {title}
            </Heading>
            <VStack align="stretch" gap="2" color="fg.muted" fontSize="sm" lineHeight="1.6">
                {children}
            </VStack>
        </Box>
    )
}

export default function PrivacyPage() {
    const { t } = useTranslation()

    useDocumentHead({
        title: t("legal.privacy.documentTitle"),
        description: t("legal.privacy.documentDescription"),
        ogTitle: t("legal.privacy.title"),
        ogDescription: t("legal.privacy.documentDescription"),
        ogType: "website",
        canonical: "https://bela-turniri.com/privatnost",
    })

    return (
        <VStack align="stretch" gap="6" maxW="720px" mx="auto" py={{ base: "2", md: "4" }} pb="10">
            <Box>
                <Heading size="lg" mb="1">{t("legal.privacy.title")}</Heading>
                <Text color="fg.muted" fontSize="xs" mb="3">{t("legal.privacy.lastUpdated")}</Text>
                <Text color="fg.muted" fontSize="sm">{t("legal.privacy.intro")}</Text>
            </Box>

            {SECTIONS.map((section) => (
                <SectionBlock key={section.headingKey} title={t(`legal.privacy.${section.headingKey}.heading`)}>
                    {section.bodyKeys?.map((key) => (
                        <Text key={key}>{t(`legal.privacy.${section.headingKey}.${key}`)}</Text>
                    ))}
                    {section.itemKeys?.map((key) => (
                        <Text key={key}>• {t(`legal.privacy.${section.headingKey}.${key}`)}</Text>
                    ))}
                </SectionBlock>
            ))}
        </VStack>
    )
}
