import type { ReactNode } from "react"
import { Box, Heading, Text, VStack } from "@chakra-ui/react"
import { useDocumentHead } from "../hooks/useDocumentHead"
import { useTranslation } from "../i18n"

/* ──────────────────────────────────────────────────────────────────────────
   TermsPage — "Uvjeti korištenja" (/uvjeti).

   Same shape as PrivacyPage.tsx: flat `legal.terms.*` keys assembled into
   sections here rather than nested arrays in the dictionary. See
   `src/i18n/hr/legal.ts` for the sourcing notes.
   ────────────────────────────────────────────────────────────────────── */

type Section = {
    headingKey: string
    bodyKeys: string[]
}

const SECTIONS: Section[] = [
    { headingKey: "service", bodyKeys: ["body"] },
    { headingKey: "accounts", bodyKeys: ["body1", "body2"] },
    { headingKey: "organiserContent", bodyKeys: ["body1", "body2"] },
    { headingKey: "prohibitedConduct", bodyKeys: ["body"] },
    { headingKey: "ip", bodyKeys: ["body"] },
    { headingKey: "liability", bodyKeys: ["body"] },
    { headingKey: "termination", bodyKeys: ["body"] },
    { headingKey: "governingLaw", bodyKeys: ["body"] },
    { headingKey: "changes", bodyKeys: ["body"] },
    { headingKey: "contact", bodyKeys: ["body"] },
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

export default function TermsPage() {
    const { t } = useTranslation()

    useDocumentHead({
        title: t("legal.terms.documentTitle"),
        description: t("legal.terms.documentDescription"),
        ogTitle: t("legal.terms.title"),
        ogDescription: t("legal.terms.documentDescription"),
        ogType: "website",
        canonical: "https://bela-turniri.com/uvjeti",
    })

    return (
        <VStack align="stretch" gap="6" maxW="720px" mx="auto" py={{ base: "2", md: "4" }} pb="10">
            <Box>
                <Heading size="lg" mb="1">{t("legal.terms.title")}</Heading>
                <Text color="fg.muted" fontSize="xs" mb="3">{t("legal.terms.lastUpdated")}</Text>
                <Text color="fg.muted" fontSize="sm">{t("legal.terms.intro")}</Text>
            </Box>

            {SECTIONS.map((section) => (
                <SectionBlock key={section.headingKey} title={t(`legal.terms.${section.headingKey}.heading`)}>
                    {section.bodyKeys.map((key) => (
                        <Text key={key}>{t(`legal.terms.${section.headingKey}.${key}`)}</Text>
                    ))}
                </SectionBlock>
            ))}
        </VStack>
    )
}
