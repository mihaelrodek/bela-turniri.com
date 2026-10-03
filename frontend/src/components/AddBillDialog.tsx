import { useMemo, useState } from "react"
import {
    Box,
    Button,
    Dialog,
    HStack,
    IconButton,
    Input,
    NativeSelect,
    Portal,
    Text,
    VStack,
    chakra,
} from "@chakra-ui/react"
import { FiPlus, FiX } from "react-icons/fi"
import type { WaiterBillRowDto } from "../api/waiterAccess"
import { useTranslation } from "../i18n"

/* ──────────────────────────────────────────────────────────────────────────
   AddBillDialog — "+ Dodaj račun" (2026-10-03).

   Two ways in, one dialog:
   • "Za stol" — pick a Runda and a Stol and open THAT table's bill. No row is
     created: every non-BYE match already has a bill and is already in the
     list, so this is just a quick way to reach it. The pickers are built from
     the list itself, which is exactly why a round or table that is not in the
     list (a BYE, a round with no real match) cannot be chosen — there is
     nothing to bill there. Rounds newest first, because the round being played
     is the one the bar is serving.
   • "Ostalo" — a standalone bill tied to no match (spectators, organisers,
     anyone not playing cards), with an optional name. The parent creates it
     and opens it in the usual bill dialog.

   With no match lines yet (no round drawn) only "Ostalo" is offered, with the
   reason spelled out, rather than an empty pair of dropdowns.
   ────────────────────────────────────────────────────────────────────── */

type Mode = "table" | "other"

export default function AddBillDialog({
    open,
    onClose,
    rows,
    busy,
    onPickMatch,
    onCreateExtra,
}: {
    open: boolean
    onClose: () => void
    /** The current bill list; only its MATCH lines feed the pickers. */
    rows: WaiterBillRowDto[]
    busy: boolean
    onPickMatch: (row: WaiterBillRowDto) => void
    /** Resolves once the bill exists and the parent has opened it. */
    onCreateExtra: (label: string) => Promise<void>
}) {
    const { t } = useTranslation()

    const matchRows = useMemo(
        () => rows.filter((r) => r.kind !== "EXTRA" && r.matchId != null && r.roundNumber != null),
        [rows],
    )
    const rounds = useMemo(
        () => [...new Set(matchRows.map((r) => r.roundNumber as number))].sort((a, b) => b - a),
        [matchRows],
    )
    const hasTables = rounds.length > 0

    const [modeChoice, setModeChoice] = useState<Mode>("table")
    const mode: Mode = hasTables ? modeChoice : "other"
    const [roundChoice, setRoundChoice] = useState<number | null>(null)
    const round = roundChoice != null && rounds.includes(roundChoice) ? roundChoice : (rounds[0] ?? null)
    const tables = useMemo(
        () => matchRows
            .filter((r) => r.roundNumber === round)
            .sort((a, b) => (a.tableNo ?? 0) - (b.tableNo ?? 0)),
        [matchRows, round],
    )
    const [matchChoice, setMatchChoice] = useState<number | null>(null)
    const picked = tables.find((r) => r.matchId === matchChoice) ?? tables[0] ?? null
    const [label, setLabel] = useState("")

    const tableText = (r: WaiterBillRowDto) => {
        const base = r.tableNo != null
            ? t("tournament.table", { n: r.tableNo })
            : t("tournament.bracket.bye")
        return r.paid ? t("tournament.waiter.extra.tablePaid", { table: base }) : base
    }

    return (
        <Dialog.Root
            open={open}
            onOpenChange={(e) => { if (!e.open && !busy) onClose() }}
            placement="center"
        >
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW={{ base: "92%", md: "sm" }}>
                        <Dialog.Header>
                            <HStack justify="space-between" align="start" w="full">
                                <Dialog.Title fontSize="md">
                                    {t("tournament.waiter.extra.dialogTitle")}
                                </Dialog.Title>
                                <Dialog.CloseTrigger asChild>
                                    <IconButton aria-label={t("common.close")} variant="ghost" size="sm" disabled={busy}>
                                        <FiX />
                                    </IconButton>
                                </Dialog.CloseTrigger>
                            </HStack>
                        </Dialog.Header>

                        <Dialog.Body>
                            <VStack align="stretch" gap="3">
                                {hasTables ? (
                                    <HStack gap="2">
                                        <Button
                                            size="xs"
                                            flex="1"
                                            variant={mode === "table" ? "solid" : "outline"}
                                            colorPalette="blue"
                                            onClick={() => setModeChoice("table")}
                                        >
                                            {t("tournament.waiter.extra.modeTable")}
                                        </Button>
                                        <Button
                                            size="xs"
                                            flex="1"
                                            variant={mode === "other" ? "solid" : "outline"}
                                            colorPalette="blue"
                                            onClick={() => setModeChoice("other")}
                                        >
                                            {t("tournament.waiter.extra.modeOther")}
                                        </Button>
                                    </HStack>
                                ) : (
                                    <Text fontSize="sm" color="fg.muted">
                                        {t("tournament.waiter.extra.noTables")}
                                    </Text>
                                )}

                                {mode === "table" ? (
                                    <HStack gap="3" align="end">
                                        <Box flex="1">
                                            <FieldLabel htmlFor="add-bill-round">
                                                {t("tournament.waiter.extra.round")}
                                            </FieldLabel>
                                            <NativeSelect.Root size="sm">
                                                <NativeSelect.Field
                                                    id="add-bill-round"
                                                    value={round ?? ""}
                                                    onChange={(e) => {
                                                        setRoundChoice(Number(e.target.value))
                                                        setMatchChoice(null)
                                                    }}
                                                >
                                                    {rounds.map((n) => (
                                                        <option key={n} value={n}>
                                                            {t("tournament.round.heading", { n })}
                                                        </option>
                                                    ))}
                                                </NativeSelect.Field>
                                                <NativeSelect.Indicator />
                                            </NativeSelect.Root>
                                        </Box>
                                        <Box flex="1">
                                            <FieldLabel htmlFor="add-bill-table">
                                                {t("tournament.waiter.extra.table")}
                                            </FieldLabel>
                                            <NativeSelect.Root size="sm">
                                                <NativeSelect.Field
                                                    id="add-bill-table"
                                                    value={picked?.matchId ?? ""}
                                                    onChange={(e) => setMatchChoice(Number(e.target.value))}
                                                >
                                                    {tables.map((r) => (
                                                        <option key={r.matchId as number} value={r.matchId as number}>
                                                            {tableText(r)}
                                                        </option>
                                                    ))}
                                                </NativeSelect.Field>
                                                <NativeSelect.Indicator />
                                            </NativeSelect.Root>
                                        </Box>
                                    </HStack>
                                ) : (
                                    <Box>
                                        <FieldLabel htmlFor="add-bill-label">
                                            {t("tournament.waiter.extra.label")}
                                        </FieldLabel>
                                        <Input
                                            id="add-bill-label"
                                            size="sm"
                                            value={label}
                                            onChange={(e) => setLabel(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault()
                                                    if (!busy) void onCreateExtra(label)
                                                }
                                            }}
                                            placeholder={t("tournament.waiter.extra.labelPlaceholder")}
                                            maxLength={60}
                                            disabled={busy}
                                        />
                                    </Box>
                                )}
                            </VStack>
                        </Dialog.Body>

                        <Dialog.Footer gap="2">
                            <Button variant="ghost" onClick={onClose} disabled={busy}>
                                {t("common.cancel")}
                            </Button>
                            {mode === "table" ? (
                                <Button
                                    colorPalette="blue"
                                    disabled={!picked}
                                    onClick={() => { if (picked) onPickMatch(picked) }}
                                >
                                    {t("tournament.waiter.extra.openTable")}
                                </Button>
                            ) : (
                                <Button
                                    colorPalette="blue"
                                    loading={busy}
                                    disabled={busy}
                                    onClick={() => void onCreateExtra(label)}
                                >
                                    <FiPlus /> {t("tournament.waiter.extra.create")}
                                </Button>
                            )}
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    )
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
    return (
        <chakra.label
            htmlFor={htmlFor}
            display="block"
            mb="1"
            fontSize="2xs"
            fontWeight="semibold"
            color="fg.muted"
            letterSpacing="wider"
            textTransform="uppercase"
        >
            {children}
        </chakra.label>
    )
}
