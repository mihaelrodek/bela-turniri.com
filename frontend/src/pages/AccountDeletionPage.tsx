import type { ReactNode } from "react"
import { Box, Heading, Link as ChakraLink, List, Text, VStack } from "@chakra-ui/react"
import { Link as RouterLink } from "react-router-dom"
import { useDocumentHead } from "../hooks/useDocumentHead"
import { useTranslation } from "../i18n"
import { isGamesSite, publicOrigin, siteName } from "../site"
import { ACCOUNT_DELETION_PATH } from "./accountDeletionPath"

/* ──────────────────────────────────────────────────────────────────────────
   AccountDeletionPage — "Brisanje računa" (/brisanje-racuna).

   PUBLIC and login-free by design. Google Play's account-deletion policy
   wants two paths, not one: an in-app option AND "a web resource" a person
   can reach in a browser without installing anything, whose URL is typed
   into the Data safety form.
     https://support.google.com/googleplay/android-developer/answer/13327111
   Apple asks the same question from the other end — 5.1.1(v) wants the path
   to deletion to be easy to FIND — so this page is also what the delete card
   and the privacy policy link to.

   Two consequences for how it is written:

   • It must render correctly on all three front doors. `siteName` and
     `publicOrigin` come from `src/site.ts`, so the prose says
     "bela-turniri.com" or "bela.games" or "belot.games" depending on where
     it is served, and never hard-codes a host. The path is deliberately NOT
     in `FULL_SITE_ONLY_PREFIXES` — a games-only build must serve it, since
     that is the build the stores review.
   • On a games domain there are no tournaments, so the four tournament-shaped
     bullets are dropped rather than translated into a lie. Everything else is
     identical: one account, one deletion, two windows onto it.

   `RequireAuth` is not involved and nothing here calls the API: a person
   whose account is already unreachable must still be able to read it.
   ────────────────────────────────────────────────────────────────────── */

/** Bullet keys for "Što se briše". `fullOnly` ones name tournaments. */
const DELETED_ITEMS: { key: string; fullOnly?: true }[] = [
    { key: "profile" },
    { key: "auth" },
    { key: "gameName" },
    { key: "push" },
    { key: "blok" },
    { key: "blocks" },
    { key: "reliability" },
    { key: "pairPhone", fullOnly: true },
    { key: "pairRequests", fullOnly: true },
    { key: "presets", fullOnly: true },
    { key: "device" },
]

/** Bullet keys for "Što ostaje i zašto". */
const KEPT_ITEMS: { key: string; fullOnly?: true }[] = [
    { key: "uid" },
    { key: "tournaments", fullOnly: true },
    { key: "gameResults" },
    { key: "reports" },
    { key: "contact" },
    { key: "logs" },
    { key: "guest" },
]

function Section({ title, children }: { title: string; children: ReactNode }) {
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

export default function AccountDeletionPage() {
    const { t } = useTranslation()

    // A games-domain reader never sees the tournament bullets.
    const visible = (items: { key: string; fullOnly?: true }[]) =>
        items.filter((i) => !(i.fullOnly && isGamesSite))

    useDocumentHead({
        title: t("legal.deletion.documentTitle", { site: siteName }),
        description: t("legal.deletion.documentDescription", { site: siteName }),
        ogTitle: t("legal.deletion.title"),
        ogDescription: t("legal.deletion.documentDescription", { site: siteName }),
        ogType: "website",
        canonical: `${publicOrigin}${ACCOUNT_DELETION_PATH}`,
    })

    return (
        <VStack align="stretch" gap="6" maxW="720px" mx="auto" py={{ base: "2", md: "4" }} pb="10">
            <Box>
                <Heading size="lg" mb="1">{t("legal.deletion.title")}</Heading>
                <Text color="fg.muted" fontSize="xs" mb="3">{t("legal.deletion.lastUpdated")}</Text>
                <Text color="fg.muted" fontSize="sm">
                    {t("legal.deletion.intro", { site: siteName })}
                </Text>
            </Box>

            <Section title={t("legal.deletion.inApp.heading")}>
                <Text>{t("legal.deletion.inApp.intro")}</Text>
                {/* An ordered list, not bullets: these are steps in sequence,
                    and a reviewer following them needs the numbers. */}
                <List.Root as="ol" ps="5" gap="1">
                    {["step1", "step2", "step3", "step4"].map((step) => (
                        <List.Item key={step}>{t(`legal.deletion.inApp.${step}`)}</List.Item>
                    ))}
                </List.Root>
                <Text>{t("legal.deletion.inApp.apple")}</Text>
            </Section>

            <Section title={t("legal.deletion.noApp.heading")}>
                <Text>{t("legal.deletion.noApp.body1", { origin: publicOrigin })}</Text>
                <Text>
                    <ChakraLink asChild color="fg" textDecoration="underline">
                        <RouterLink to="/profil">{t("legal.deletion.noApp.linkLabel")}</RouterLink>
                    </ChakraLink>
                </Text>
                <Text>{t("legal.deletion.noApp.body2")}</Text>
                <Text>
                    <ChakraLink asChild color="fg" textDecoration="underline">
                        <RouterLink to="/kontakt">{t("legal.deletion.noApp.contactLabel")}</RouterLink>
                    </ChakraLink>
                </Text>
            </Section>

            <Section title={t("legal.deletion.deleted.heading")}>
                {visible(DELETED_ITEMS).map(({ key }) => (
                    <Text key={key}>• {t(`legal.deletion.deleted.item.${key}`)}</Text>
                ))}
            </Section>

            <Section title={t("legal.deletion.kept.heading")}>
                <Text>{t("legal.deletion.kept.intro")}</Text>
                {visible(KEPT_ITEMS).map(({ key }) => (
                    <Text key={key}>• {t(`legal.deletion.kept.item.${key}`)}</Text>
                ))}
            </Section>

            <Section title={t("legal.deletion.timing.heading")}>
                <Text>{t("legal.deletion.timing.body")}</Text>
            </Section>

            <Section title={t("legal.deletion.more.heading")}>
                <Text>{t("legal.deletion.more.body")}</Text>
                <Text>
                    <ChakraLink asChild color="fg" textDecoration="underline">
                        <RouterLink to="/privatnost">{t("legal.deletion.more.privacyLabel")}</RouterLink>
                    </ChakraLink>
                </Text>
            </Section>
        </VStack>
    )
}
