import React from "react"
import { Badge, Box, Button, Card, Dialog, Heading, HStack, Skeleton, Text, VStack } from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { fetchMatchBill, fetchMyInvoices, type MatchBillDto, type UserInvoiceDto } from "../../api/cjenik"
import { qk } from "../../queryClient"
import { formatDate, formatEur } from "../../utils/format"
import { useTranslation } from "../../i18n"

/* ============================================================
   Invoice history — every bill the current user was a party to,
   across all tournaments they played in. Read-only; loads
   /user/me/invoices once via react-query. Only the profile owner sees
   this card (gated upstream by isOwner).
   ============================================================ */
export function InvoicesCard() {
    const { t } = useTranslation()
    const { data: invoicesData, isLoading: loading } = useQuery({
        queryKey: qk.myInvoices,
        queryFn: fetchMyInvoices,
    })
    const invoices = invoicesData ?? []
    // Modal state — the invoice the user tapped, plus the lazily-loaded
    // full bill (drinks list) so we can render line items.
    const [openInvoice, setOpenInvoice] = React.useState<UserInvoiceDto | null>(null)
    const [openBill, setOpenBill] = React.useState<MatchBillDto | null>(null)
    const [openBillLoading, setOpenBillLoading] = React.useState(false)

    const openDetail = async (inv: UserInvoiceDto) => {
        setOpenInvoice(inv)
        setOpenBill(null)
        setOpenBillLoading(true)
        try {
            const bill = await fetchMatchBill(inv.tournamentRef, inv.matchId)
            setOpenBill(bill)
        } catch {
            // Network/permission failure — modal still shows the summary
            // info from the invoice DTO; line items just won't appear.
            setOpenBill(null)
        } finally {
            setOpenBillLoading(false)
        }
    }

    return (
        <Card.Root variant="outline" rounded="xl" borderColor="border.emphasized" shadow="sm">
            <Card.Body p={{ base: "4", md: "5" }}>
                <VStack align="stretch" gap="3">
                    <Box>
                        <Heading size="sm">{t("profile.invoices.title")}</Heading>
                        <Text fontSize="xs" color="fg.muted">
                            {t("profile.invoices.description")}
                        </Text>
                    </Box>

                    {loading ? (
                        <VStack align="stretch" gap="2">
                            <Skeleton h="14" /><Skeleton h="14" />
                        </VStack>
                    ) : invoices.length === 0 ? (
                        <Text fontSize="sm" color="fg.muted">
                            {t("profile.invoices.empty")}
                        </Text>
                    ) : (
                        <VStack align="stretch" gap="2">
                            {invoices.map((inv) => (
                                <Box
                                    key={inv.matchId}
                                    borderWidth="1px"
                                    borderColor="border.emphasized"
                                    rounded="md"
                                    p="3"
                                    cursor="pointer"
                                    onClick={() => openDetail(inv)}
                                    _hover={{ borderColor: "blue.emphasized", bg: "bg.subtle" }}
                                >
                                    <HStack justify="space-between" align="start" gap="2">
                                        <Box flex="1" minW="0">
                                            <Text fontWeight="medium" truncate>
                                                {inv.tournamentName}
                                            </Text>
                                            <Text fontSize="xs" color="fg.muted">
                                                {inv.tournamentStartAt
                                                    ? formatDate(inv.tournamentStartAt)
                                                    : "—"}
                                                {inv.roundNumber != null
                                                    ? ` · ${t("profile.invoices.round", { n: inv.roundNumber })}`
                                                    : ""}
                                                {inv.tableNo != null
                                                    ? ` · ${t("profile.invoices.table", { n: inv.tableNo })}`
                                                    : ""}
                                            </Text>
                                            <Text fontSize="sm" mt="1" truncate>
                                                {inv.myPairName ?? "—"}{" "}
                                                <Text as="span" color="fg.muted">
                                                    {t("profile.vs")}
                                                </Text>{" "}
                                                {inv.opponentPairName ?? "—"}
                                            </Text>
                                        </Box>
                                        <VStack align="end" gap="1" flexShrink={0}>
                                            <Text fontWeight="bold">
                                                {formatEur(inv.total)}
                                            </Text>
                                            {inv.paidAt ? (
                                                <Badge colorPalette="green" size="sm">
                                                    {t("profile.invoices.paid")}
                                                </Badge>
                                            ) : inv.finished && inv.lost ? (
                                                <Badge colorPalette="orange" size="sm">
                                                    {t("profile.invoices.yourBill")}
                                                </Badge>
                                            ) : (
                                                <Badge colorPalette="gray" size="sm" variant="subtle">
                                                    {t("profile.invoices.open")}
                                                </Badge>
                                            )}
                                        </VStack>
                                    </HStack>
                                </Box>
                            ))}
                        </VStack>
                    )}
                </VStack>
            </Card.Body>

            {/* Detail modal — opens on row click. Shows the full bill
                (drinks + total + paid status). Doesn't navigate away
                from the profile. */}
            <Dialog.Root
                open={!!openInvoice}
                onOpenChange={(e) => {
                    if (!e.open) {
                        setOpenInvoice(null)
                        setOpenBill(null)
                    }
                }}
            >
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW="md">
                        <Dialog.Header>
                            <Text fontWeight="semibold" truncate>
                                {openInvoice?.tournamentName ?? t("profile.invoices.dialogTitleFallback")}
                            </Text>
                        </Dialog.Header>
                        <Dialog.Body>
                            {openInvoice && (
                                <VStack align="stretch" gap="3">
                                    {/* Summary row */}
                                    <Box>
                                        <Text fontSize="xs" color="fg.muted">
                                            {openInvoice.tournamentStartAt
                                                ? formatDate(openInvoice.tournamentStartAt)
                                                : "—"}
                                            {openInvoice.roundNumber != null
                                                ? ` · ${t("profile.invoices.round", { n: openInvoice.roundNumber })}`
                                                : ""}
                                            {openInvoice.tableNo != null
                                                ? ` · ${t("profile.invoices.table", { n: openInvoice.tableNo })}`
                                                : ""}
                                        </Text>
                                        <Text fontSize="sm" mt="1">
                                            <b>{openInvoice.myPairName ?? "—"}</b>{" "}
                                            <Text as="span" color="fg.muted">{t("profile.vs")}</Text>{" "}
                                            {openInvoice.opponentPairName ?? "—"}
                                        </Text>
                                    </Box>

                                    {/* Drinks line items */}
                                    {openBillLoading ? (
                                        <VStack align="stretch" gap="2">
                                            <Skeleton h="6" /><Skeleton h="6" />
                                        </VStack>
                                    ) : openBill && openBill.drinks.length > 0 ? (
                                        <VStack align="stretch" gap="1">
                                            {openBill.drinks.map((d) => (
                                                <HStack
                                                    key={d.id}
                                                    justify="space-between"
                                                    borderBottomWidth="1px"
                                                    borderColor="border.subtle"
                                                    py="1"
                                                >
                                                    <Text fontSize="sm">
                                                        {d.name}
                                                        {d.quantity > 1 && <> × {d.quantity}</>}
                                                    </Text>
                                                    <Text fontSize="sm" fontWeight="medium">
                                                        {formatEur(d.lineTotal)}
                                                    </Text>
                                                </HStack>
                                            ))}
                                        </VStack>
                                    ) : (
                                        <Text fontSize="sm" color="fg.muted">
                                            {t("profile.invoices.noDrinks")}
                                        </Text>
                                    )}

                                    {/* Total + status badges */}
                                    <HStack justify="space-between" pt="1">
                                        <Text fontWeight="semibold">{t("profile.invoices.total")}</Text>
                                        <Text fontWeight="bold" fontSize="md">
                                            {formatEur(openInvoice.total)}
                                        </Text>
                                    </HStack>

                                    <HStack gap="2" wrap="wrap">
                                        {openInvoice.paidAt ? (
                                            <Badge colorPalette="green">{t("profile.invoices.paid")}</Badge>
                                        ) : openInvoice.finished && openInvoice.lost ? (
                                            <Badge colorPalette="orange">{t("profile.invoices.yourBill")}</Badge>
                                        ) : (
                                            <Badge colorPalette="gray" variant="subtle">{t("profile.invoices.open")}</Badge>
                                        )}
                                        {openInvoice.finished && !openInvoice.lost && (
                                            <Badge colorPalette="blue" variant="subtle">{t("profile.invoices.win")}</Badge>
                                        )}
                                    </HStack>
                                </VStack>
                            )}
                        </Dialog.Body>
                        <Dialog.Footer>
                            <Button variant="ghost" onClick={() => setOpenInvoice(null)}>
                                {t("common.close")}
                            </Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Dialog.Root>
        </Card.Root>
    )
}
