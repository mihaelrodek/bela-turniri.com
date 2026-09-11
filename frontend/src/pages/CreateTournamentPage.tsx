import React, { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { isAxiosError } from "axios"
import {
    Box,
    Button,
    Card,
    chakra,
    Field,
    HStack,
    IconButton,
    Input,
    NativeSelect,
    RadioGroup,
    Text,
    Textarea,
    VStack,
} from "@chakra-ui/react"
import {
    FiCopy,
    FiDollarSign,
    FiGift,
    FiImage,
    FiPhone,
    FiX,
} from "react-icons/fi"
import DatePicker, { registerLocale } from "react-datepicker"
import { hr, sl } from "date-fns/locale"
import "react-datepicker/dist/react-datepicker.css"
import "../datepicker.css"

import { createTournament } from "../api/tournaments"
import { CONTENT_STICKY_TOP } from "../components/navChrome"
import { LocationAutocomplete } from "../components/LocationAutocomplete"
import LoadTournamentTemplateDialog from "../components/LoadTournamentTemplateDialog"
import LocationMapPicker from "../components/LocationMapPicker"
import PerPairHint from "../components/PerPairHint"
import SuffixInput from "../components/SuffixInput"
import TournamentReviewCard, { type ReviewRow } from "../components/TournamentReviewCard"
import WizardStepper from "../components/WizardStepper"
import { useMyProfile } from "../hooks/useMyProfile"
import { useAuth } from "../auth/authContextValue"
import { showError, showSuccess } from "../toaster"
import { useTranslation, usePlural } from "../i18n"
import {
    formatDateTime,
    moneyToNumber,
    numberToMoneyStr,
    pad2 as pad,
    parseMoneyLoose,
    sanitizeInt,
    sanitizeMoney,
    toLocalOffsetIso,
} from "../utils/format"
import { PHONE_COUNTRIES, joinPhone, sanitizePhone } from "../utils/phone"
import {
    type TournamentForm,
    emptyTournamentForm,
    nowTime,
    todayDate,
    tournamentFormFromDto,
    tournamentFormToPayload,
} from "../utils/tournamentForm"
import { invalidateTournamentLists } from "./tournament/cache"
import type { RewardType, TournamentDetails } from "../types/tournaments"

// Register both calendar locales once (month/day names, week-starts-Monday,
// etc.). The visible FORMAT is forced via the dateFormat prop on each
// DatePicker so it never falls back to the OS region; which locale's NAMES
// are used is decided per render from the app's active language — a Slovenian
// reader was getting Croatian month names before this.
registerLocale("hr", hr)
registerLocale("sl", sl)

/**
 * The wizard replaced the single long scroll this page used to be. Three
 * steps, each one card:
 *
 *   1 „Osnovno“          — name, date, cap, location + map, details,
 *                          poster, organiser contact
 *   2 „Kotizacija i nagrade“ — everything that is money: the entry /
 *                          repasaž prices and the prize split. They used
 *                          to be two separate steps, which meant two
 *                          half-empty cards about the same subject.
 *   3 „Pregled“          — read-only review.
 *
 * Publishing is possible only from the last step — see the guard at the
 * top of `handleSubmit`.
 */
type WizardStep = 1 | 2 | 3
const LAST_STEP: WizardStep = 3

/* The form model — the type, its blank value and the payload builder — is
   `utils/tournamentForm`, shared with the detail page's "Uredi" form. It
   holds the BACKEND's enum casing ("FINALS", "FIXED"), which is what removed
   the `mapRepassageUntil` / `mapRewardType` shims that used to sit here: the
   radio inputs carry those strings as their DOM values and the payload
   builder passes them straight through. */

/**
 * Chakra v3's RadioGroup hands `onValueChange` a details object, but older
 * call sites (and the test renderer) pass the bare string. Normalise both.
 */
const radioValue = (v: string | { value: string | null } | null): string =>
    (typeof v === "string" ? v : v?.value) ?? ""

// ---------- small UI primitives ----------

/* The "€/par → €/igrač" helper that used to live here is now
   `components/PerPairHint` — the edit form on the tournament detail page had
   grown a byte-identical twin of it. */

/**
 * A headerless twin of `SectionCard`, same surface and border, no title row.
 *
 * The wizard strip directly above already names the step, so a card header
 * repeated it — and cost a title line plus its padding on every screen. The
 * review step still uses its own card component; this one wraps the two
 * editable steps.
 */
function FormCard({ children }: { children: React.ReactNode }) {
    return (
        <Card.Root variant="outline" rounded="xl" borderColor="border.emphasized" shadow="sm" bg="bg.panel">
            <Card.Body px={{ base: "3.5", md: "4" }} py={{ base: "3.5", md: "4" }}>
                {children}
            </Card.Body>
        </Card.Root>
    )
}

/**
 * Small icon + text label that opens a group of fields INSIDE a card —
 * the weight a card header used to carry, at a fraction of its height.
 */
function GroupHeading({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <HStack gap="2" fontSize="sm" fontWeight="medium" color="fg">
            <Box color="brand.fg" display="flex" alignItems="center">
                {icon}
            </Box>
            <Text>{children}</Text>
        </HStack>
    )
}

// ---------- page ----------
export default function CreateTournamentPage() {
    const navigate = useNavigate()
    // `locale` drives the datepicker's month/day names — see registerLocale above.
    const { t, locale } = useTranslation()
    const plural = usePlural()

    const [form, setForm] = useState<TournamentForm>(emptyTournamentForm)

    // Latitude/longitude tracked separately from `form` because they
    // exist purely to drive the map picker's marker — they're not sent
    // to the backend (the server forward-geocodes form.location on
    // create, and the picker fills that string with a Nominatim
    // display_name so the result lines up). Set from either picking a
    // suggestion in LocationAutocomplete or clicking the map in
    // LocationMapPicker.
    const [pickedCoords, setPickedCoords] = useState<{ lat: number; lng: number } | null>(null)

    // Prefill contact fields ("Kontakt organizatora") from the logged-in
    // user's Firebase displayName + saved phone. Most organisers run
    // multiple tournaments and were typing the same name + phone every
    // time. We only write to a field if it's still empty, so anything
    // the user has already started editing is preserved if the profile
    // fetch resolves after they touched the field. The fetch is
    // tagged `silent` because a failure here is a soft degrade — the
    // form is still fully usable, the user just types manually.
    const { user } = useAuth()
    // Read-only use of the shared own-profile query (see hooks/useMyProfile) —
    // the navbar already has it in cache by the time this page mounts, so the
    // prefill is usually instant and costs no request. A failure here is a soft
    // degrade: the form stays usable, the user just types the contact block in.
    const { data: profile } = useMyProfile()
    // One-shot latch for the country-code prefill — see the comment inside
    // the effect for why an "is it empty" guard can't work here.
    const phoneCountrySeededRef = useRef(false)
    useEffect(() => {
        if (!user?.uid) return
        if (!profile) return
        setForm((prev) => {
            // Build the patch only for fields the user hasn't
            // touched yet — never overwrite their input.
            const patch: Partial<TournamentForm> = {}
            const fallbackName =
                (profile.displayName?.trim() || user.displayName?.trim()) ?? ""
            if (!prev.contactName && fallbackName) patch.contactName = fallbackName
            if (!prev.contactPhone && profile.phone) patch.contactPhone = profile.phone
            // phoneCountry has a non-empty default ("+385") so an
            // "is it empty" guard would never fire. Latch instead: seed
            // the saved country code exactly once, otherwise a profile
            // refetch (this effect re-runs on every new `profile` object)
            // would silently snap the dropdown back after the organiser
            // picked a different country.
            if (profile.phoneCountry && !phoneCountrySeededRef.current) {
                phoneCountrySeededRef.current = true
                patch.contactPhoneCountry = profile.phoneCountry
            }
            if (Object.keys(patch).length === 0) return prev
            return { ...prev, ...patch }
        })
    }, [user?.uid, user?.displayName, profile])

    const entryPair = parseMoneyLoose(form.entryPrice)
    const repPair = parseMoneyLoose(form.repassagePrice)
    const rep2Pair = parseMoneyLoose(form.repassageSecondPrice)


    /* Required-field summary. This is the ONE validation pass on the page:
       every entry carries the wizard step that owns the field, so the same
       list drives both the per-step "Dalje" gate (filter by step) and the
       publish button's disabled state (total length), and there is no
       second rule set that can drift away from this one. */
    const missingByStep = useMemo<Array<{ step: WizardStep; label: string }>>(() => {
        const missing: Array<{ step: WizardStep; label: string }> = []
        if (!form.name.trim()) missing.push({ step: 1, label: t("forms.createTournament.missingRequired.name") })
        if (!form.location.trim()) missing.push({ step: 1, label: t("forms.createTournament.missingRequired.location") })
        if (!form.startDate) missing.push({ step: 1, label: t("forms.createTournament.missingRequired.date") })
        if (!form.startTime) missing.push({ step: 1, label: t("forms.createTournament.missingRequired.time") })
        // Prizes moved from the old step 3 onto step 2 when „Kotizacija“ and
        // „Nagrade“ were merged. The step tag here is the single place that
        // decides which "Dalje" this blocks, which banner names it and which
        // card the organiser is bounced back to — nothing else re-encodes it.
        if (!form.rewardFirst.trim() || !form.rewardSecond.trim() || !form.rewardThird.trim()) {
            missing.push({ step: 2, label: t("forms.createTournament.missingRequired.rewards") })
        }
        return missing
    }, [
        form.name,
        form.location,
        form.startDate,
        form.startTime,
        form.rewardFirst,
        form.rewardSecond,
        form.rewardThird,
        t,
    ])

    const missingRequired = useMemo(() => missingByStep.map((m) => m.label), [missingByStep])

    /**
     * True iff the user has picked a start moment in the past. Same idea as
     * the {@code min} attribute on the input, but re-evaluated on every
     * render so a slow form-fill can't slip behind "now". Used by submit to
     * block creation outright.
     */
    const startInPast = useMemo(() => {
        if (!form.startDate || !form.startTime) return false
        const iso = toLocalOffsetIso(form.startDate, form.startTime)
        if (!iso) return false
        return new Date(iso).getTime() < Date.now()
    }, [form.startDate, form.startTime])

    const onChange = <K extends keyof TournamentForm>(key: K, value: TournamentForm[K]) =>
        setForm((f) => ({ ...f, [key]: value }))

    /**
     * Switching € ↔ % keeps each mode's numbers apart, which is what the two
     * separate `fixed` / `percent` buckets in the old form state bought. The
     * shared model is flat — one prize triple, which is all the DTO stores —
     * so the buckets live here as a swap instead: flipping the mode stashes
     * what is on screen and restores whatever was last typed in the mode
     * being switched to.
     */
    const rewardStashRef = useRef<Record<RewardType, [string, string, string]>>({
        FIXED: ["", "", ""],
        PERCENTAGE: ["", "", ""],
    })
    const onRewardTypeChange = (next: RewardType) =>
        setForm((f) => {
            if (f.rewardType === next) return f
            rewardStashRef.current[f.rewardType] = [f.rewardFirst, f.rewardSecond, f.rewardThird]
            const [first, second, third] = rewardStashRef.current[next]
            return { ...f, rewardType: next, rewardFirst: first, rewardSecond: second, rewardThird: third }
        })

    // The three money fields are all `string` in the form model, so the generic
    // `onChange` narrows correctly without a cast.
    const handleMoneyChange = (key: "entryPrice" | "repassagePrice" | "repassageSecondPrice", value: string) =>
        onChange(key, sanitizeMoney(value))

    const handleMaxPairsChange = (value: string) => onChange("maxPairs", sanitizeInt(value))
    // Max pairs is optional. An empty field means "no cap" and is left
    // empty. Only when the user actually typed something do we clamp:
    // a value below the minimum (2) snaps up to 2. We never force an
    // empty field to a number — that would defeat the "no cap" option.
    const handleMaxPairsBlur = () => {
        const raw = form.maxPairs.trim()
        if (raw === "") return // empty = "Neodređeno", leave it
        const n = parseInt(raw, 10)
        if (!Number.isFinite(n) || n < 2) onChange("maxPairs", "2")
    }

    const [posterFile, setPosterFile] = useState<File | null>(null)
    const [posterPreviewUrl, setPosterPreviewUrl] = useState<string | null>(null)

    // poster validations
    const MAX_MB = 5
    const ACCEPT = ["image/jpeg", "image/png", "image/webp"]
    const [uploadErr, setUploadErr] = useState<string | null>(null)

    async function handlePosterSelect(file: File) {
        setUploadErr(null)

        if (!ACCEPT.includes(file.type)) {
            setUploadErr(t("forms.createTournament.poster.errorType"))
            return
        }
        if (file.size > MAX_MB * 1024 * 1024) {
            setUploadErr(t("forms.createTournament.poster.errorSize", { maxMb: MAX_MB }))
            return
        }

        if (posterPreviewUrl) URL.revokeObjectURL(posterPreviewUrl)

        setPosterFile(file)
        setPosterPreviewUrl(URL.createObjectURL(file))
        onChange("posterUrl", "")
    }

    function clearPoster() {
        if (posterPreviewUrl) URL.revokeObjectURL(posterPreviewUrl)
        setPosterFile(null)
        setPosterPreviewUrl(null)
        onChange("posterUrl", "")
    }

    const [submitting, setSubmitting] = useState(false)

    // ---------- wizard ----------
    const [step, setStep] = useState<WizardStep>(1)
    /** Mirrors `step` so `goToStep` sees moves made earlier in the same tick. */
    const stepRef = useRef<WizardStep>(1)
    /* Set when the user tried to leave a step with something required still
       empty. Drives both the inline banner in the footer and the red
       `invalid` outline on the offending fields; cleared on every real step
       change so a fixed step doesn't stay marked. */
    const [blockedBy, setBlockedBy] = useState<string[]>([])

    // ---------- "Učitaj iz predloška" ----------
    const [templateDialogOpen, setTemplateDialogOpen] = useState(false)

    /**
     * Seed the whole form from a tournament the organiser ran before, via the
     * same `tournamentFormFromDto` the "Uredi" page uses — so a new field on
     * that DTO only needs wiring in one place. Date/time and the map pin are
     * deliberately NOT copied: `startDate`/`startTime` reset to "now" like a
     * brand-new form (the organiser always needs a fresh date anyway), and
     * `pickedCoords` clears because `TournamentDetails` carries no lat/lng —
     * the backend re-geocodes `location` on create regardless.
     */
    function applyTemplate(details: TournamentDetails) {
        setForm({
            ...tournamentFormFromDto(details),
            startDate: todayDate(),
            startTime: nowTime(),
            posterUrl: details.bannerUrl ?? "",
        })
        setPickedCoords(null)
        if (posterPreviewUrl) URL.revokeObjectURL(posterPreviewUrl)
        setPosterFile(null)
        setPosterPreviewUrl(null)
        setUploadErr(null)
        setBlockedBy([])
        setTemplateDialogOpen(false)
        showSuccess(
            t("forms.createTournament.template.applied.title"),
            t("forms.createTournament.template.applied.message", { name: details.name }),
        )
    }

    const stepLabels = [
        t("forms.createTournament.wizard.step.basics"),
        t("forms.createTournament.wizard.step.money"),
        t("forms.createTournament.wizard.step.review"),
    ]

    /** Required fields still empty on a given step, by their translated name. */
    const missingOnStep = (s: WizardStep) =>
        missingByStep.filter((m) => m.step === s).map((m) => m.label)

    /**
     * Move to `target`, but only if every step BEFORE it is complete —
     * otherwise the review screen could be reached with holes in it.
     * Going backwards is always allowed and never validates, which is what
     * keeps "Natrag" usable while a step is half-filled.
     */
    const goToStep = (target: number) => {
        // Read the current step from a ref, not the render closure: two clicks
        // inside one React tick would otherwise both see the same `step` and
        // collapse into a single move.
        const from = stepRef.current
        const next = Math.min(Math.max(target, 1), LAST_STEP) as WizardStep
        if (next <= from) {
            setBlockedBy([])
            stepRef.current = next
            setStep(next)
            return
        }
        for (let s = from; s < next; s++) {
            const missing = missingOnStep(s as WizardStep)
            if (missing.length > 0) {
                setBlockedBy(missing)
                stepRef.current = s as WizardStep
                setStep(s as WizardStep)
                showError(
                    plural("forms.createTournament.wizard.missingCount", missing.length),
                    t("forms.createTournament.wizard.missingFields", { fields: missing.join(", ") }),
                )
                return
            }
        }
        setBlockedBy([])
        stepRef.current = next
        setStep(next)
    }

    const goNext = () => goToStep(step + 1)
    const goPrev = () => goToStep(step - 1)

    /** True when a required field should render its error state right now. */
    const invalidWhenBlocked = (empty: boolean) => blockedBy.length > 0 && empty

    /* What the inline banner actually lists: the fields that blocked the last
       "Dalje" AND are still empty. Filtering against the live `missingByStep`
       is what makes the banner shrink and finally disappear as the organiser
       types, instead of nagging about a field they already fixed. */
    const stillBlockedBy = blockedBy.filter((label) => missingOnStep(step).includes(label))

    const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
        e.preventDefault()

        /* Publishing is allowed ONLY from the review step. Anything else that
           manages to submit the form — Enter pressed inside a text field on
           step 1, a button that forgot its explicit type — is a navigation
           mishap, not an intent to create a live tournament. */
        if (step !== LAST_STEP) return

        // Block past dates outright. The {@code min} attribute on the input
        // already prevents picking earlier than now, but a slow form-fill
        // can drift behind, and clients can bypass the attribute anyway.
        if (startInPast) {
            showError(t("forms.createTournament.pastDateError"))
            return
        }

        // Empty maxPairs → null ("no cap"), a filled one clamped to 2, money
        // normalised, the phone recombined, `status: "DRAFT"` and the typed
        // poster URL added — all of it in the one builder the edit form uses.
        const payload = tournamentFormToPayload(form, "create")

        try {
            setSubmitting(true)
            const created = await createTournament(payload, posterFile)
            // The list, the count, the calendar and the map are all persisted
            // to localStorage, so without this the brand-new tournament is
            // missing from every one of them until their 30 s staleTime
            // lapses — and missing entirely on the next cold load.
            invalidateTournamentLists()
            navigate(`/turniri/${created.slug ?? created.uuid}`)
        } catch (err) {
            // Anything axios raised has already been toasted by the shared
            // interceptor — re-toasting here would stack two red cards. What
            // it cannot cover is a failure that never became a request at all
            // (a thrown FormData/serialisation error, a blocked call); that
            // used to `alert()` and then silently lost its message, leaving
            // the organiser with a form that just stops spinning.
            console.error(err)
            if (!isAxiosError(err)) {
                showError(
                    t("forms.createTournament.submitFailed.title"),
                    t("forms.createTournament.submitFailed.message"),
                )
            }
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <chakra.form
            onSubmit={handleSubmit}
            /* A column at least as tall as the visible page area. That is what
               lets the action bar below sit at the bottom of the SCREEN even on
               a short step (position:sticky alone only pins while the content
               overflows, so each step would otherwise park the buttons at a
               different height).

               Height maths — subtract the chrome ABOVE the form: NavBar
               (12+32+12+1 ≈ 57 on base, 12+40+12+1 ≈ 65 on md) plus the page
               Container's pt 6 (24). The chrome BELOW is handed back instead
               of subtracted, via the negative bottom margin: Container's py
               is a flat 24px on every breakpoint (App.tsx), so -24px cancels
               it on base too. Neither MobileTabBar nor SiteFooter render on
               /turniri/novi (see their own route checks), so there is
               nothing else below the form to account for — cancelling the
               padding lands the action bar exactly on the viewport's bottom
               edge with the document still summing to 100dvh: no page
               scrollbar, no dead space under the buttons. */
            display="flex"
            flexDirection="column"
            minH={{ base: `calc(100dvh - ${CONTENT_STICKY_TOP.base})`, md: `calc(100dvh - ${CONTENT_STICKY_TOP.md})` }}
            mb="-24px"
        >
            {/* ===================== Step indicator ===================== */}
            <WizardStepper
                steps={stepLabels}
                current={step}
                onSelect={goToStep}
                ariaLabel={t("forms.createTournament.wizard.ariaLabel")}
                progressLabel={t("forms.createTournament.wizard.progress", {
                    n: step,
                    total: LAST_STEP,
                })}
                stepAriaLabel={(n, label) =>
                    t("forms.createTournament.wizard.stepAriaLabel", {
                        n,
                        total: LAST_STEP,
                        label,
                    })
                }
            />

            {/* One card per step. `flex 1` makes this region absorb the spare
                height so the action bar is pushed to the bottom edge. */}
            <VStack align="stretch" gap="4" flex="1" mt="4">
                {/* ===================== Step 1: Osnovno =====================
                    One headerless card. Three short fields across the top,
                    then a two-column band — the long free text, contact and
                    poster on the left, the location input with its map on the
                    right — so the map's height is paid for by real content
                    beside it instead of white space. Gaps are 3 (not 4)
                    throughout: on a step this wide the row gaps add up faster
                    than any single control. */}
                {step === 1 && (
                <FormCard>
                    <VStack align="stretch" gap="3">
                        {/* "Učitaj iz predloška" — seeds the whole form from a
                            tournament the organiser ran before (see
                            `applyTemplate`). Only on step 1: it overwrites
                            everything, so offering it once the organiser has
                            already typed money/reward fields on step 2 would
                            just be a surprising way to lose that work. */}
                        <HStack justify="flex-end">
                            <Button
                                type="button"
                                size="xs"
                                variant="outline"
                                onClick={() => setTemplateDialogOpen(true)}
                            >
                                <FiCopy /> {t("forms.createTournament.template.button")}
                            </Button>
                        </HStack>

                        {/* Row 1 — three short fields side-by-side on desktop,
                            stacked on mobile. Order is product-driven:
                            organisers think "what's the tournament called",
                            "when is it", "how many pairs" — one row keeps that
                            mental flow in a single visual scan. */}
                        <Box
                            display="grid"
                            gridTemplateColumns={{ base: "1fr", sm: "1fr 1fr", md: "2fr 1.7fr 0.9fr" }}
                            gap="3"
                        >
                            <Field.Root required invalid={invalidWhenBlocked(!form.name.trim())}>
                                <Field.Label>
                                    {t("forms.createTournament.name.label")} <Field.RequiredIndicator />
                                </Field.Label>
                                <Input
                                    placeholder={t("forms.createTournament.name.placeholder")}
                                    value={form.name}
                                    onChange={(e) => onChange("name", e.target.value)}
                                />
                            </Field.Root>

                            <Field.Root required invalid={invalidWhenBlocked(!form.startDate || !form.startTime)}>
                                <Field.Label>
                                    {t("forms.createTournament.dateTime.label")} <Field.RequiredIndicator />
                                </Field.Label>
                                {/* react-datepicker with HR locale + forced
                                    dateFormat. This combo guarantees the visible
                                    format is dd/MM/yyyy and 24h regardless of
                                    OS region (which is what broke the native
                                    datetime-local input). State still stores
                                    ISO date + HH:mm so the backend payload is
                                    unchanged. */}
                                <Box className="bela-datepicker-wrap" w="full">
                                    <DatePicker
                                        selected={
                                            form.startDate && form.startTime
                                                ? new Date(
                                                      `${form.startDate}T${form.startTime}:00`,
                                                  )
                                                : null
                                        }
                                        onChange={(d) => {
                                            if (!d) {
                                                onChange("startDate", "")
                                                onChange("startTime", "")
                                                return
                                            }
                                            const yyyy = d.getFullYear()
                                            const mm = pad(d.getMonth() + 1)
                                            const dd = pad(d.getDate())
                                            const hh = pad(d.getHours())
                                            const mi = pad(d.getMinutes())
                                            onChange("startDate", `${yyyy}-${mm}-${dd}`)
                                            onChange("startTime", `${hh}:${mi}`)
                                        }}
                                        showTimeSelect
                                        timeIntervals={15}
                                        timeFormat="HH:mm"
                                        timeCaption={t("forms.createTournament.dateTime.timeCaption")}
                                        dateFormat="dd/MM/yyyy HH:mm"
                                        locale={locale}
                                        minDate={new Date()}
                                        placeholderText={t("forms.createTournament.dateTime.placeholder")}
                                        // Stretch the underlying <input> to fill the
                                        // field width — the library renders a tiny
                                        // input by default.
                                        wrapperClassName="bela-datepicker-input-wrap"
                                        className="bela-datepicker-input"
                                        popperPlacement="bottom-start"
                                    />
                                </Box>
                            </Field.Root>
                            {/* Max. parova — optional, and the helper line that
                                used to explain that ("ostavi prazno za
                                neograničen broj") was a full extra row under a
                                short field. The placeholder already reads
                                "Neodređeno", which says the same thing in the
                                space the field already occupies. */}
                            <Field.Root>
                                <Field.Label>{t("forms.createTournament.maxPairs.label")}</Field.Label>
                                <Input
                                    type="number"
                                    inputMode="numeric"
                                    min={2}
                                    placeholder={t("forms.createTournament.maxPairs.placeholder")}
                                    value={form.maxPairs}
                                    onChange={(e) => handleMaxPairsChange(e.target.value)}
                                    onBlur={handleMaxPairsBlur}
                                />
                            </Field.Root>
                        </Box>

                        {/* Row 2 — two columns on desktop:
                              · RIGHT : Lokacija, with the map directly under it
                              · LEFT  : Detalji, Kontakt, Plakat
                            The map is the tallest thing on the step, so the
                            left column exists to fill the height beside it
                            rather than under it. On mobile the grid collapses
                            to one column and `order` gives the reading order
                            Lokacija → karta → Detalji → Kontakt → Plakat. */}
                        <Box
                            display="grid"
                            gridTemplateColumns={{ base: "1fr", md: "1fr 1fr" }}
                            gap="3"
                            alignItems="start"
                        >
                            {/* RIGHT column — Lokacija above the map. */}
                            <VStack
                                align="stretch"
                                gap="2"
                                gridColumn={{ md: "2" }}
                                order={{ base: 0, md: 1 }}
                            >
                                <Field.Root required invalid={invalidWhenBlocked(!form.location.trim())}>
                                    <Field.Label>
                                        {t("forms.createTournament.location.label")} <Field.RequiredIndicator />
                                    </Field.Label>
                                    <LocationAutocomplete
                                        value={form.location}
                                        onChange={(v) => onChange("location", v)}
                                        onPickSuggestion={(s) => {
                                            setPickedCoords({ lat: s.latitude, lng: s.longitude })
                                        }}
                                        placeholder={t("forms.createTournament.location.placeholder")}
                                    />
                                </Field.Root>
                                <LocationMapPicker
                                    value={pickedCoords}
                                    onPick={(p) => {
                                        onChange("location", p.displayName)
                                        setPickedCoords({ lat: p.lat, lng: p.lng })
                                    }}
                                    /* 240px on a phone: tall enough to pan and
                                       drop a pin without the marker sitting
                                       under the zoom controls, still short
                                       enough that the fields under it stay
                                       within a thumb's reach. Fixed (not
                                       100%) on desktop too, so the row's
                                       height is set by the left column's real
                                       content instead of by the map. */
                                    height={{ base: "240px", md: "252px" }}
                                    minH="240px"
                                />
                            </VStack>

                            {/* LEFT column — Detalji, Kontakt, Plakat. This is
                                the column that sets the block's height, so the
                                savings that matter live here. */}
                            <VStack
                                align="stretch"
                                gap="3"
                                gridColumn={{ md: "1" }}
                                gridRow={{ md: "1" }}
                                order={{ base: 1, md: 0 }}
                            >
                                <Field.Root>
                                    <Field.Label>{t("forms.createTournament.details.label")}</Field.Label>
                                    <Textarea
                                        rows={2}
                                        resize="vertical"
                                        placeholder={t("forms.createTournament.details.placeholder")}
                                        value={form.details}
                                        onChange={(e) => onChange("details", e.target.value)}
                                    />
                                </Field.Root>

                                {/* Organiser contact. It lives in the basics
                                    card rather than a step of its own: two
                                    optional prefilled fields would make a
                                    whole wizard screen the organiser only ever
                                    clicks "Dalje" on. Labels collapse into one
                                    group heading + placeholders, so the pair
                                    costs one row instead of three. */}
                                <Box>
                                    <GroupHeading icon={<FiPhone />}>
                                        {t("forms.createTournament.section.contact")}
                                    </GroupHeading>
                                    <Box
                                        display="grid"
                                        gridTemplateColumns={{ base: "1fr", sm: "1fr 1fr" }}
                                        gap="2"
                                        mt="1.5"
                                    >
                                        <Input
                                            aria-label={t("forms.createTournament.contactName.label")}
                                            placeholder={t("forms.createTournament.contactName.placeholder")}
                                            value={form.contactName}
                                            onChange={(e) => onChange("contactName", e.target.value)}
                                        />
                                        <HStack gap="2">
                                            <NativeSelect.Root size="md" w="110px" flexShrink={0}>
                                                <NativeSelect.Field
                                                    aria-label={t("forms.createTournament.contactPhone.label")}
                                                    value={form.contactPhoneCountry}
                                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                                                        onChange("contactPhoneCountry", e.target.value)
                                                    }
                                                >
                                                    {PHONE_COUNTRIES.map((c) => (
                                                        <option key={c.value} value={c.value}>
                                                            {c.label}
                                                        </option>
                                                    ))}
                                                </NativeSelect.Field>
                                            </NativeSelect.Root>
                                            <Input
                                                flex="1"
                                                minW="0"
                                                inputMode="numeric"
                                                pattern="[0-9 ]*"
                                                aria-label={t("forms.createTournament.contactPhone.label")}
                                                placeholder={t("forms.createTournament.contactPhone.placeholder")}
                                                value={form.contactPhone}
                                                onChange={(e) => onChange("contactPhone", sanitizePhone(e.target.value))}
                                            />
                                        </HStack>
                                    </Box>
                                </Box>

                                {/* Poster picker — inline within the card. */}
                                <Box>
                                    <GroupHeading icon={<FiImage />}>
                                        {t("forms.createTournament.poster.label")}{" "}
                                        <chakra.span color="fg.muted" fontWeight="normal">
                                            {t("forms.createTournament.poster.optional")}
                                        </chakra.span>
                                    </GroupHeading>

                                    {/* align="center" vertically centres the
                                        button + hint next to the 88×88 poster
                                        preview. The responsive `justify` pulls
                                        everything into the horizontal centre on
                                        mobile (where the preview + VStack wrap
                                        to two rows and would otherwise hug the
                                        left edge), and falls back to flex-start
                                        on desktop. */}
                                    <HStack
                                        align="center"
                                        gap="3"
                                        wrap="wrap"
                                        mt="1.5"
                                        justify={{ base: "center", sm: "flex-start" }}
                                    >
                                        {(posterPreviewUrl || form.posterUrl) ? (
                                            <Box
                                                position="relative"
                                                borderWidth="1px"
                                                rounded="md"
                                                overflow="hidden"
                                                w="88px"
                                                h="88px"
                                            >
                                                <img
                                                    src={posterPreviewUrl || form.posterUrl!}
                                                    alt={t("forms.createTournament.poster.alt")}
                                                    // Non-critical thumbnail in a fixed
                                                    // 88×88 box — no layout shift.
                                                    loading="lazy"
                                                    decoding="async"
                                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                                />
                                                <IconButton
                                                    type="button"
                                                    aria-label={t("forms.createTournament.poster.remove")}
                                                    size="2xs"
                                                    variant="solid"
                                                    colorPalette="red"
                                                    position="absolute"
                                                    top="1"
                                                    right="1"
                                                    onClick={clearPoster}
                                                >
                                                    <FiX />
                                                </IconButton>
                                            </Box>
                                        ) : (
                                            <Box
                                                w="88px"
                                                h="88px"
                                                borderWidth="1px"
                                                borderStyle="dashed"
                                                borderColor="border.subtle"
                                                rounded="md"
                                                display="flex"
                                                alignItems="center"
                                                justifyContent="center"
                                                color="fg.muted"
                                            >
                                                <FiImage size={24} />
                                            </Box>
                                        )}

                                        <VStack
                                            align={{ base: "center", sm: "start" }}
                                            gap="1"
                                            flex="1"
                                            minW="180px"
                                        >
                                            <Button
                                                as="label"
                                                variant="outline"
                                                colorPalette="blue"
                                                size="sm"
                                                cursor="pointer"
                                            >
                                                {posterFile ? t("forms.createTournament.poster.change") : t("forms.createTournament.poster.choose")}
                                                <input
                                                    type="file"
                                                    accept={ACCEPT.join(",")}
                                                    style={{ display: "none" }}
                                                    onChange={(e) => {
                                                        const f = e.target.files?.[0]
                                                        if (f) handlePosterSelect(f)
                                                    }}
                                                />
                                            </Button>
                                            {uploadErr ? (
                                                <Text color="fg.error" fontSize="xs">{uploadErr}</Text>
                                            ) : (
                                                <Text color="fg.muted" fontSize="xs">
                                                    {t("forms.createTournament.poster.hint", { maxMb: MAX_MB })}
                                                </Text>
                                            )}
                                        </VStack>
                                    </HStack>
                                </Box>
                            </VStack>
                        </Box>
                    </VStack>
                </FormCard>
                )}

                {/* ===================== Step 2: Kotizacija i nagrade =====================
                    Both halves are money, so they share one card instead of
                    two half-empty ones. They stay two clearly separated
                    groups: a heading each, and a hairline rule between them. */}
                {step === 2 && (
                <FormCard>
                    <VStack align="stretch" gap="3">
                        {/* ── Group A: kotizacija + repasaž ── */}
                        <GroupHeading icon={<FiDollarSign />}>
                            {t("forms.createTournament.section.pricing")}
                        </GroupHeading>

                        {/* Single row: kotizacija + repasaž + drugi repasaž slot + repasaž do */}
                        <Box
                            display="grid"
                            gridTemplateColumns={{ base: "1fr 1fr", sm: "1fr 1fr 1fr", md: "130px 130px 165px 1fr" }}
                            gap="3"
                            alignItems="start"
                        >
                            <Field.Root>
                                <Field.Label>{t("forms.createTournament.entryPrice.label")}</Field.Label>
                                <SuffixInput
                                    value={form.entryPrice}
                                    onChange={(v) => handleMoneyChange("entryPrice", v)}
                                    placeholder="30"
                                    suffix="€"
                                />
                                <PerPairHint value={entryPair} />
                            </Field.Root>

                            <Field.Root>
                                <Field.Label>{t("forms.createTournament.repassagePrice.label")}</Field.Label>
                                <SuffixInput
                                    value={form.repassagePrice}
                                    onChange={(v) => handleMoneyChange("repassagePrice", v)}
                                    placeholder="30"
                                    suffix="€"
                                />
                                <PerPairHint value={repPair} />
                            </Field.Root>

                            {/* Drugi repasaž — plain optional slot, identical structure
                                to Kotizacija/Repasaž. Empty string = not set; non-empty = set. */}
                            <Field.Root>
                                <Field.Label color="fg.muted">
                                    {t("forms.createTournament.repassageSecondPrice.label")} <chakra.span fontSize="xs">{t("forms.createTournament.repassageSecondPrice.optional")}</chakra.span>
                                </Field.Label>
                                <SuffixInput
                                    value={form.repassageSecondPrice}
                                    onChange={(v) => handleMoneyChange("repassageSecondPrice", v)}
                                    placeholder="—"
                                    suffix="€"
                                />
                                <PerPairHint value={rep2Pair} />
                            </Field.Root>

                            <Field.Root gridColumn={{ base: "1 / -1", md: "auto" }}>
                                <Field.Label>{t("forms.createTournament.repassageUntil.label")}</Field.Label>
                                <RadioGroup.Root
                                    value={form.repassageUntil}
                                    onValueChange={(v) =>
                                        onChange(
                                            "repassageUntil",
                                            radioValue(v) as TournamentForm["repassageUntil"],
                                        )
                                    }
                                >
                                    <HStack gap="4" wrap="wrap" rowGap="1.5" pt="2">
                                        <RadioGroup.Item value="FINALS">
                                            <RadioGroup.ItemHiddenInput />
                                            <RadioGroup.ItemIndicator />
                                            <RadioGroup.ItemText>{t("forms.createTournament.repassageUntil.finals")}</RadioGroup.ItemText>
                                        </RadioGroup.Item>
                                        <RadioGroup.Item value="SEMIFINALS">
                                            <RadioGroup.ItemHiddenInput />
                                            <RadioGroup.ItemIndicator />
                                            <RadioGroup.ItemText>{t("forms.createTournament.repassageUntil.semifinals")}</RadioGroup.ItemText>
                                        </RadioGroup.Item>
                                        <RadioGroup.Item value="FIRST_ROUND">
                                            <RadioGroup.ItemHiddenInput />
                                            <RadioGroup.ItemIndicator />
                                            <RadioGroup.ItemText>{t("forms.createTournament.repassageUntil.firstRound")}</RadioGroup.ItemText>
                                        </RadioGroup.Item>
                                    </HStack>
                                </RadioGroup.Root>
                                <Field.HelperText>
                                    {t("forms.createTournament.repassageUntil.helper")}
                                </Field.HelperText>
                            </Field.Root>
                        </Box>

                        {/* ── Group B: nagrade ──
                            The fixed/percentage switch shares the heading row:
                            it IS the heading's qualifier ("Nagrade, in € or in
                            %"), and on its own line it was a lonely pair of
                            radios costing a full row. */}
                        <HStack
                            justify="space-between"
                            align="center"
                            gap="3"
                            wrap="wrap"
                            rowGap="2"
                            borderTopWidth="1px"
                            borderColor="border.subtle"
                            pt="3"
                            mt="1"
                        >
                            <GroupHeading icon={<FiGift />}>
                                {t("forms.createTournament.section.rewards")}
                            </GroupHeading>
                            <RadioGroup.Root
                                value={form.rewardType}
                                onValueChange={(v) =>
                                    onRewardTypeChange(radioValue(v) as RewardType)
                                }
                            >
                                <HStack gap="4" wrap="wrap" rowGap="1.5">
                                    <RadioGroup.Item value="FIXED">
                                        <RadioGroup.ItemHiddenInput />
                                        <RadioGroup.ItemIndicator />
                                        <RadioGroup.ItemText>{t("forms.createTournament.rewardsMode.fixed")}</RadioGroup.ItemText>
                                    </RadioGroup.Item>
                                    <RadioGroup.Item value="PERCENTAGE">
                                        <RadioGroup.ItemHiddenInput />
                                        <RadioGroup.ItemIndicator />
                                        <RadioGroup.ItemText>{t("forms.createTournament.rewardsMode.percentage")}</RadioGroup.ItemText>
                                    </RadioGroup.Item>
                                </HStack>
                            </RadioGroup.Root>
                        </HStack>

                        {/* The three prize slots. Same grid for both modes —
                            only the value source, suffix and placeholders
                            differ, so a single block covers them and there is
                            no second copy to keep in sync. */}
                        <Box
                            display="grid"
                            gridTemplateColumns={{ base: "1fr", sm: "1fr 1fr 1fr" }}
                            gap="3"
                        >
                            {([
                                ["rewardFirst", "first", t("forms.createTournament.reward.first")],
                                ["rewardSecond", "second", t("forms.createTournament.reward.second")],
                                ["rewardThird", "third", t("forms.createTournament.reward.third")],
                            ] as Array<["rewardFirst" | "rewardSecond" | "rewardThird", string, string]>)
                                .map(([field, place, label]) => {
                                    const isFixed = form.rewardType === "FIXED"
                                    const value = form[field]
                                    const placeholderKey = isFixed
                                        ? `forms.createTournament.reward.fixedPlaceholder.${place}`
                                        : `forms.createTournament.reward.percentPlaceholder.${place}`
                                    return (
                                        <Field.Root key={place} required invalid={invalidWhenBlocked(!value.trim())}>
                                            <Field.Label>{label} <Field.RequiredIndicator /></Field.Label>
                                            <SuffixInput
                                                value={value}
                                                onChange={(v) => onChange(field, sanitizeMoney(v))}
                                                placeholder={t(placeholderKey)}
                                                suffix={isFixed ? "€" : "%"}
                                            />
                                        </Field.Root>
                                    )
                                })}
                        </Box>
                    </VStack>
                </FormCard>
                )}

                {/* ===================== Step 3: Review before publishing ===================== */}
                {step === LAST_STEP && (() => {
                    const notEntered = (
                        <chakra.span color="fg.subtle" fontWeight="normal">
                            {t("forms.createTournament.review.notEntered")}
                        </chakra.span>
                    )
                    /* Money rendered exactly as the organiser typed it,
                       normalised through the same helper the payload uses, so
                       the summary can never disagree with what gets sent. */
                    const money = (raw: string) => {
                        const n = moneyToNumber(raw)
                        return n != null && Number.isFinite(n) && n > 0
                            ? `${numberToMoneyStr(n)} €`
                            : null
                    }
                    const repassageUntilLabel = {
                        FINALS: t("forms.createTournament.repassageUntil.finals"),
                        SEMIFINALS: t("forms.createTournament.repassageUntil.semifinals"),
                        FIRST_ROUND: t("forms.createTournament.repassageUntil.firstRound"),
                    }[form.repassageUntil]

                    const suffix = form.rewardType === "FIXED" ? "€" : "%"
                    const rewardSummary = ([
                        [t("forms.createTournament.reward.first"), form.rewardFirst],
                        [t("forms.createTournament.reward.second"), form.rewardSecond],
                        [t("forms.createTournament.reward.third"), form.rewardThird],
                    ] as Array<[string, string]>)
                        .filter(([, v]) => v.trim() !== "")
                        .map(([label, v]) => `${label}: ${v.trim()} ${suffix}`)
                        .join(" · ")

                    const phoneStr = joinPhone(form.contactPhoneCountry, form.contactPhone) ?? ""
                    const contactStr = [form.contactName.trim(), phoneStr]
                        .filter(Boolean)
                        .join(" · ")

                    // Drugi repasaž (second re-entry price) has no default —
                    // most organisers never touch it — so on a confirmation
                    // screen an empty row reading "Nije uneseno" is just
                    // noise; only render it once it actually has a price.
                    const repassageSecondValue = money(form.repassageSecondPrice)

                    // Repasaž moguć do (last round it can still be bought)
                    // always has a value: the form defaults it to "Finala"
                    // and there is no toggle to disable repassage entirely,
                    // so unlike the rows above this one can't go missing.

                    // "Detalji" is free text the organiser may skip
                    // entirely; same reasoning as Drugi repasaž above —
                    // don't show an empty row just to say it's empty.
                    const detailsValue = form.details.trim()

                    const rows: ReviewRow[] = [
                        {
                            label: t("forms.createTournament.dateTime.label"),
                            value:
                                form.startDate && form.startTime
                                    ? formatDateTime(toLocalOffsetIso(form.startDate, form.startTime))
                                    : notEntered,
                        },
                        {
                            label: t("forms.createTournament.location.label"),
                            value: form.location.trim() || notEntered,
                            wide: true,
                        },
                        {
                            label: t("forms.createTournament.maxPairs.label"),
                            value:
                                form.maxPairs.trim() ||
                                (
                                    <chakra.span color="fg.subtle" fontWeight="normal">
                                        {t("forms.createTournament.review.unlimited")}
                                    </chakra.span>
                                ),
                        },
                        {
                            label: t("forms.createTournament.entryPrice.label"),
                            value:
                                money(form.entryPrice) ?? (
                                    <chakra.span color="fg.subtle" fontWeight="normal">
                                        {t("forms.createTournament.review.free")}
                                    </chakra.span>
                                ),
                        },
                        {
                            label: t("forms.createTournament.repassagePrice.label"),
                            value:
                                money(form.repassagePrice) ?? (
                                    <chakra.span color="fg.subtle" fontWeight="normal">
                                        {t("forms.createTournament.review.free")}
                                    </chakra.span>
                                ),
                        },
                        ...(repassageSecondValue != null
                            ? [{
                                label: t("forms.createTournament.repassageSecondPrice.label"),
                                value: repassageSecondValue,
                            }]
                            : []),
                        {
                            label: t("forms.createTournament.repassageUntil.label"),
                            value: repassageUntilLabel,
                        },
                        {
                            label: t("forms.createTournament.section.rewards"),
                            value: rewardSummary || notEntered,
                            wide: true,
                        },
                        {
                            label: t("forms.createTournament.section.contact"),
                            value: contactStr || notEntered,
                        },
                        ...(detailsValue
                            ? [{
                                label: t("forms.createTournament.details.label"),
                                value: detailsValue,
                                wide: true,
                            }]
                            : []),
                    ]

                    return (
                        <TournamentReviewCard
                            heading={form.name}
                            headingFallback={t("forms.createTournament.review.unnamed")}
                            subheading={t("forms.createTournament.review.subheading")}
                            posterSrc={posterPreviewUrl || form.posterUrl || null}
                            posterAlt={t("forms.createTournament.poster.alt")}
                            noPosterLabel={t("forms.createTournament.review.noPoster")}
                            rows={rows}
                        />
                    )
                })()}
            </VStack>

            {/* ===================== Sticky action bar ===================== */}
            {/* zIndex must beat Leaflet's `.leaflet-control-container`
                (z-index 1000). Without an explicit z-index here, the
                sticky bar inherits `auto` and the Leaflet map's zoom
                controls + the LocationMapPicker pane render in front of
                the buttons when the form is scrolled so the map sits at
                the viewport bottom. 1100 is above Leaflet but below
                NavBar's sticky top (zIndex 1000 there, but they don't
                overlap so it's harmless).

                MobileTabBar hides itself on /turniri/novi (see the `hidden`
                list there), so bottom:0 is genuinely the bottom of the
                screen on a phone — nothing to clear. */}
            <Box
                position="sticky"
                bottom="0"
                zIndex={1100}
                // Frosted rather than the old opaque `bg="bg"`: the form
                // scrolls under this bar, and a hard opaque band made it look
                // like the page ended there. `glass.panel` is the theme's
                // denser blur (src/system.ts) — the buttons on top stay fully
                // opaque, and browsers without backdrop-filter get a solid
                // bg.panel instead.
                layerStyle="glass.panel"
                borderTopWidth="1px"
                borderColor="border.glass"
                mt="4"
                pt="3"
                pb="3"
                style={{
                    marginLeft: "calc(-1 * var(--chakra-spacing-4))",
                    marginRight: "calc(-1 * var(--chakra-spacing-4))",
                    paddingBottom: "calc(var(--chakra-spacing-3) + env(safe-area-inset-bottom, 0px))",
                }}
                px="4"
            >
                {/* Why "Dalje" refused. Shown inline as well as toasted,
                    because a toast can be missed or already dismissed while
                    the user is still looking for the offending field. */}
                {stillBlockedBy.length > 0 && (
                    <Box
                        colorPalette="red"
                        bg="colorPalette.subtle"
                        color="colorPalette.fg"
                        borderWidth="1px"
                        borderColor="colorPalette.muted"
                        rounded="md"
                        px="3"
                        py="2"
                        mb="2"
                        fontSize="sm"
                        role="alert"
                    >
                        {t("forms.createTournament.wizard.missingFields", {
                            fields: stillBlockedBy.join(", "),
                        })}
                    </Box>
                )}

                <HStack justify="space-between" gap="2" wrap="wrap">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => window.history.back()}
                        disabled={submitting}
                    >
                        {t("common.cancel")}
                    </Button>

                    <HStack gap="2">
                        {step > 1 && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={goPrev}
                                disabled={submitting}
                            >
                                {t("forms.createTournament.wizard.back")}
                            </Button>
                        )}
                        {step < LAST_STEP && (
                            <Button
                                type="button"
                                variant="solid"
                                colorPalette="blue"
                                onClick={goNext}
                            >
                                {t("forms.createTournament.wizard.next")}
                            </Button>
                        )}
                        {step === LAST_STEP && (
                            <Button
                                type="submit"
                                variant="solid"
                                colorPalette="blue"
                                loading={submitting}
                                disabled={missingRequired.length > 0 || submitting}
                            >
                                {t("forms.createTournament.submit")}
                            </Button>
                        )}
                    </HStack>
                </HStack>
            </Box>

            <LoadTournamentTemplateDialog
                open={templateDialogOpen}
                onClose={() => setTemplateDialogOpen(false)}
                onApply={applyTemplate}
            />
        </chakra.form>
    )
}
