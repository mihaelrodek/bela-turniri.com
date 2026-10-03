import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { Box, Button, Flex, Grid, Heading, HStack, SimpleGrid, Spinner, Text, VStack } from "@chakra-ui/react"
import { FiAlertTriangle, FiAward, FiClock, FiDownload, FiEdit2, FiFlag, FiLayers, FiShuffle, FiUsers } from "react-icons/fi"
import type { Suit } from "@bela/engine"
import "../../pages/rulesPrint.css"
import { usePlural, useTranslation } from "../../i18n"
import { brand, siteName } from "../../site"
import DeckSuitIcon from "../../game/components/DeckSuitIcon"
import { t as tStatic } from "../../i18n"
import { showError } from "../../toaster"
import SectionCard from "../SectionCard"
import { CONTENT_STICKY_TOP } from "../navChrome"
import { siteQrImageUrl, tournamentQrImageUrl } from "../tournamentQr"
import {
    GLOBAL_GAME_PARAMS,
    PENALTY_LABEL_KEY,
    PENALTY_TONE,
    resolveRules,
    type GameParams,
    type ResolvedItem,
    type StoredRules,
} from "../../utils/tournamentRules"

/* ──────────────────────────────────────────────────────────────────────────
   RulesDocument — the rulebook as a page, shared by two callers
   (2026-10-03, owner request "Pravila turnira"):

     * /pravila (RulesPage): the global defaults, `rules` = null and the
       global game parameters.
     * the "Pravila" tab of a tournament: that tournament's five game
       parameters plus its stored, sparse `rules` document.

   Everything is derived through `resolveRules`, so the two can never drift.
   The suits block and the declaration value table are fixed reference
   content; the numbered lists around them and the foul table are the
   editable part. The print mechanism (`body.print-rules`, rulesPrint.css) is
   the one /pravila always had (Ctrl+P); the button downloads a PDF built from
   it by the lazy `rulesPdf.ts` (html2canvas-pro + jsPDF); with a `tournament` the letterhead carries the
   tournament name (it repeats on every printed page) and the title block
   names it prominently.
   ────────────────────────────────────────────────────────────────────── */

/* Every setting the organiser picks, at a glance (2026-10-03, owner): the
   original four plus "Igra se na" (prolaz/dosta), "Zvanja" and — only when
   declarations are off — "Bela". */
const GLANCE = ["target", "end", "match", "round", "direction", "declarations", "bela"] as const

/** The suit marks are the "moderne" deck's own printed ones (2026-10-03,
 *  owner), the same `DeckSuitIcon` the game table uses — not text glyphs. */
const SUITS: { key: string; suit: Suit }[] = [
    { key: "herc", suit: "HERC" },
    { key: "karo", suit: "KARA" },
    { key: "pik", suit: "PIK" },
    { key: "tref", suit: "TREF" },
]

/** Declaration → points. `valueKey` is for the one row that is not a number. */
const DECLARATIONS: { key: string; points?: number; valueKey?: string }[] = [
    { key: "seq3", points: 20 },
    { key: "bela", points: 20 },
    { key: "seq4", points: 50 },
    { key: "seq5", points: 100 },
    { key: "four100", points: 100 },
    { key: "four9", points: 150 },
    { key: "fourJ", points: 200 },
    { key: "belot", valueKey: "belotValue" },
]

/** Numbered rules of one section. */
function RuleList({ items }: { items: ResolvedItem[] }) {
    return (
        <VStack as="ol" align="stretch" gap="2.5" listStyleType="none" m="0" p="0">
            {items.map((item, i) => (
                <HStack as="li" key={item.id} align="start" gap="3">
                    <Box
                        className="rules-num"
                        flexShrink={0}
                        boxSize="22px"
                        rounded="full"
                        bg="brand.subtle"
                        color="brand.fg"
                        fontSize="xs"
                        fontWeight="bold"
                        fontFamily="mono"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        mt="1px"
                        aria-hidden="true"
                    >
                        {i + 1}
                    </Box>
                    {/* A stored text may carry line breaks the organiser typed. */}
                    <Text fontSize="sm" lineHeight="1.55" color="fg.soft" whiteSpace="pre-line" minW="0" overflowWrap="anywhere">
                        {item.text}
                    </Text>
                </HStack>
            ))}
        </VStack>
    )
}

/** Two-column table: a label on the left, a value/pill on the right. */
function TwoColumnTable({ head, children }: { head: [string, string]; children: ReactNode }) {
    return (
        <Box borderWidth="1px" borderColor="border.subtle" rounded="l2" overflow="hidden">
            <HStack justify="space-between" px="3" py="2" bg="bg.subtle" fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="0.04em">
                <Text>{head[0]}</Text>
                <Text>{head[1]}</Text>
            </HStack>
            {children}
        </Box>
    )
}

function TableRow({ label, children }: { label: string; children: ReactNode }) {
    return (
        <HStack className="rules-row" justify="space-between" align="center" gap="3" px="3" py="2.5" borderTopWidth="1px" borderColor="border.subtle">
            <Text fontSize="sm" color="fg.soft" whiteSpace="pre-line" minW="0" overflowWrap="anywhere">{label}</Text>
            <Box flexShrink={0}>{children}</Box>
        </HStack>
    )
}

export type RulesDocumentProps = {
    /** Stored document; null/undefined = the global defaults. */
    rules?: StoredRules | null
    /** The tournament's five game parameters; defaults to the global rulebook's. */
    game?: GameParams
    /** Present on a tournament's tab: names the tournament in title, letterhead and print. */
    tournament?: { name: string; subtitle?: string; location?: string; qrRef?: string }
    /** Pin the glance row under the navbar. Off inside the tournament page, whose own
     *  mobile band is already pinned there. */
    sticky?: boolean
    /** Organiser/admin only: jump to editing this tournament (rules live in its edit form). */
    onEdit?: () => void
}

export default function RulesDocument({ rules = null, game = GLOBAL_GAME_PARAMS, tournament, sticky = true, onEdit }: RulesDocumentProps) {
    const { t } = useTranslation()
    const plural = usePlural()
    const resolved = resolveRules(rules, t, game, { plural })

    // Ctrl+P on desktop still prints (2026-10-03): `rulesPrint.css` lays the
    // page out as a compact two-column A4 sheet; the body class scopes those
    // rules to this document only, so printing any other page is untouched.
    // The BUTTON no longer opens the print dialog (owner: mobile print engines
    // broke the layout): it downloads a PDF built from this same markup and
    // stylesheet by `rulesPdf.ts`, a lazy chunk loaded on the first click.
    useEffect(() => {
        document.body.classList.add("print-rules")
        return () => document.body.classList.remove("print-rules")
    }, [])

    const rootRef = useRef<HTMLDivElement>(null)
    const [busy, setBusy] = useState(false)
    const qrRef = tournament?.qrRef
    const downloadPdf = useCallback(async () => {
        const root = rootRef.current
        if (!root || busy) return
        setBusy(true)
        try {
            const { renderRulesPdf, savePdf } = await import("./rulesPdf")
            const blob = await renderRulesPdf(root)
            const slug = tournament ? (qrRef ?? "turnir").replace(/[^a-zA-Z0-9._-]/g, "") || "turnir" : ""
            await savePdf(blob, tournament ? `pravila-${slug}.pdf` : "pravila-bele.pdf")
        } catch {
            showError(tStatic("legal.rules.downloadFailed"))
        } finally {
            setBusy(false)
        }
    }, [busy, tournament, qrRef])

    const glanceKeys = GLANCE.filter((key) => key !== "bela" || !game.declarationsEnabled)
    const glanceValue: Record<(typeof GLANCE)[number], string> = {
        target: String(game.targetScore),
        end: t(game.gameEndRule === "dosta" ? "legal.rules.glance.endDosta" : "legal.rules.glance.endProlaz"),
        declarations: t(game.declarationsEnabled ? "legal.rules.glance.declarationsYes" : "legal.rules.glance.declarationsNo"),
        bela: t(game.allowBela ? "legal.rules.glance.belaYes" : "legal.rules.glance.belaNo"),
        match: plural("legal.rules.glance.matchValue", resolved.matchGames),
        round: t("legal.rules.glance.roundValue", { minutes: resolved.roundMinutes }),
        direction: t(game.dealDirection === "left" ? "legal.rules.glance.directionValue" : "legal.rules.glance.directionValueRight"),
    }

    // No declarations: the value table is hidden (no bela row either); the one fixed
    // rule in the group says it, or that only bela counts.
    const declRows = game.declarationsEnabled ? DECLARATIONS : []
    const { sections, fouls } = resolved

    return (
        <VStack
            ref={rootRef}
            className="rules-print"
            align="stretch"
            gap="5"
            maxW="860px"
            mx="auto"
            // Embedded in a tournament tab the strip must start at the sidebar
            // card's top edge (md+), so no top padding there; /pravila keeps it.
            pt={{ base: "2", md: tournament ? "0" : "4" }}
            pb="10"
        >
            {/* Branded letterhead — print only, fixed so it is on EVERY printed
                page (2026-10-03, owner). Left: logo and site name. Centre:
                the title of the document, fixed in the middle of the header.
                Right: a QR code to scan — the SITE for the global rulebook,
                THAT TOURNAMENT for a tournament's own rules (its own
                `/tournaments/{ref}/qr.png`, the same code the Detalji tab
                shows). */}
            <Box className="print-only-flex rules-letterhead">
                <Flex className="rules-lh-brand" align="center" gap="2">
                    <img src={brand.symbolLightSvg} alt="" width="26" height="26" style={{ display: "block" }} />
                    <Text fontFamily="heading" fontWeight="bold" fontSize="md" letterSpacing="-0.02em" flexShrink={0}>{siteName}</Text>
                </Flex>
                <Text as="h3" className="rules-lh-title" fontFamily="heading" fontWeight="bold">
                    {tournament ? t("legal.rules.tournament.title") : t("legal.rules.title")}
                </Text>
                <Flex className="rules-lh-qr" justify="flex-end">
                    <img
                        src={tournament?.qrRef ? tournamentQrImageUrl(tournament.qrRef, 256) : siteQrImageUrl(256)}
                        alt=""
                        width="64"
                        height="64"
                        style={{ display: "block" }}
                    />
                </Flex>
            </Box>
            {/* On a tournament's own tab nothing sits above the settings on screen
                (owner, 2026-10-03: the sidebar already names the tournament and the
                tab is called "Pravila"); the block is `print-only` there, so the
                printed sheet still carries the tournament's name and date. */}
            <Box className={tournament ? "rules-titleblock print-only" : "rules-titleblock"}>
                <Heading className="rules-h1" size="xl" mb="2">{tournament ? t("legal.rules.tournament.title") : t("legal.rules.title")}</Heading>
                {tournament && (
                    // In flow (not in the fixed letterhead) so the name can be big and wrap.
                    // An h2 on purpose: the print sheet shrinks every <p>/<span> to 8.6pt.
                    <Box mb="2">
                        <Text as="h2" fontFamily="heading" fontWeight="bold" fontSize="xl" lineHeight="1.2" letterSpacing="-0.015em" overflowWrap="anywhere">
                            {tournament.name}
                        </Text>
                        {tournament.subtitle && (
                            <Text fontSize="sm" color="fg.muted" mt="0.5">{tournament.subtitle}</Text>
                        )}
                        {/* The place on a line of its own, size-limited so a long
                            address wraps (max two lines) instead of running under
                            the QR code (2026-10-03, owner). */}
                        {tournament.location && (
                            <Text className="rules-location" fontSize="sm" color="fg.muted" maxW="62%" lineClamp={2}>
                                {tournament.location}
                            </Text>
                        )}
                    </Box>
                )}
                <Text className="no-print" color="fg.muted" fontSize="sm" maxW="60ch">
                    {tournament ? t("legal.rules.tournament.intro") : t("legal.rules.intro")}
                </Text>
            </Box>

            {/* The numbers people actually come to check — "dokle se igra" — and
                the print button, in ONE row that stays pinned under the navbar
                while the rules scroll past (2026-10-03, owner). The opaque
                canvas fill keeps the text from showing through. In print the
                button is hidden and the tiles are the strip under the
                letterhead. */}
            <Flex
                className="rules-sticky"
                position={sticky ? "sticky" : "static"}
                top={sticky ? CONTENT_STICKY_TOP : undefined}
                zIndex={5}
                bg={sticky ? "bg.canvas" : "transparent"}
                pt={{ base: "2", md: tournament ? "0" : "2" }}
                pb="2"
                gap="2"
                // Phone: the download button is one more cell of the tiles grid
                // (below); md+: it sits beside the grid, stretched to its height.
                direction={{ base: "column", md: "row" }}
                align="stretch"
                // `CONTENT_STICKY_TOP` leaves the 24px of container padding between
                // the navbar and this row, and cards scrolled up into that strip
                // showed through it. The pseudo-element paints the same canvas
                // fill up to the navbar's edge (2026-10-03, owner).
                _before={sticky ? {
                    content: '""',
                    position: "absolute",
                    left: "0",
                    right: "0",
                    top: "-24px",
                    height: "24px",
                    bg: "bg.canvas",
                } : undefined}
            >
                <SimpleGrid className="rules-glance" data-n={glanceKeys.length} columns={{ base: 2, md: Math.ceil(glanceKeys.length / 2) }} gap="2" flex="1" minW="0">
                    {glanceKeys.map((key) => (
                        <Box key={key} borderWidth="1px" borderColor="border.subtle" bg="bg.panel" rounded="lg" px="3" py="1.5" minW="0">
                            <Text fontSize="2xs" color="fg.muted" textTransform="uppercase" letterSpacing="0.04em" truncate>
                                {t(`legal.rules.glance.${key}`)}
                            </Text>
                            <Text fontSize="md" fontWeight="bold" fontFamily="heading" lineHeight="1.2" truncate>
                                {glanceValue[key]}
                            </Text>
                        </Box>
                    ))}
                    {/* Phone twin of the button: the next cell after the last tile
                        (full row when the tile count is even). Not a tile — no-print,
                        hidden from md up, and outside `data-n`. */}
                    <Button
                        className="no-print"
                        display={{ base: "flex", md: "none" }}
                        gridColumn={{ base: glanceKeys.length % 2 === 0 ? "1 / -1" : "auto", md: "auto" }}
                        h="auto"
                        minH="44px"
                        rounded="lg"
                        variant="outline"
                        borderColor="border.subtle"
                        bg="bg.panel"
                        disabled={busy}
                        onClick={downloadPdf}
                    >
                        {busy ? <Spinner size="sm" /> : <><FiDownload /> {t("legal.rules.download")}</>}
                    </Button>
                    {onEdit && (
                        <Button
                            className="no-print"
                            display={{ base: "flex", md: "none" }}
                            gridColumn={{ base: (glanceKeys.length + 1) % 2 === 0 ? "1 / -1" : "auto", md: "auto" }}
                            h="auto"
                            minH="44px"
                            rounded="lg"
                            variant="outline"
                            borderColor="border.subtle"
                            bg="bg.panel"
                            onClick={onEdit}
                        >
                            <FiEdit2 /> {t("legal.rules.edit")}
                        </Button>
                    )}
                </SimpleGrid>
                {/* Desktop: the two actions to the right of the tiles, stacked so
                    they span both tile rows. "Uredi" only for the organiser/admin. */}
                <Flex className="no-print" display={{ base: "none", md: "flex" }} direction="column" gap="2" alignSelf="stretch">
                    {onEdit && (
                        <Button flex="1" minH="44px" variant="outline" onClick={onEdit}>
                            <FiEdit2 /> {t("legal.rules.edit")}
                        </Button>
                    )}
                    <Button flex="1" minH="44px" variant="outline" disabled={busy} onClick={downloadPdf}>
                        {busy ? <Spinner size="sm" /> : <><FiDownload /> {t("legal.rules.download")}</>}
                    </Button>
                </Flex>
            </Flex>

            {/* Print is ALWAYS exactly two A4 sheets with a fixed split (2026-10-03,
                owner): sheet 1 = Igra i bodovanje, Dijeljenje karata, Zvanje
                aduta, Tijek turnira; sheet 2 = Zvanja, Ponašanje za stolom,
                Prekršaji i kazne. Each sheet is two equal columns whose bottoms
                line up. The DOM is `.rules-columns > .rules-sheet > .rules-col >
                .rules-item`; on screen every wrapper is `display: contents` and
                each card carries an `order`, so the page is still ONE column in
                the original reading order (game, deal, trump, declarations,
                fouls, tournament, conduct). A section the organiser emptied is
                left out. */}
            <Box className="rules-columns" display="flex" flexDirection="column" gap="5">
                <Box className="rules-sheet" display="contents">
                <Box className="rules-col" display="contents">
                {sections.game.length > 0 && (
                <Box className="rules-item" order={1}>
                <SectionCard icon={<FiFlag />} title={t("legal.rules.game.heading")}>
                    <RuleList items={sections.game} />
                </SectionCard>
                </Box>
                )}
                {sections.deal.length > 0 && (
                <Box className="rules-item" order={2}>
                <SectionCard icon={<FiShuffle />} title={t("legal.rules.deal.heading")}>
                    <RuleList items={sections.deal} />
                </SectionCard>
                </Box>
                )}
                </Box>
                <Box className="rules-col" display="contents">
                <Box className="rules-item" order={3}>
                <SectionCard icon={<FiLayers />} title={t("legal.rules.trump.heading")}>
                    <VStack align="stretch" gap="4">
                        {sections.trump.length > 0 && <RuleList items={sections.trump} />}
                        <SimpleGrid className="rules-suits" columns={{ base: 2, md: 4 }} gap="2">
                            {SUITS.map((suit) => (
                                <HStack key={suit.key} gap="2.5" borderWidth="1px" borderColor="border.subtle" rounded="l2" px="3" py="2">
                                    <DeckSuitIcon suit={suit.suit} deck="moderne" size={28} />
                                    <Text fontSize="sm" fontWeight="semibold" minW="0">
                                        {t(`legal.rules.trump.suit.${suit.key}`)}
                                    </Text>
                                </HStack>
                            ))}
                        </SimpleGrid>
                    </VStack>
                </SectionCard>
                </Box>
                {sections.tour.length > 0 && (
                <Box className="rules-item" order={6}>
                <SectionCard icon={<FiClock />} title={t("legal.rules.tour.heading")}>
                    <RuleList items={sections.tour} />
                </SectionCard>
                </Box>
                )}
                </Box>
                </Box>
                <Box className="rules-sheet" display="contents">
                <Box className="rules-col" display="contents">
                <Box className="rules-item" order={4}>
                <SectionCard icon={<FiAward />} title={t("legal.rules.decl.heading")}>
                    <VStack align="stretch" gap="3">
                        {(declRows.length > 0 || sections.decl.length > 0) && (
                        <Grid
                            className="rules-decl-grid"
                            templateColumns={{ base: "1fr", md: declRows.length > 0 && sections.decl.length > 0 ? "minmax(0, 5fr) minmax(0, 7fr)" : "1fr" }}
                            gap="5"
                            alignItems="start"
                        >
                            {declRows.length > 0 && (
                            <TwoColumnTable head={[t("legal.rules.decl.table.what"), t("legal.rules.decl.table.points")]}>
                                {declRows.map((row) => (
                                    <TableRow key={row.key} label={t(`legal.rules.decl.v.${row.key}`)}>
                                        <Text fontSize="sm" fontWeight="bold" fontFamily="mono" color="brand.fg">
                                            {row.valueKey ? t(`legal.rules.decl.v.${row.valueKey}`) : row.points}
                                        </Text>
                                    </TableRow>
                                ))}
                            </TwoColumnTable>
                            )}
                            {sections.decl.length > 0 && <RuleList items={sections.decl} />}
                        </Grid>
                        )}
                    </VStack>
                </SectionCard>
                </Box>
                {sections.conduct.length > 0 && (
                <Box className="rules-item" order={7}>
                <SectionCard icon={<FiUsers />} title={t("legal.rules.conduct.heading")}>
                    <RuleList items={sections.conduct} />
                </SectionCard>
                </Box>
                )}
                </Box>
                <Box className="rules-col" display="contents">
                {fouls.length > 0 && (
                <Box className="rules-item" order={5}>
                <SectionCard icon={<FiAlertTriangle />} title={t("legal.rules.foul.heading")} description={t("legal.rules.foul.intro")}>
                    <TwoColumnTable head={[t("legal.rules.foul.table.what"), t("legal.rules.foul.table.penalty")]}>
                        {fouls.map((row) => (
                            <TableRow key={row.id} label={row.text}>
                                <Box
                                    px="2.5"
                                    py="1"
                                    rounded="xl"
                                    fontSize="xs"
                                    fontWeight="semibold"
                                    lineHeight="1.25"
                                    whiteSpace="pre-line"
                                    textAlign="right"
                                    maxW={{ base: "150px", md: "none" }}
                                    bg={PENALTY_TONE[row.penalty].bg}
                                    color={PENALTY_TONE[row.penalty].fg}
                                >
                                    {/* "Upozorenje, zatim pisanje partije" on two lines — the comma is
                                        the break (2026-10-03, owner). */}
                                    {t(`legal.rules.foul.penalty.${PENALTY_LABEL_KEY[row.penalty]}`).replace(/, /, ",\n")}
                                </Box>
                            </TableRow>
                        ))}
                    </TwoColumnTable>
                </SectionCard>
                </Box>
                )}
                </Box>
                </Box>
            </Box>

            {/* Last line of the page, and of the printed sheet (pinned to the
                bottom edge in print): paying the entry fee accepts these rules. */}
            <Text className="rules-notice" textAlign="center" fontSize="sm" fontWeight="bold" color="fg" pt="3">
                {t("legal.rules.printNotice")}
            </Text>
        </VStack>
    )
}
