import React, { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
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
    FiDollarSign,
    FiGift,
    FiImage,
    FiInfo,
    FiPhone,
    FiX,
} from "react-icons/fi"
import DatePicker, { registerLocale } from "react-datepicker"
import { hr } from "date-fns/locale"
import "react-datepicker/dist/react-datepicker.css"
import "../datepicker.css"

import { createTournament } from "../api/createTournament"
import { LocationAutocomplete } from "../components/LocationAutocomplete"
import type { CreateTournamentPayload, RewardType, RepassageUntil } from "../types/tournaments"

// Register the Croatian locale once for the calendar UI (month/day names,
// week-starts-Monday, etc.). The format itself is forced via the dateFormat
// prop on each DatePicker so it never falls back to the OS region.
registerLocale("hr", hr)

// ---------- UI-only types ----------
type RewardsMode = "fixed" | "percentage"
type RepassageEndsAt = "finals" | "semifinals"

type FormState = {
    name: string
    location: string
    details: string
    posterUrl?: string
    startDate: string
    startTime: string
    entryPrice: string
    repassagePrice: string
    repassageSecondPrice: string
    repassageUntil: RepassageEndsAt
    maxPairs: string
    rewardsMode: RewardsMode
    fixed: { first: string; second: string; third: string }
    percent: { first: string; second: string; third: string }
    contactName: string
    contactPhoneCountry: string
    contactPhone: string
    selectedOptions: string[]
}

/** Calling-code options for the phone country selector. */
const PHONE_COUNTRIES: Array<{ value: string; label: string }> = [
    { value: "+385", label: "🇭🇷 +385" },
    { value: "+386", label: "🇸🇮 +386" },
    { value: "+43",  label: "🇦🇹 +43" },
    { value: "+49",  label: "🇩🇪 +49" },
    { value: "+387", label: "🇧🇦 +387" },
    { value: "+381", label: "🇷🇸 +381" },
]

// ---------- helpers ----------
const pad = (n: number) => String(n).padStart(2, "0")
const defaultDate = () => {
    const d = new Date()
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const defaultTime = () => {
    const d = new Date()
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const toNumber = (v: string) => {
    const cleaned = v.replace(/[ €]/g, "").replace(",", ".")
    const n = parseFloat(cleaned)
    return Number.isFinite(n) ? n : NaN
}
const formatMoney = (n: number) => {
    if (!Number.isFinite(n)) return ""
    const f = n.toFixed(2)
    return f.endsWith(".00") ? f.slice(0, -3) : f
}
const sanitizeMoneyInput = (raw: string) => {
    let s = raw.replace(/-/g, "").replace(/[^\d.,]/g, "").replace(",", ".")
    if (s.startsWith(".")) s = "0" + s
    const parts = s.split(".")
    if (parts.length > 2) s = parts[0] + "." + parts.slice(1).join("")
    return s
}
const sanitizeInt = (raw: string) => raw.replace(/[^\d]/g, "")
/**
 * Strip everything except digits + spaces from a phone string. We keep spaces
 * so users can type "91 234 5678" for readability; the country code is held in
 * a separate select, so a leading "+" or country digits aren't expected here.
 */
const sanitizePhone = (raw: string) => raw.replace(/[^\d\s]/g, "")

// local date+time → OffsetDateTime string (e.g. 2025-11-02T19:00:00+01:00)
function toLocalOffsetIso(dateStr: string, timeStr: string): string | null {
    if (!dateStr || !timeStr) return null
    const [y, m, d] = dateStr.split("-").map(Number)
    const [hh, mm] = timeStr.split(":").map(Number)
    const dt = new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0)
    const tz = -dt.getTimezoneOffset()
    const sign = tz >= 0 ? "+" : "-"
    const hhOff = String(Math.floor(Math.abs(tz) / 60)).padStart(2, "0")
    const mmOff = String(Math.abs(tz) % 60).padStart(2, "0")
    return (
        `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}` +
        `T${pad(dt.getHours())}:${pad(dt.getMinutes())}:00${sign}${hhOff}:${mmOff}`
    )
}

// map UI enums → backend enums
const mapRepassageUntil = (v: RepassageEndsAt): RepassageUntil =>
    v === "finals" ? "FINALS" : "SEMIFINALS"
const mapRewardType = (v: RewardsMode): RewardType =>
    v === "fixed" ? "FIXED" : "PERCENTAGE"

// money "30" / "30.50" → number | null
const toMoney = (s?: string) => {
    if (!s) return null
    const n = parseFloat(s.replace(",", "."))
    return Number.isFinite(n) ? n : null
}

// ---------- small UI primitives ----------

/** A bordered, titled section card. Tight body padding for dense forms. */
function SectionCard({
                         icon,
                         title,
                         description,
                         children,
                     }: {
    icon?: React.ReactNode
    title: string
    description?: string
    children: React.ReactNode
}) {
    return (
        <Card.Root variant="outline" rounded="xl" borderColor="border.emphasized" shadow="sm">
            <Card.Header pb="2" pt="4" px={{ base: "4", md: "5" }}>
                <HStack gap="2.5" align="center">
                    {icon && (
                        <Box color="blue.500" display="flex" alignItems="center">
                            {icon}
                        </Box>
                    )}
                    <Card.Title fontSize="md">{title}</Card.Title>
                </HStack>
                {description && (
                    <Card.Description fontSize="sm" color="fg.muted" mt="1">
                        {description}
                    </Card.Description>
                )}
            </Card.Header>
            <Card.Body pt="3" pb="4" px={{ base: "4", md: "5" }}>
                {children}
            </Card.Body>
        </Card.Root>
    )
}

/** Input with a fixed-width currency / unit suffix, looks like one field. */
function SuffixInput({
                         value,
                         onChange,
                         placeholder,
                         suffix,
                         inputMode = "decimal",
                     }: {
    value: string
    onChange: (v: string) => void
    placeholder?: string
    suffix: string
    inputMode?: "decimal" | "numeric" | "text"
}) {
    return (
        <HStack gap="0" position="relative" w="full">
            <Input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                inputMode={inputMode}
                pr="9"
            />
            <Box
                position="absolute"
                right="3"
                top="50%"
                style={{ transform: "translateY(-50%)" }}
                color="fg.muted"
                fontSize="sm"
                pointerEvents="none"
            >
                {suffix}
            </Box>
        </HStack>
    )
}

/** A two-line helper that shows €/par → €/igrač on the same row. */
function PerPairHint({ value }: { value: number }) {
    if (!Number.isFinite(value)) return null
    return (
        <Field.HelperText>
            {formatMoney(value)}€<chakra.span color="fg.muted">/par</chakra.span>{" "}
            • {formatMoney(value / 2)}€<chakra.span color="fg.muted">/igrač</chakra.span>
        </Field.HelperText>
    )
}

// ---------- page ----------
export default function CreateTournamentPage() {
    const navigate = useNavigate()

    const [form, setForm] = useState<FormState>({
        name: "",
        location: "",
        details: "",
        posterUrl: "",
        startDate: defaultDate(),
        startTime: defaultTime(),
        entryPrice: "30",
        repassagePrice: "30",
        repassageSecondPrice: "",
        repassageUntil: "finals",
        maxPairs: "2",
        rewardsMode: "fixed",
        fixed: { first: "", second: "", third: "" },
        percent: { first: "", second: "", third: "" },
        contactName: "",
        contactPhoneCountry: "+385",
        contactPhone: "",
        selectedOptions: [],
    })

    const entryPair = toNumber(form.entryPrice)
    const repPair = toNumber(form.repassagePrice)
    const rep2Pair = toNumber(form.repassageSecondPrice)


    // required-field summary for the sticky bar
    const missingRequired = useMemo(() => {
        const missing: string[] = []
        if (!form.name.trim()) missing.push("Ime")
        if (!form.location.trim()) missing.push("Lokacija")
        if (!form.startDate) missing.push("Datum")
        if (!form.startTime) missing.push("Vrijeme")
        const r = form.rewardsMode === "fixed" ? form.fixed : form.percent
        if (!r.first.trim() || !r.second.trim() || !r.third.trim()) missing.push("Nagrade")
        return missing
    }, [
        form.name,
        form.location,
        form.startDate,
        form.startTime,
        form.rewardsMode,
        form.fixed,
        form.percent,
    ])

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

    const onChange = <K extends keyof FormState>(key: K, value: FormState[K]) =>
        setForm((f) => ({ ...f, [key]: value }))
    const onNested =
        <P extends "fixed" | "percent", K extends keyof FormState[P]>(part: P, key: K, value: string) =>
            setForm((f) => ({ ...f, [part]: { ...f[part], [key]: value } }))

    const handleMoneyChange = (key: "entryPrice" | "repassagePrice" | "repassageSecondPrice", value: string) =>
        onChange(key, sanitizeMoneyInput(value) as any)

    const handleMaxPairsChange = (value: string) => onChange("maxPairs", sanitizeInt(value))
    const handleMaxPairsBlur = () => {
        const n = parseInt(form.maxPairs || "0", 10)
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
            setUploadErr("Dozvoljeno: JPG, PNG ili WEBP.")
            return
        }
        if (file.size > MAX_MB * 1024 * 1024) {
            setUploadErr(`Maksimalna veličina je ${MAX_MB} MB.`)
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

    const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
        e.preventDefault()

        // Block past dates outright. The {@code min} attribute on the input
        // already prevents picking earlier than now, but a slow form-fill
        // can drift behind, and clients can bypass the attribute anyway.
        if (startInPast) {
            alert("Datum i vrijeme turnira ne mogu biti u prošlosti.")
            return
        }

        const parsedMaxPairs = parseInt(form.maxPairs || "0", 10)
        const maxPairsSafe = Number.isFinite(parsedMaxPairs) && parsedMaxPairs >= 2 ? parsedMaxPairs : 16

        const entrySafe = toMoney(form.entryPrice)
        const repSafe = toMoney(form.repassagePrice)

        const payload: CreateTournamentPayload = {
            name: form.name.trim(),
            location: form.location.trim() || null,
            details: form.details.trim() || null,
            startAt: toLocalOffsetIso(form.startDate, form.startTime),

            bannerUrl: form.posterUrl?.trim() || null,

            maxPairs: maxPairsSafe,
            entryPrice: Number.isFinite(entrySafe as number) ? (entrySafe as number) : 0,
            repassagePrice: Number.isFinite(repSafe as number) ? (repSafe as number) : 0,
            repassageSecondPrice: toMoney(form.repassageSecondPrice),
            repassageUntil: mapRepassageUntil(form.repassageUntil),

            contactName: form.contactName.trim() || null,
            contactPhone: form.contactPhone.trim()
                ? `${form.contactPhoneCountry} ${form.contactPhone.trim()}`
                : null,

            rewardType: mapRewardType(form.rewardsMode),
            rewardFirst:
                form.rewardsMode === "fixed"
                    ? toMoney(form.fixed.first)
                    : toMoney(form.percent.first),
            rewardSecond:
                form.rewardsMode === "fixed"
                    ? toMoney(form.fixed.second)
                    : toMoney(form.percent.second),
            rewardThird:
                form.rewardsMode === "fixed"
                    ? toMoney(form.fixed.third)
                    : toMoney(form.percent.third),

            status: "DRAFT",
        } as CreateTournamentPayload

        try {
            setSubmitting(true)
            const created = await createTournament(payload, posterFile)
            navigate(`/turniri/${created.slug ?? created.uuid}`)
        } catch (err: any) {
            console.error(err)
            alert(err?.message ?? "Failed to save tournament")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <chakra.form onSubmit={handleSubmit}>
            <VStack align="stretch" gap="4">
                {/* ===================== Card 1: Basic info + poster ===================== */}
                <SectionCard
                    icon={<FiInfo />}
                    title="Osnovne informacije"
                >
                    <VStack align="stretch" gap="4">
                        <Box
                            display="grid"
                            gridTemplateColumns={{ base: "1fr", md: "1fr 1fr" }}
                            gap="4"
                        >
                            <Field.Root required>
                                <Field.Label>
                                    Ime turnira <Field.RequiredIndicator />
                                </Field.Label>
                                <Input
                                    placeholder="npr. Bela open"
                                    value={form.name}
                                    onChange={(e) => onChange("name", e.target.value)}
                                />
                            </Field.Root>

                            <Field.Root required>
                                <Field.Label>
                                    Lokacija <Field.RequiredIndicator />
                                </Field.Label>
                                <LocationAutocomplete
                                    value={form.location}
                                    onChange={(v) => onChange("location", v)}
                                    placeholder="npr. Caffe bar Belot, Zagreb"
                                />
                            </Field.Root>
                        </Box>

                        {/* Datetime + max pairs — combined date/time picker */}
                        <Box
                            display="grid"
                            gridTemplateColumns={{ base: "1fr", md: "2fr 1fr" }}
                            gap="4"
                        >
                            <Field.Root required>
                                <Field.Label>
                                    Datum i vrijeme <Field.RequiredIndicator />
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
                                        timeCaption="Vrijeme"
                                        dateFormat="dd/MM/yyyy HH:mm"
                                        locale="hr"
                                        minDate={new Date()}
                                        placeholderText="DD/MM/GGGG HH:MM"
                                        // Stretch the underlying <input> to fill the
                                        // field width — the library renders a tiny
                                        // input by default.
                                        wrapperClassName="bela-datepicker-input-wrap"
                                        className="bela-datepicker-input"
                                        popperPlacement="bottom-start"
                                    />
                                </Box>
                            </Field.Root>
                            <Field.Root>
                                <Field.Label>Max. parova</Field.Label>
                                <Input
                                    type="number"
                                    inputMode="numeric"
                                    min={2}
                                    placeholder="npr. 32"
                                    value={form.maxPairs}
                                    onChange={(e) => handleMaxPairsChange(e.target.value)}
                                    onBlur={handleMaxPairsBlur}
                                />
                            </Field.Root>
                        </Box>

                        <Field.Root>
                            <Field.Label>Detalji</Field.Label>
                            <Textarea
                                rows={3}
                                placeholder="Dodatne informacije - pravila, parking, hrana, piće..."
                                value={form.details}
                                onChange={(e) => onChange("details", e.target.value)}
                            />
                        </Field.Root>

                        {/* Poster picker — inline within the card */}
                        <Box>
                            <HStack gap="2" mb="2" fontSize="sm" fontWeight="medium">
                                <FiImage />
                                <Text>
                                    Plakat <chakra.span color="fg.muted" fontWeight="normal">(opcionalno)</chakra.span>
                                </Text>
                            </HStack>

                            <HStack align="start" gap="3" wrap="wrap">
                                {(posterPreviewUrl || form.posterUrl) ? (
                                    <Box
                                        position="relative"
                                        borderWidth="1px"
                                        rounded="md"
                                        overflow="hidden"
                                        w="120px"
                                        h="120px"
                                    >
                                        <img
                                            src={posterPreviewUrl || form.posterUrl!}
                                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                        />
                                        <IconButton
                                            type="button"
                                            aria-label="Ukloni plakat"
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
                                        w="120px"
                                        h="120px"
                                        borderWidth="1px"
                                        borderStyle="dashed"
                                        borderColor="border.subtle"
                                        rounded="md"
                                        display="flex"
                                        alignItems="center"
                                        justifyContent="center"
                                        color="fg.muted"
                                    >
                                        <FiImage size={28} />
                                    </Box>
                                )}

                                <VStack align="start" gap="1" flex="1" minW="200px">
                                    <Button
                                        as="label"
                                        variant="outline"
                                        colorPalette="blue"
                                        size="sm"
                                        cursor="pointer"
                                    >
                                        {posterFile ? "Promijeni sliku" : "Odaberi sliku"}
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
                                        <Text color="red.600" fontSize="xs">{uploadErr}</Text>
                                    ) : (
                                        <Text color="fg.muted" fontSize="xs">
                                            PNG, JPG ili WEBP, do {MAX_MB} MB.
                                        </Text>
                                    )}
                                </VStack>
                            </HStack>
                        </Box>
                    </VStack>
                </SectionCard>

                {/* ===================== Card 2: Pricing & repassage ===================== */}
                <SectionCard
                    icon={<FiDollarSign />}
                    title="Kotizacija i repasaž"
                >
                    {/* Single row: kotizacija + repasaž + drugi repasaž slot + repasaž do */}
                    <Box
                        display="grid"
                        gridTemplateColumns={{ base: "1fr", md: "140px 140px 140px 1fr" }}
                        gap="4"
                        alignItems="start"
                    >
                        <Field.Root>
                            <Field.Label>Kotizacija</Field.Label>
                            <SuffixInput
                                value={form.entryPrice}
                                onChange={(v) => handleMoneyChange("entryPrice", v)}
                                placeholder="30"
                                suffix="€"
                            />
                            <PerPairHint value={entryPair} />
                        </Field.Root>

                        <Field.Root>
                            <Field.Label>Repasaž</Field.Label>
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
                                Drugi repasaž <chakra.span fontSize="xs">(opc.)</chakra.span>
                            </Field.Label>
                            <SuffixInput
                                value={form.repassageSecondPrice}
                                onChange={(v) => handleMoneyChange("repassageSecondPrice", v)}
                                placeholder="—"
                                suffix="€"
                            />
                            <PerPairHint value={rep2Pair} />
                        </Field.Root>

                        <Field.Root>
                            <Field.Label>Repasaž moguć do</Field.Label>
                            <RadioGroup.Root
                                value={form.repassageUntil}
                                onValueChange={(v) =>
                                    onChange(
                                        "repassageUntil",
                                        (typeof v === "string" ? v : (v as any)?.value) as RepassageEndsAt
                                    )
                                }
                            >
                                <HStack gap="5" wrap="wrap" rowGap="2" pt="2">
                                    <RadioGroup.Item value="finals">
                                        <RadioGroup.ItemHiddenInput />
                                        <RadioGroup.ItemIndicator />
                                        <RadioGroup.ItemText>Finala</RadioGroup.ItemText>
                                    </RadioGroup.Item>
                                    <RadioGroup.Item value="semifinals">
                                        <RadioGroup.ItemHiddenInput />
                                        <RadioGroup.ItemIndicator />
                                        <RadioGroup.ItemText>Polufinala</RadioGroup.ItemText>
                                    </RadioGroup.Item>
                                </HStack>
                            </RadioGroup.Root>
                            <Field.HelperText>
                                Zadnja runda prije koje je moguće kupiti dodatni život.
                            </Field.HelperText>
                        </Field.Root>
                    </Box>
                </SectionCard>

                {/* ===================== Card 4: Rewards ===================== */}
                <SectionCard
                    icon={<FiGift />}
                    title="Nagrade"
                >
                    <VStack align="stretch" gap="4">
                        <RadioGroup.Root
                            value={form.rewardsMode}
                            onValueChange={(v) =>
                                onChange("rewardsMode", (typeof v === "string" ? v : (v as any)?.value) as RewardsMode)
                            }
                        >
                            <HStack gap="6" wrap="wrap" rowGap="2">
                                <RadioGroup.Item value="fixed">
                                    <RadioGroup.ItemHiddenInput />
                                    <RadioGroup.ItemIndicator />
                                    <RadioGroup.ItemText>Fixne nagrade (€)</RadioGroup.ItemText>
                                </RadioGroup.Item>
                                <RadioGroup.Item value="percentage">
                                    <RadioGroup.ItemHiddenInput />
                                    <RadioGroup.ItemIndicator />
                                    <RadioGroup.ItemText>Postotak fonda (%)</RadioGroup.ItemText>
                                </RadioGroup.Item>
                            </HStack>
                        </RadioGroup.Root>

                        {form.rewardsMode === "fixed" ? (
                            <Box
                                display="grid"
                                gridTemplateColumns={{ base: "1fr", md: "1fr 1fr 1fr" }}
                                gap="4"
                            >
                                <Field.Root required>
                                    <Field.Label>1. mjesto <Field.RequiredIndicator /></Field.Label>
                                    <SuffixInput
                                        value={form.fixed.first}
                                        onChange={(v) => onNested("fixed", "first", sanitizeMoneyInput(v))}
                                        placeholder="npr. 200"
                                        suffix="€"
                                    />
                                </Field.Root>
                                <Field.Root required>
                                    <Field.Label>2. mjesto <Field.RequiredIndicator /></Field.Label>
                                    <SuffixInput
                                        value={form.fixed.second}
                                        onChange={(v) => onNested("fixed", "second", sanitizeMoneyInput(v))}
                                        placeholder="npr. 120"
                                        suffix="€"
                                    />
                                </Field.Root>
                                <Field.Root required>
                                    <Field.Label>3. mjesto <Field.RequiredIndicator /></Field.Label>
                                    <SuffixInput
                                        value={form.fixed.third}
                                        onChange={(v) => onNested("fixed", "third", sanitizeMoneyInput(v))}
                                        placeholder="npr. 60"
                                        suffix="€"
                                    />
                                </Field.Root>
                            </Box>
                        ) : (
                            <>
                                <Box
                                    display="grid"
                                    gridTemplateColumns={{ base: "1fr", md: "1fr 1fr 1fr" }}
                                    gap="4"
                                >
                                    <Field.Root required>
                                        <Field.Label>1. mjesto <Field.RequiredIndicator /></Field.Label>
                                        <SuffixInput
                                            value={form.percent.first}
                                            onChange={(v) => onNested("percent", "first", sanitizeMoneyInput(v))}
                                            placeholder="npr. 50"
                                            suffix="%"
                                        />
                                    </Field.Root>
                                    <Field.Root required>
                                        <Field.Label>2. mjesto <Field.RequiredIndicator /></Field.Label>
                                        <SuffixInput
                                            value={form.percent.second}
                                            onChange={(v) => onNested("percent", "second", sanitizeMoneyInput(v))}
                                            placeholder="npr. 30"
                                            suffix="%"
                                        />
                                    </Field.Root>
                                    <Field.Root required>
                                        <Field.Label>3. mjesto <Field.RequiredIndicator /></Field.Label>
                                        <SuffixInput
                                            value={form.percent.third}
                                            onChange={(v) => onNested("percent", "third", sanitizeMoneyInput(v))}
                                            placeholder="npr. 20"
                                            suffix="%"
                                        />
                                    </Field.Root>
                                </Box>
                            </>
                        )}
                    </VStack>
                </SectionCard>

                {/* ===================== Card 5: Contact ===================== */}
                <SectionCard
                    icon={<FiPhone />}
                    title="Kontakt organizatora"
                >
                    <Box
                        display="grid"
                        gridTemplateColumns={{ base: "1fr", md: "1fr 1fr" }}
                        gap="4"
                    >
                        <Field.Root>
                            <Field.Label>Ime</Field.Label>
                            <Input
                                placeholder="Ime organizatora"
                                value={form.contactName}
                                onChange={(e) => onChange("contactName", e.target.value)}
                            />
                        </Field.Root>
                        <Field.Root>
                            <Field.Label>Broj telefona</Field.Label>
                            <HStack gap="2">
                                <NativeSelect.Root size="md" w="120px" flexShrink={0}>
                                    <NativeSelect.Field
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
                                    inputMode="numeric"
                                    pattern="[0-9 ]*"
                                    placeholder="91 234 5678"
                                    value={form.contactPhone}
                                    onChange={(e) => onChange("contactPhone", sanitizePhone(e.target.value))}
                                />
                            </HStack>
                        </Field.Root>
                    </Box>
                </SectionCard>

                {/* spacer so the sticky bar doesn't cover the last card on short pages */}
                <Box h="2" />
            </VStack>

            {/* ===================== Sticky action bar ===================== */}
            <Box
                position="sticky"
                bottom="0"
                bg="bg"
                borderTopWidth="1px"
                borderColor="border.subtle"
                mt="4"
                py="3"
                style={{ marginLeft: "calc(-1 * var(--chakra-spacing-4))", marginRight: "calc(-1 * var(--chakra-spacing-4))" }}
                px="4"
            >
                <HStack justify="flex-end" gap="2" wrap="wrap">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => window.history.back()}
                    >
                        Odustani
                    </Button>
                    <Button
                        type="submit"
                        variant="solid"
                        colorPalette="blue"
                        loading={submitting}
                        disabled={missingRequired.length > 0 || submitting}
                    >
                        Kreiraj turnir
                    </Button>
                </HStack>
            </Box>
        </chakra.form>
    )
}
