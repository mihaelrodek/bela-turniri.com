import { useEffect, useState } from "react"
import {
    Badge,
    Box,
    Button,
    Dialog,
    HStack,
    IconButton,
    Spinner,
    Text,
    VStack,
} from "@chakra-ui/react"
import {
    type DrinkPriceDto,
    type MatchBillDto,
    fetchMatchBill,
    fetchTournamentCjenik,
    addMatchDrink,
    removeMatchDrink,
    markMatchPaid,
    markMatchUnpaid,
} from "../api/cjenik"
import { formatEur } from "./CjenikTab"

type Props = {
    tournamentRef: string
    matchId: number
    /** True if this is a BYE match (pair2 missing) — we skip rendering. */
    isBye: boolean
    /** True if match status is FINISHED. Drives 'Loser pays' label. */
    isFinished: boolean
    /** Already-known paidAt from MatchDto so we don't always fetch the bill. */
    paidAt?: string | null
    /** True for owner/admin — gates write actions and the trigger button. */
    canEdit: boolean
    /**
     * True if the current user submitted one of the two pairs in this
     * match. Participants can see their bill (running total during play
     * + paid status afterwards). Non-participants see nothing about the
     * bill — that's a privacy requirement.
     */
    isParticipant: boolean
    /**
     * Called after any mutation. Receives the fresh paidAt so the
     * parent can patch its match-list state without a full rounds refetch.
     */
    onChange?: (paidAt: string | null) => void
}

/**
 * Per-match drink-bill button.
 *
 *   Owner: shows "Računi (€X.YZ)" pill that opens a modal with full bill
 *          management — pick from cjenik to add a drink, remove a drink,
 *          mark paid / unpay.
 *   Non-owner: only renders if the bill is already paid — surfaces a
 *          "Plaćeno" badge so players can see the match got settled.
 *          BYE matches render nothing.
 */
export default function MatchBillButton({
    tournamentRef,
    matchId,
    isBye,
    isFinished,
    paidAt,
    canEdit,
    isParticipant,
    onChange,
}: Props) {
    const [open, setOpen] = useState(false)
    const [bill, setBill] = useState<MatchBillDto | null>(null)
    const [cjenik, setCjenik] = useState<DrinkPriceDto[]>([])
    const [loading, setLoading] = useState(false)
    const [busy, setBusy] = useState(false)

    // BYE matches have no opponent — there's no shared table to settle.
    if (isBye) return null

    // Privacy: only owner/bartender and players who were AT this table see
    // anything about the bill. Everyone else gets no badge, no button,
    // no peek at prices.
    if (!canEdit && !isParticipant) return null

    const refresh = async () => {
        setLoading(true)
        try {
            const [b, c] = await Promise.all([
                fetchMatchBill(tournamentRef, matchId),
                canEdit ? fetchTournamentCjenik(tournamentRef) : Promise.resolve([] as DrinkPriceDto[]),
            ])
            setBill(b)
            setCjenik(c)
        } finally {
            setLoading(false)
        }
    }

    const onOpen = async () => {
        setOpen(true)
        await refresh()
    }

    const handleAdd = async (priceId: number) => {
        setBusy(true)
        try {
            const fresh = await addMatchDrink(tournamentRef, matchId, priceId, 1)
            setBill(fresh)
            onChange?.(fresh.paidAt ?? null)
        } finally {
            setBusy(false)
        }
    }

    const handleRemove = async (drinkId: number) => {
        setBusy(true)
        try {
            const fresh = await removeMatchDrink(tournamentRef, matchId, drinkId)
            setBill(fresh)
            onChange?.(fresh.paidAt ?? null)
        } finally {
            setBusy(false)
        }
    }

    const handlePay = async () => {
        setBusy(true)
        try {
            const fresh = await markMatchPaid(tournamentRef, matchId)
            setBill(fresh)
            onChange?.(fresh.paidAt ?? null)
        } finally {
            setBusy(false)
        }
    }

    const handleUnpay = async () => {
        setBusy(true)
        try {
            const fresh = await markMatchUnpaid(tournamentRef, matchId)
            setBill(fresh)
            onChange?.(fresh.paidAt ?? null)
        } finally {
            setBusy(false)
        }
    }

    // ----- Trigger -----
    // Same control shape for owner and participants — just a tappable
    // chip that shows current status. The modal underneath gates
    // edit vs. read-only via `canEdit`.
    const isPaid = !!(bill?.paidAt ?? paidAt)
    const trigger = (
        <Button
            size="xs"
            variant={isPaid ? "outline" : "subtle"}
            colorPalette={isPaid ? "green" : "blue"}
            onClick={onOpen}
        >
            {isPaid ? "Plaćeno" : "Računi"}
        </Button>
    )

    return (
        <>
            {trigger}

            <Dialog.Root
                open={open}
                onOpenChange={(e) => { if (!e.open) setOpen(false) }}
            >
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW="md">
                        <Dialog.Header>
                            <HStack justify="space-between" w="100%">
                                <Text fontWeight="semibold">Računi za stol</Text>
                                {isPaid && (
                                    <Badge colorPalette="green" variant="subtle">Plaćeno</Badge>
                                )}
                            </HStack>
                        </Dialog.Header>
                        <Dialog.Body>
                            {loading || !bill ? (
                                <HStack justify="center" py="6">
                                    <Spinner size="sm" />
                                    <Text fontSize="sm" color="gray.500">Učitavanje…</Text>
                                </HStack>
                            ) : (
                                <BillBody
                                    bill={bill}
                                    cjenik={cjenik}
                                    isFinished={isFinished}
                                    canEdit={canEdit}
                                    busy={busy}
                                    onAdd={handleAdd}
                                    onRemove={handleRemove}
                                />
                            )}
                        </Dialog.Body>
                        <Dialog.Footer>
                            <Button
                                variant="ghost"
                                onClick={() => setOpen(false)}
                                disabled={busy}
                            >
                                Zatvori
                            </Button>
                            {canEdit && bill && (
                                isPaid ? (
                                    <Button
                                        colorPalette="gray"
                                        variant="outline"
                                        onClick={handleUnpay}
                                        loading={busy}
                                    >
                                        Poništi plaćeno
                                    </Button>
                                ) : (
                                    <Button
                                        colorPalette="green"
                                        onClick={handlePay}
                                        loading={busy}
                                        disabled={bill.drinks.length === 0}
                                    >
                                        Označi plaćeno
                                    </Button>
                                )
                            )}
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Dialog.Root>
        </>
    )
}

/* ============================================================
   Bill body — list of drinks + cjenik picker
   ============================================================ */

function BillBody({
    bill,
    cjenik,
    isFinished,
    canEdit,
    busy,
    onAdd,
    onRemove,
}: {
    bill: MatchBillDto
    cjenik: DrinkPriceDto[]
    isFinished: boolean
    canEdit: boolean
    busy: boolean
    onAdd: (priceId: number) => void
    onRemove: (drinkId: number) => void
}) {
    return (
        <VStack align="stretch" gap="3">
            {/* Loser banner: only after match finishes */}
            {isFinished && bill.loserPairName && (
                <Box
                    p="2.5"
                    rounded="md"
                    bg="orange.50"
                    borderWidth="1px"
                    borderColor="orange.200"
                >
                    <Text fontSize="sm">
                        <b>Plaća:</b> {bill.loserPairName}
                    </Text>
                </Box>
            )}

            {/* Drinks list */}
            {bill.drinks.length === 0 ? (
                <Text color="gray.500" fontSize="sm">Nema dodanih pića.</Text>
            ) : (
                <VStack align="stretch" gap="1">
                    {bill.drinks.map((d) => (
                        <HStack
                            key={d.id}
                            justify="space-between"
                            borderBottomWidth="1px"
                            borderColor="gray.100"
                            py="1"
                        >
                            <Text fontSize="sm">
                                {d.name}
                                {d.quantity > 1 && <> × {d.quantity}</>}
                            </Text>
                            <HStack gap="2">
                                <Text fontSize="sm" fontWeight="medium">
                                    {formatEur(d.lineTotal)}
                                </Text>
                                {/* Remove allowed only when bill isn't
                                    marked paid yet — same freeze rule the
                                    backend enforces. */}
                                {canEdit && !bill.paidAt && (
                                    <IconButton
                                        aria-label="Ukloni"
                                        size="2xs"
                                        variant="ghost"
                                        colorPalette="red"
                                        onClick={() => onRemove(d.id)}
                                        disabled={busy}
                                    >
                                        ×
                                    </IconButton>
                                )}
                            </HStack>
                        </HStack>
                    ))}
                </VStack>
            )}

            {/* Total */}
            <HStack justify="space-between" pt="1">
                <Text fontWeight="semibold">Ukupno</Text>
                <Text fontWeight="bold" fontSize="md">
                    {formatEur(bill.total)}
                </Text>
            </HStack>

            {/* Cjenik picker — owner only, when not yet paid */}
            {canEdit && !bill.paidAt && (
                <Box>
                    <Text fontSize="sm" color="gray.600" mb="2" mt="2">
                        Dodaj piće:
                    </Text>
                    {cjenik.length === 0 ? (
                        <Text fontSize="xs" color="gray.500">
                            Cjenik nije postavljen. Otvori tab “Cjenik” da dodaš
                            cijene pića.
                        </Text>
                    ) : (
                        <Box display="flex" flexWrap="wrap" gap="2">
                            {cjenik.map((p) => (
                                <Button
                                    key={p.id ?? p.name}
                                    size="xs"
                                    variant="outline"
                                    onClick={() => p.id != null && onAdd(p.id)}
                                    disabled={busy || p.id == null}
                                >
                                    {p.name} · {formatEur(p.price as any)}
                                </Button>
                            ))}
                        </Box>
                    )}
                </Box>
            )}
        </VStack>
    )
}
