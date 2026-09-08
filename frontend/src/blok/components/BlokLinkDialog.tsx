import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
    Badge,
    Box,
    Button,
    Dialog,
    Field,
    HStack,
    Input,
    Portal,
    Spinner,
    Text,
    VStack,
} from "@chakra-ui/react"
import { FiAlertCircle, FiInfo, FiLink2, FiLogIn } from "react-icons/fi"

import EmptyState from "../../components/EmptyState"
import { hasTranslation, useTranslation } from "../../i18n"
import { fetchTournaments } from "../../api/tournaments"
import type { TournamentCard } from "../../types/tournaments"
import { formatDateCompact } from "../../utils/format"
import {
    blokLinkErrorCode,
    createdBlokLink,
    fetchBlokLinkTargets,
    requestBlokLink,
    type BlokLinkPairDto,
    type BlokLinkTargetDto,
} from "../blokLinkApi"
import type { BlokLink } from "../types"

/** §7.1's bounds on the typed name, checked here so the button can say why. */
const NAME_MIN = 2
const NAME_MAX = 60

/* ──────────────────────────────────────────────────────────────────────────
   BlokLinkDialog — the three steps of BLOK-LINK.md §3.4: which tournament,
   which table, which side is which pair.

   WHY THE THIRD STEP EXISTS
   ─────────────────────────
   It is the one that looks skippable and is not. The blok only ever knows
   "MI" and "VI"; the match knows `pair1` and `pair2`. Without the player
   saying which is which, the organiser receives a pair of numbers with no
   indication of whose they are — and a swapped score is worse than no score,
   because it looks right. The mapping is fixed at request time and never
   edited afterwards (§1): a wrong pick is fixed by breaking the link.

   NO REACT-QUERY HERE, ON PURPOSE
   ───────────────────────────────
   Both reads are authenticated and short-lived, and the app's query client
   persists public entries to localStorage. Putting a signed-in player's list
   of tournament tables through it would mean either polluting that cache or
   editing the persister's key allowlist — for two requests that happen once,
   inside a dialog nobody keeps open. Plain state and one effect.

   NOT SIGNED IN — NO LONGER A WALL (§7)
   ─────────────────────────────────────
   This dialog used to open on "Za povezivanje je potrebna prijava" and a
   button to the login page. It does not any more: it opens straight into the
   list of tournaments, account or no account. What sign-in was doing was
   telling the server WHO may write into a match; a signed-out request proves
   that with the write token the server hands back once instead (§7.1), and the
   organiser's approval — which never moved — remains the actual defence.

   Two things follow, and both are visible in the last step:

     - a signed-out request carries a TYPED NAME. The organiser approves a
       person, and "someone at some table" is not a person. Required, 2–60
       characters, and absent entirely when there is an account, because then
       the account already names them;
     - what signing in still buys is said ONCE, as a gain and not a warning
       (§7.2): the public logbook of the series, and the link to it in the
       organiser's bracket. Signed out the score still reaches the organiser —
       only the record does not exist.

   WHAT THE TOP LINE IS FOR
   ────────────────────────
   Above every step stands one sentence: this is only used at tournaments. It
   is there because the blok's own home is a kitchen table, and a scorepad
   there has no table in any round to link to. Without that line the menu item
   reads as a feature somebody is missing out on.
   ────────────────────────────────────────────────────────────────────── */

type Step =
    | { kind: "tournament" }
    | { kind: "table"; tournament: TournamentCard }
    | { kind: "side"; tournament: TournamentCard; target: BlokLinkTargetDto }

/** A loaded list, an error, or neither yet. One shape for both reads. */
type Load<T> =
    | { state: "loading" }
    | { state: "ready"; items: T[] }
    | { state: "error" }

/** Contract code → sentence, when we have one; otherwise a generic line. */
function codeMessage(prefix: string, code: string | null, fallbackKey: string): string {
    if (code !== null && hasTranslation(`blok.${prefix}.${code}`)) return `blok.${prefix}.${code}`
    return fallbackKey
}

/** "Stol 4" / "Bez broja stola" — `tableNo` is nullable on the wire. */
function useTableLabel() {
    const { t } = useTranslation()
    return (tableNo: number | null) =>
        tableNo === null ? t("blok.link.tableUnknown") : t("blok.link.table", { n: tableNo })
}

export default function BlokLinkDialog({
    open,
    signedIn,
    usName,
    themName,
    sessionId,
    onClose,
    onLinked,
}: {
    open: boolean
    /**
     * From `AuthContext` — never read Firebase directly (project rule).
     *
     * Since §7 this gates NOTHING. It only decides two details of the last
     * step: whether a name has to be typed, and which of the two sentences
     * about the public logbook is the true one.
     */
    signedIn: boolean
    /** The local side names, so step three asks in the player's own words. */
    usName: string
    themName: string
    /**
     * The series being played (BLOK-LINK.md §6.2). Linking is consent for this
     * series' logbook to be public, so the server is told which record that is
     * at request time — the same id every later score push carries.
     */
    sessionId: string
    onClose: () => void
    onLinked: (link: BlokLink) => void
}) {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const tableLabel = useTableLabel()

    const [step, setStep] = useState<Step>({ kind: "tournament" })
    const [tournaments, setTournaments] = useState<Load<TournamentCard>>({ state: "loading" })
    const [targets, setTargets] = useState<Load<BlokLinkTargetDto>>({ state: "loading" })
    const [usPairId, setUsPairId] = useState<number | null>(null)
    // Only ever sent when there is no account (§7.1). Kept in the dialog rather
    // than in the store: it is one line typed once per request, not a setting.
    const [name, setName] = useState("")
    const [busy, setBusy] = useState(false)
    const [submitError, setSubmitError] = useState<string | null>(null)
    // Bumped by the retry buttons so the load effects re-run without having to
    // null the list out first (which would flash an empty state on a retry).
    const [reload, setReload] = useState(0)

    /* A fresh dialog every time it opens: a half-finished pick from the last
       time it was dismissed must not be waiting behind the backdrop. */
    useEffect(() => {
        if (!open) return
        setStep({ kind: "tournament" })
        setUsPairId(null)
        setName("")
        setBusy(false)
        setSubmitError(null)
        // `reload` is deliberately NOT bumped here: `open` is already a
        // dependency of the load effect below, so bumping it would fire the
        // same request twice on every open.
    }, [open])

    /* Step one's list. `fetchTournaments("upcoming")` is exactly the DRAFT +
       STARTED bucket the contract asks for — the backend's other bucket is
       explicit FINISHED — so there is no client-side status filter to drift. */
    useEffect(() => {
        if (!open || step.kind !== "tournament") return
        let cancelled = false
        setTournaments({ state: "loading" })
        fetchTournaments("upcoming")
            .then((items) => {
                if (!cancelled) setTournaments({ state: "ready", items })
            })
            .catch(() => {
                if (!cancelled) setTournaments({ state: "error" })
            })
        return () => {
            cancelled = true
        }
    }, [open, step.kind, reload])

    const tournamentUuid = step.kind === "tournament" ? null : step.tournament.uuid

    useEffect(() => {
        if (!open || tournamentUuid === null) return
        let cancelled = false
        setTargets({ state: "loading" })
        fetchBlokLinkTargets(tournamentUuid)
            .then((items) => {
                if (!cancelled) setTargets({ state: "ready", items })
            })
            .catch(() => {
                if (!cancelled) setTargets({ state: "error" })
            })
        return () => {
            cancelled = true
        }
    }, [open, tournamentUuid, reload])

    /* The typed name is required exactly when there is no account (§7.1), and
       trimmed before it is measured — three spaces are not a signature. */
    const trimmedName = name.trim()
    const nameOk = signedIn || (trimmedName.length >= NAME_MIN && trimmedName.length <= NAME_MAX)

    const submit = useCallback(async () => {
        if (step.kind !== "side" || usPairId === null || busy || !nameOk) return
        const { tournament, target } = step
        const usPair = target.pair1.id === usPairId ? target.pair1 : target.pair2
        const themPair = target.pair1.id === usPairId ? target.pair2 : target.pair1
        if (!usPair || !themPair) return

        setBusy(true)
        setSubmitError(null)
        try {
            const dto = await requestBlokLink({
                matchId: target.matchId,
                usPairId,
                sessionId,
                // Omitted entirely when signed in: the account already names
                // the requester, and a second self-declared name would only
                // invite a different one.
                ...(signedIn ? {} : { requestedByName: trimmedName }),
            })
            // Everything the server did not echo comes from what the player
            // just chose — see `createdBlokLink` for the merge rule, and
            // `BlokLinkDto` for why those fields are optional on the wire.
            onLinked(createdBlokLink(dto, {
                tournamentUuid: tournament.uuid,
                tournamentName: tournament.name,
                roundNumber: target.roundNumber,
                tableNo: target.tableNo,
                matchId: target.matchId,
                usPairId: usPair.id,
                usPairName: usPair.name,
                themPairName: themPair.name,
            }))
            onClose()
        } catch (err) {
            // 400/409 are silenced in the API module precisely so the bare
            // contract code becomes a sentence here instead of a raw toast.
            setSubmitError(codeMessage("link.error", blokLinkErrorCode(err), "blok.link.error.generic"))
        } finally {
            setBusy(false)
        }
    }, [step, usPairId, busy, nameOk, signedIn, trimmedName, sessionId, onLinked, onClose])

    const stepTitle =
        step.kind === "tournament"
            ? "blok.link.step.tournament"
            : step.kind === "table"
                ? "blok.link.step.table"
                : "blok.link.step.side"

    return (
        <Dialog.Root
            open={open}
            onOpenChange={(e) => { if (!e.open) onClose() }}
            placement="center"
            scrollBehavior="inside"
        >
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW={{ base: "92%", md: "md" }}>
                        <Dialog.Header>
                            <Dialog.Title>{t("blok.link.title")}</Dialog.Title>
                        </Dialog.Header>

                        <Dialog.Body>
                            <VStack gap="3" align="stretch">
                                {/* THE LINE THAT PREVENTS THE MISUNDERSTANDING
                                    (§7.3). It stands above every step, not just
                                    the first, because the person who needs it
                                    most is the one who opened this at home and
                                    is now staring at a list of tournaments they
                                    are not playing in. */}
                                <HStack
                                    gap="2"
                                    align="start"
                                    px="3"
                                    py="2"
                                    rounded="l2"
                                    bg="bg.subtle"
                                    borderWidth="1px"
                                    borderColor="border.subtle"
                                >
                                    <Box color="fg.muted" flexShrink="0" mt="0.5" display="flex" aria-hidden="true">
                                        <FiInfo size={14} />
                                    </Box>
                                    <Text fontSize="xs" color="fg.muted">
                                        {t("blok.link.tournamentsOnly")}
                                    </Text>
                                </HStack>

                                <Text fontSize="sm" color="fg.muted">
                                    {t(stepTitle)}
                                </Text>

                                {step.kind === "tournament" ? (
                                    <TournamentStep
                                        load={tournaments}
                                        onRetry={() => setReload((n) => n + 1)}
                                        onPick={(tournament) => setStep({ kind: "table", tournament })}
                                    />
                                ) : null}

                                {step.kind === "table" ? (
                                    <TableStep
                                        load={targets}
                                        tableLabel={tableLabel}
                                        onRetry={() => setReload((n) => n + 1)}
                                        onPick={(target) => {
                                            setUsPairId(null)
                                            setSubmitError(null)
                                            setStep({ kind: "side", tournament: step.tournament, target })
                                        }}
                                    />
                                ) : null}

                                {step.kind === "side" ? (
                                    <SideStep
                                        target={step.target}
                                        usName={usName}
                                        themName={themName}
                                        usPairId={usPairId}
                                        onPick={setUsPairId}
                                        errorKey={submitError}
                                        signedIn={signedIn}
                                        name={name}
                                        onName={setName}
                                        onSignIn={() => {
                                            onClose()
                                            // `next` brings them back to the
                                            // scorepad, not to a blank home page.
                                            navigate(`/prijava?next=${encodeURIComponent("/blok")}`)
                                        }}
                                    />
                                ) : null}
                            </VStack>
                        </Dialog.Body>

                        <Dialog.Footer gap="2">
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    if (step.kind === "side") {
                                        setStep({ kind: "table", tournament: step.tournament })
                                    } else if (step.kind === "table") {
                                        setStep({ kind: "tournament" })
                                    } else {
                                        onClose()
                                    }
                                }}
                            >
                                {step.kind === "tournament" ? t("common.cancel") : t("blok.link.back")}
                            </Button>
                            {step.kind === "side" ? (
                                <Button
                                    colorPalette="brand"
                                    loading={busy}
                                    // A missing name disables the send for the
                                    // same reason a missing side does: the
                                    // organiser cannot approve a request with
                                    // nobody's name on it (§7.1), so sending one
                                    // would only produce a 400.
                                    disabled={usPairId === null || !nameOk}
                                    onClick={() => { void submit() }}
                                >
                                    <FiLink2 /> {t("blok.link.send")}
                                </Button>
                            ) : null}
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    )
}

/* ─────────────────────────── shared bits ─────────────────────────── */

function Loading() {
    return (
        <HStack justify="center" py="6">
            <Spinner size="md" color="brand.solid" />
        </HStack>
    )
}

function LoadError({ onRetry }: { onRetry: () => void }) {
    const { t } = useTranslation()
    return (
        <EmptyState
            icon={FiAlertCircle}
            title={t("blok.link.loadFailed")}
            compact
            action={
                <Button size="sm" variant="outline" onClick={onRetry}>
                    {t("blok.link.retry")}
                </Button>
            }
        />
    )
}

/** One tappable row. `Box as="button"` is the project's pattern for a target
 *  that needs a hit area and a focus ring but not the button recipe's fill. */
function PickRow({
    onClick,
    disabled = false,
    children,
}: {
    onClick: () => void
    disabled?: boolean
    children: React.ReactNode
}) {
    return (
        <Box
            as="button"
            onClick={disabled ? undefined : onClick}
            // `aria-disabled` rather than `disabled`: Chakra's polymorphic
            // `Box` has no `disabled` prop, and a genuinely disabled button
            // drops out of the tab order — a player who cannot see the row is
            // then never told WHY the table is unavailable. This one stays
            // focusable, announces itself as disabled, and does nothing.
            aria-disabled={disabled || undefined}
            textAlign="start"
            w="100%"
            px="3"
            py="2.5"
            rounded="l3"
            borderWidth="1px"
            borderColor="border.subtle"
            bg="bg.subtle"
            opacity={disabled ? 0.55 : 1}
            cursor={disabled ? "not-allowed" : "pointer"}
            _hover={disabled ? undefined : { borderColor: "brand.emphasized", bg: "bg.panel" }}
            _focusVisible={{ outline: "2px solid", outlineColor: "brand.focusRing", outlineOffset: "1px" }}
        >
            {children}
        </Box>
    )
}

/* ─────────────────────────── step 1: tournament ─────────────────────────── */

function TournamentStep({
    load,
    onPick,
    onRetry,
}: {
    load: Load<TournamentCard>
    onPick: (tournament: TournamentCard) => void
    onRetry: () => void
}) {
    const { t } = useTranslation()
    if (load.state === "loading") return <Loading />
    if (load.state === "error") return <LoadError onRetry={onRetry} />
    if (load.items.length === 0) {
        return <EmptyState icon={FiLink2} title={t("blok.link.noTournaments")} compact />
    }

    return (
        <VStack gap="2" align="stretch">
            {load.items.map((tournament) => (
                <PickRow key={tournament.uuid} onClick={() => onPick(tournament)}>
                    <Text fontWeight="semibold" fontSize="sm" color="fg.ink" truncate>
                        {tournament.name}
                    </Text>
                    <Text fontSize="xs" color="fg.muted" truncate>
                        {[formatDateCompact(tournament.startAt), tournament.location]
                            .filter((part) => part && part !== "—")
                            .join(" · ")}
                    </Text>
                </PickRow>
            ))}
        </VStack>
    )
}

/* ─────────────────────────── step 2: table ─────────────────────────── */

function TableStep({
    load,
    tableLabel,
    onPick,
    onRetry,
}: {
    load: Load<BlokLinkTargetDto>
    tableLabel: (tableNo: number | null) => string
    onPick: (target: BlokLinkTargetDto) => void
    onRetry: () => void
}) {
    const { t } = useTranslation()
    if (load.state === "loading") return <Loading />
    if (load.state === "error") return <LoadError onRetry={onRetry} />
    if (load.items.length === 0) {
        return <EmptyState icon={FiLink2} title={t("blok.link.noTables")} compact />
    }

    return (
        <VStack gap="2" align="stretch">
            {load.items.map((target) => (
                <PickRow
                    key={target.matchId}
                    disabled={!target.linkable}
                    onClick={() => onPick(target)}
                >
                    <HStack justify="space-between" gap="2" mb="0.5">
                        <Text fontWeight="semibold" fontSize="sm" color="fg.ink">
                            {tableLabel(target.tableNo)}
                        </Text>
                        <Badge size="sm" variant="subtle" colorPalette="brand">
                            {t("blok.link.round", { n: target.roundNumber })}
                        </Badge>
                    </HStack>
                    <Text fontSize="xs" color="fg.muted">
                        {target.pair2
                            ? `${target.pair1.name} — ${target.pair2.name}`
                            : target.pair1.name}
                    </Text>
                    {!target.linkable ? (
                        <Text fontSize="xs" color="fg.subtle" mt="1">
                            {t(codeMessage("link.reason", target.reason ?? null, "blok.link.notLinkable"))}
                        </Text>
                    ) : null}
                </PickRow>
            ))}
        </VStack>
    )
}

/* ─────────────────────────── step 3: which side ─────────────────────────── */

function SideStep({
    target,
    usName,
    themName,
    usPairId,
    onPick,
    errorKey,
    signedIn,
    name,
    onName,
    onSignIn,
}: {
    target: BlokLinkTargetDto
    usName: string
    themName: string
    usPairId: number | null
    onPick: (id: number) => void
    errorKey: string | null
    signedIn: boolean
    name: string
    onName: (value: string) => void
    onSignIn: () => void
}) {
    const { t } = useTranslation()
    const trimmed = name.trim()
    // Only complain about a name that has been started and left too short —
    // an empty field on a step the player has just reached is not an error yet,
    // and the send button already says the request is not ready.
    const nameTooShort = trimmed.length > 0 && trimmed.length < NAME_MIN
    // A table with no second pair is a BYE and the backend refuses it, so the
    // picker never offers one — but the type is nullable and this component
    // must not render half a question if one ever slips through.
    const pairs: BlokLinkPairDto[] = target.pair2 ? [target.pair1, target.pair2] : [target.pair1]

    return (
        <VStack gap="2" align="stretch">
            <Text fontSize="sm" color="fg.muted">
                {t("blok.link.sideQuestion", { side: usName })}
            </Text>

            {signedIn ? (
                /* Said BEFORE the request goes out, not after: linking is
                   consent for this logbook to be public (BLOK-LINK.md §6.2),
                   and consent nobody was asked for is not consent. The
                   organiser's bracket gets a link to it, and anyone who is
                   given that link can read the whole series — including after
                   the tournament.

                   Signed out there IS no logbook (§7.2), so this sentence would
                   be describing something that will not happen. The line below
                   takes its place. */
                <Text fontSize="xs" color="fg.subtle">
                    {t("blok.link.publicNote")}
                </Text>
            ) : (
                /* §7.2, said once and as a GAIN: the score reaches the
                   organiser with or without an account — what an account adds
                   is the public record of the series and its link in the
                   bracket. So the sign-in sits here as a side action next to
                   the sentence, never as a step in front of it. */
                <HStack gap="2" align="center" justify="space-between" wrap="wrap">
                    <Text fontSize="xs" color="fg.subtle" flex="1" minW="12rem">
                        {t("blok.link.signedOutGain")}
                    </Text>
                    <Button size="xs" variant="ghost" colorPalette="brand" onClick={onSignIn}>
                        <FiLogIn /> {t("blok.link.signIn")}
                    </Button>
                </HStack>
            )}

            {!signedIn ? (
                <Field.Root required invalid={nameTooShort}>
                    <Field.Label>
                        {t("blok.link.nameLabel")}
                        <Field.RequiredIndicator />
                    </Field.Label>
                    <Input
                        value={name}
                        placeholder={t("blok.link.namePlaceholder")}
                        maxLength={NAME_MAX}
                        autoComplete="name"
                        onChange={(e) => onName(e.target.value)}
                    />
                    {nameTooShort ? (
                        <Field.ErrorText>{t("blok.link.nameTooShort")}</Field.ErrorText>
                    ) : (
                        <Field.HelperText>{t("blok.link.nameHelp")}</Field.HelperText>
                    )}
                </Field.Root>
            ) : null}

            {pairs.map((pair) => {
                const selected = usPairId === pair.id
                const other = pairs.find((p) => p.id !== pair.id)
                return (
                    <Box
                        as="button"
                        key={pair.id}
                        onClick={() => onPick(pair.id)}
                        aria-pressed={selected}
                        textAlign="start"
                        w="100%"
                        px="3"
                        py="2.5"
                        rounded="l3"
                        borderWidth="1px"
                        borderColor={selected ? "brand.solid" : "border.subtle"}
                        bg={selected ? "brand.subtle" : "bg.subtle"}
                        _focusVisible={{
                            outline: "2px solid",
                            outlineColor: "brand.focusRing",
                            outlineOffset: "1px",
                        }}
                    >
                        <Text
                            fontSize="sm"
                            fontWeight="semibold"
                            color={selected ? "brand.fg" : "fg.ink"}
                            truncate
                        >
                            {pair.name}
                        </Text>
                        {/* The consequence spelled out, both ways round: this
                            is the mapping the organiser will read the score
                            through, and it cannot be corrected later. */}
                        <Text fontSize="xs" color="fg.muted" truncate>
                            {t("blok.link.sideMapping", {
                                us: usName,
                                usPair: pair.name,
                                them: themName,
                                themPair: other?.name ?? "—",
                            })}
                        </Text>
                    </Box>
                )
            })}

            {errorKey ? (
                <HStack gap="2" align="start" color="red.fg" mt="1">
                    <Box flexShrink="0" mt="0.5" display="flex" aria-hidden="true">
                        <FiAlertCircle />
                    </Box>
                    <Text fontSize="sm">{t(errorKey)}</Text>
                </HStack>
            ) : null}
        </VStack>
    )
}
