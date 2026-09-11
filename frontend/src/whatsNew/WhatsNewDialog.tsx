import { type ReactNode } from "react"
import { Box, Button, Dialog, Heading, HStack, IconButton, Portal, Text, VStack } from "@chakra-ui/react"
import { FiVolume2, FiX } from "react-icons/fi"
import { useTranslation } from "../i18n"
import { formatDateLong } from "../utils/format"
import { getReleases } from "./releases"
import { close, useIsWhatsNewOpen } from "./store"

/* ──────────────────────────────────────────────────────────────────────────
   WhatsNewDialog — paginated release notes, opened from `WhatsNewFab`.

   `React.lazy`-loaded from `main.tsx` on purpose: this module pulls in
   `./releases`, which pulls in BOTH locales' full release prose
   (`releases.hr.ts` + `releases.sl.ts`). Splitting it out keeps that prose
   out of the app's initial bundle — see `releases.ts`'s header comment.

   Always shows the NEWEST release (`releases[0]`) — there is no history
   browser here. A future release just becomes the new `[0]`; nothing here
   needs to change to show it.

   ONE scrolling view, no stepper (2026-09-10, user request). It used to page
   through `release.pages` with prev/next and a "1 / 4" counter; that hid
   three quarters of the announcement behind a control, and a release note is
   skimmed rather than read in order. Every group is now simply stacked in
   `Dialog.Body`, which already scrolls (`scrollBehavior="inside"`).
   ────────────────────────────────────────────────────────────────────── */

/** Tiny inline "markdown": `**text**` becomes `<strong>`, everything else is
 *  passed through verbatim. Not a real markdown parser — the release prose
 *  in `releases.hr.ts`/`releases.sl.ts` only ever needs this one marker. */
function renderInline(text: string): ReactNode[] {
    return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
            return <strong key={i}>{part.slice(2, -2)}</strong>
        }
        return part
    })
}

export default function WhatsNewDialog() {
    const { t } = useTranslation()
    const isOpen = useIsWhatsNewOpen()
    const releases = getReleases()
    const release = releases[0]
    return (
        <Dialog.Root
            open={isOpen}
            onOpenChange={(e) => { if (!e.open) close() }}
            placement="center"
            scrollBehavior="inside"
        >
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW={{ base: "92%", md: "640px" }} rounded="2xl">
                        <Dialog.Header py="3">
                            <VStack align="stretch" gap="1" width="full">
                                <HStack justify="space-between" align="center" gap="2">
                                    <HStack gap="2" minW="0">
                                        <Box color="brand.fg" flexShrink={0}>
                                            <FiVolume2 size={18} aria-hidden="true" />
                                        </Box>
                                        <Dialog.Title asChild>
                                            <Heading size="lg" lineHeight="1.25">
                                                {release.title}
                                            </Heading>
                                        </Dialog.Title>
                                    </HStack>
                                    <Dialog.CloseTrigger asChild>
                                        <IconButton
                                            aria-label={t("whatsNew.dialog.closeAria")}
                                            variant="ghost"
                                            size="sm"
                                            flexShrink={0}
                                        >
                                            <FiX />
                                        </IconButton>
                                    </Dialog.CloseTrigger>
                                </HStack>
                                <HStack gap="2" fontSize="xs" color="fg.muted" flexWrap="wrap">
                                    <Text fontFamily="mono">{release.version}</Text>
                                    <Text aria-hidden="true">·</Text>
                                    <Text>{formatDateLong(release.date)}</Text>
                                </HStack>
                            </VStack>
                        </Dialog.Header>
                        <Box borderTopWidth="1px" borderColor="border.subtle" />
                        <Dialog.Body>
                            <VStack align="stretch" gap="4">
                                {release.groups.map((group) => (
                                    /* An `accent` group is the release's
                                       heads-up about something still coming;
                                       amber plus a tinted panel keeps it from
                                       reading as another shipped change. */
                                    <Box
                                        key={group.heading}
                                        {...(group.accent
                                            ? {
                                                bg: "yellow.subtle",
                                                borderWidth: "1px",
                                                borderColor: "yellow.muted",
                                                rounded: "xl",
                                                p: "3",
                                            }
                                            : {})}
                                    >
                                        <Heading
                                            size="xs"
                                            display="inline-block"
                                            color={group.accent ? "yellow.fg" : "brand.fg"}
                                            textTransform="uppercase"
                                            letterSpacing="wider"
                                            pb="1.5"
                                            borderBottomWidth="2px"
                                            borderColor={group.accent ? "yellow.solid" : "brand.solid"}
                                            mb="2"
                                        >
                                            {group.heading}
                                        </Heading>
                                        <VStack align="stretch" gap="2">
                                            {group.sections.map((section) => (
                                                <Box
                                                    key={section.title}
                                                    borderLeftWidth="3px"
                                                    borderColor={group.accent ? "yellow.solid" : "brand.solid"}
                                                    pl="3"
                                                >
                                                    <Text fontWeight="bold" mb="1">
                                                        {section.title}
                                                    </Text>
                                                    {section.bullets ? (
                                                        /* `listStyleType` + `pl` rather than a
                                                           bare <ul>: Chakra's reset strips list
                                                           markers, so the dot has to be asked
                                                           for explicitly. */
                                                        <VStack
                                                            as="ul"
                                                            align="stretch"
                                                            gap="1.5"
                                                            pl="4"
                                                            css={{ listStyleType: "disc" }}
                                                        >
                                                            {section.body.map((item, i) => (
                                                                <Text
                                                                    as="li"
                                                                    key={i}
                                                                    fontSize="sm"
                                                                    color="fg.soft"
                                                                    css={{ "&::marker": { color: "var(--chakra-colors-fg-muted)" } }}
                                                                >
                                                                    {renderInline(item)}
                                                                </Text>
                                                            ))}
                                                        </VStack>
                                                    ) : (
                                                        <VStack align="stretch" gap="2">
                                                            {section.body.map((paragraph, i) => (
                                                                <Text key={i} fontSize="sm" color="fg.soft">
                                                                    {renderInline(paragraph)}
                                                                </Text>
                                                            ))}
                                                        </VStack>
                                                    )}
                                                </Box>
                                            ))}
                                        </VStack>
                                    </Box>
                                ))}
                            </VStack>
                        </Dialog.Body>
                        <Dialog.Footer>
                            <Button colorPalette="brand" width="full" onClick={close}>
                                {t("whatsNew.dialog.closeCta")}
                            </Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    )
}
