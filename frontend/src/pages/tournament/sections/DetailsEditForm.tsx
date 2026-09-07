import type { ChangeEvent } from "react"
import {
    Box,
    Button,
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
import { FiDollarSign, FiGift, FiImage, FiInfo, FiPhone, FiX } from "react-icons/fi"
import DatePicker, { registerLocale } from "react-datepicker"
import { hr, sl } from "date-fns/locale"
import "react-datepicker/dist/react-datepicker.css"
import "../../../datepicker.css"

import { LocationAutocomplete } from "../../../components/LocationAutocomplete"
import LocationMapPicker from "../../../components/LocationMapPicker"
import PerPairHint from "../../../components/PerPairHint"
import SectionCard from "../../../components/SectionCard"
import SuffixInput from "../../../components/SuffixInput"
import { useTranslation } from "../../../i18n"
import { sanitizeInt, sanitizeMoney } from "../../../utils/format"
import { PHONE_COUNTRIES, sanitizePhone } from "../../../utils/phone"
import { POSTER_ACCEPT, POSTER_MAX_MB } from "../../../hooks/useTournamentEditForm"
import type { TournamentForm } from "../../../utils/tournamentForm"

/* Register both calendar locales once. The month/day names and the
   week-starts-Monday rule come from date-fns; the visible FORMAT is forced by
   the `dateFormat` prop below so it never falls back to the OS region. Which
   of the two is used is decided per render from the app's active locale — a
   Slovenian reader was getting Croatian month names before this. */
registerLocale("hr", hr)
registerLocale("sl", sl)

/**
 * "Uredi turnir" — the inline edit form on the Detalji section.
 *
 * Loaded lazily by the page shell. This module is the only thing on the
 * detail page that pulls react-datepicker, its stylesheet, the date-fns
 * locale data and Leaflet (through LocationMapPicker) — none of which a
 * spectator scrolling a finished tournament has any use for.
 *
 * Presentation only: every piece of state and the save itself live in
 * `hooks/useTournamentEditForm`.
 */
export default function DetailsEditForm({
    editForm,
    patchEdit,
    bannerUrl,
    editPickedCoords,
    setEditPickedCoords,
    posterFile,
    posterPreviewUrl,
    posterRemove,
    posterUploadErr,
    onPosterPick,
    onClearPosterPick,
    onMarkPosterForRemoval,
    editMissingRequired,
    editStartInPast,
    savingDetails,
    onCancel,
    onSave,
}: {
    editForm: TournamentForm
    patchEdit: <K extends keyof TournamentForm>(key: K, value: TournamentForm[K]) => void
    /** The poster currently stored on the server, if any. */
    bannerUrl?: string | null
    editPickedCoords: { lat: number; lng: number } | null
    setEditPickedCoords: (c: { lat: number; lng: number } | null) => void
    posterFile: File | null
    posterPreviewUrl: string | null
    posterRemove: boolean
    posterUploadErr: string | null
    onPosterPick: (file: File) => void
    onClearPosterPick: () => void
    onMarkPosterForRemoval: () => void
    editMissingRequired: string[]
    editStartInPast: boolean
    savingDetails: boolean
    onCancel: () => void
    onSave: () => void
}) {
    const { t: tr, locale } = useTranslation()

    const showLocalPreview = !!posterPreviewUrl
    const showServerPoster = !showLocalPreview && !posterRemove && !!bannerUrl

    return (
        <VStack align="stretch" gap="4">
            <SectionCard icon={<FiInfo />} title={tr("tournament.edit.sectionBasic")}>
                <VStack align="stretch" gap="4">
                    {/* Row 1 — name + datetime + maxPairs (same 3-column
                        layout as CreateTournamentPage's Osnovne informacije,
                        for consistency). */}
                    <Box display="grid" gridTemplateColumns={{ base: "1fr", md: "2fr 2fr 1fr" }} gap="4">
                        <Field.Root required>
                            <Field.Label>{tr("tournament.edit.name")} <Field.RequiredIndicator /></Field.Label>
                            <Input
                                value={editForm.name}
                                onChange={(e) => patchEdit("name", e.target.value)}
                            />
                        </Field.Root>
                        <Field.Root required>
                            <Field.Label>
                                {tr("tournament.edit.dateTime")} <Field.RequiredIndicator />
                            </Field.Label>
                            {/* Same react-datepicker config as
                                CreateTournamentPage: the app's active locale,
                                forced dd/MM/yyyy + 24h, minDate blocks past
                                picks. State still stores ISO date + HH:mm so
                                the backend payload shape is unchanged. */}
                            <Box className="bela-datepicker-wrap" w="full">
                                <DatePicker
                                    selected={
                                        editForm.startDate && editForm.startTime
                                            ? new Date(`${editForm.startDate}T${editForm.startTime}:00`)
                                            : null
                                    }
                                    onChange={(d) => {
                                        if (!d) {
                                            patchEdit("startDate", "")
                                            patchEdit("startTime", "")
                                            return
                                        }
                                        const pad = (n: number) => String(n).padStart(2, "0")
                                        const yyyy = d.getFullYear()
                                        const mm = pad(d.getMonth() + 1)
                                        const dd = pad(d.getDate())
                                        const hh = pad(d.getHours())
                                        const mi = pad(d.getMinutes())
                                        patchEdit("startDate", `${yyyy}-${mm}-${dd}`)
                                        patchEdit("startTime", `${hh}:${mi}`)
                                    }}
                                    showTimeSelect
                                    timeIntervals={15}
                                    timeFormat="HH:mm"
                                    timeCaption={tr("tournament.edit.timeCaption")}
                                    dateFormat="dd/MM/yyyy HH:mm"
                                    locale={locale}
                                    minDate={new Date()}
                                    placeholderText={tr("tournament.edit.dateTimePlaceholder")}
                                    wrapperClassName="bela-datepicker-input-wrap"
                                    className="bela-datepicker-input"
                                    popperPlacement="bottom-start"
                                />
                            </Box>
                        </Field.Root>
                        <Field.Root>
                            <Field.Label>{tr("tournament.tile.maxPairs")}</Field.Label>
                            <Input
                                type="number"
                                inputMode="numeric"
                                min={2}
                                placeholder={tr("tournament.tile.unlimited")}
                                value={editForm.maxPairs}
                                onChange={(e) => patchEdit("maxPairs", sanitizeInt(e.target.value))}
                                onBlur={() => {
                                    // Optional field — empty stays empty
                                    // ("Neodređeno"). A filled value below the
                                    // minimum snaps up to 2.
                                    const raw = editForm.maxPairs.trim()
                                    if (raw === "") return
                                    const n = parseInt(raw, 10)
                                    if (!Number.isFinite(n) || n < 2) {
                                        patchEdit("maxPairs", "2")
                                    }
                                }}
                            />
                            <Field.HelperText>
                                {tr("tournament.edit.maxPairsHelp")}
                            </Field.HelperText>
                        </Field.Root>
                    </Box>

                    {/* Row 2 — same layout as the create form: location
                        autocomplete + details textarea stack on the left, map
                        fills the right column on desktop. On mobile everything
                        collapses to one column (Lokacija → Map → Detalji). */}
                    <Box
                        display="grid"
                        gridTemplateColumns={{ base: "1fr", md: "1fr 1fr" }}
                        gap="4"
                    >
                        <Field.Root required>
                            <Field.Label>{tr("tournament.tile.location")} <Field.RequiredIndicator /></Field.Label>
                            <LocationAutocomplete
                                value={editForm.location}
                                onChange={(v) => patchEdit("location", v)}
                                onPickSuggestion={(s) => {
                                    setEditPickedCoords({ lat: s.latitude, lng: s.longitude })
                                }}
                                placeholder={tr("tournament.edit.locationPlaceholder")}
                            />
                        </Field.Root>

                        <Box
                            gridRow={{ base: "auto", md: "span 2" }}
                            gridColumn={{ base: "auto", md: "2" }}
                        >
                            <LocationMapPicker
                                value={editPickedCoords}
                                onPick={(p) => {
                                    patchEdit("location", p.displayName)
                                    setEditPickedCoords({ lat: p.lat, lng: p.lng })
                                }}
                                height={{ base: "220px", md: "100%" }}
                                minH="220px"
                            />
                        </Box>

                        <Field.Root>
                            <Field.Label>{tr("tournament.tile.details")}</Field.Label>
                            <Textarea
                                rows={3}
                                value={editForm.details}
                                onChange={(e) => patchEdit("details", e.target.value)}
                            />
                        </Field.Root>
                    </Box>

                    {/* Poster picker. Same layout/validation as
                        CreateTournamentPage. When a new file is picked, the
                        existing bannerUrl is hidden behind the local preview;
                        clicking the × either cancels the pick (if a file was
                        just picked) or marks the server-side poster for
                        deletion on Spremi. */}
                    <Box>
                        <HStack gap="2" mb="2" fontSize="sm" fontWeight="medium">
                            <FiImage />
                            <Text>
                                {tr("tournament.edit.poster")} <chakra.span color="fg.muted" fontWeight="normal">{tr("tournament.edit.optional")}</chakra.span>
                            </Text>
                        </HStack>

                        {/* Same alignment treatment as CreateTournamentPage:
                            vertically centred on desktop, horizontally centred
                            on mobile when the preview + VStack wrap. */}
                        <HStack
                            align="center"
                            gap="3"
                            wrap="wrap"
                            justify={{ base: "center", md: "flex-start" }}
                        >
                            {showLocalPreview || showServerPoster ? (
                                <Box
                                    position="relative"
                                    borderWidth="1px"
                                    rounded="md"
                                    overflow="hidden"
                                    w="120px"
                                    h="120px"
                                >
                                    <img
                                        src={showLocalPreview ? posterPreviewUrl! : bannerUrl!}
                                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                    />
                                    <IconButton
                                        type="button"
                                        aria-label={tr("tournament.edit.removePoster")}
                                        size="2xs"
                                        variant="solid"
                                        colorPalette="red"
                                        position="absolute"
                                        top="1"
                                        right="1"
                                        onClick={() => {
                                            if (showLocalPreview) {
                                                // Local pick — just discard
                                                onClearPosterPick()
                                            } else {
                                                // Persisted poster — mark for removal on save
                                                onMarkPosterForRemoval()
                                            }
                                        }}
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

                            <VStack
                                align={{ base: "center", md: "start" }}
                                gap="1"
                                flex="1"
                                minW="200px"
                            >
                                <Button
                                    as="label"
                                    variant="outline"
                                    colorPalette="blue"
                                    size="sm"
                                    cursor="pointer"
                                >
                                    {posterFile
                                        ? tr("tournament.edit.changeImage")
                                        : bannerUrl && !posterRemove
                                            ? tr("tournament.edit.replacePoster")
                                            : tr("tournament.edit.chooseImage")}
                                    <input
                                        type="file"
                                        accept={POSTER_ACCEPT.join(",")}
                                        style={{ display: "none" }}
                                        onChange={(e) => {
                                            const f = e.target.files?.[0]
                                            if (f) onPosterPick(f)
                                            // Reset so picking the same file again still fires onChange.
                                            e.target.value = ""
                                        }}
                                    />
                                </Button>
                                {posterUploadErr ? (
                                    <Text color="red.fg" fontSize="xs">{posterUploadErr}</Text>
                                ) : posterRemove ? (
                                    <Text color="orange.fg" fontSize="xs">
                                        {tr("tournament.edit.posterWillBeRemoved")}
                                    </Text>
                                ) : (
                                    <Text color="fg.muted" fontSize="xs">
                                        {tr("tournament.edit.posterHint", { mb: POSTER_MAX_MB })}
                                    </Text>
                                )}
                            </VStack>
                        </HStack>
                    </Box>
                </VStack>
            </SectionCard>

            <SectionCard icon={<FiDollarSign />} title={tr("tournament.edit.sectionFees")}>
                {/* Single row matches CreateTournamentPage: Kotizacija +
                    Repasaž + Drugi repasaž (opc.) + Repasaž moguć do, all
                    inline. */}
                <Box
                    display="grid"
                    gridTemplateColumns={{ base: "1fr", md: "140px 140px 140px 1fr" }}
                    gap="4"
                    alignItems="start"
                >
                    <Field.Root>
                        <Field.Label>{tr("tournament.tile.entryPrice")}</Field.Label>
                        <SuffixInput
                            value={editForm.entryPrice}
                            onChange={(v) => patchEdit("entryPrice", sanitizeMoney(v))}
                            suffix="€"
                        />
                        <PerPairHint value={editForm.entryPrice} />
                    </Field.Root>
                    <Field.Root>
                        <Field.Label>{tr("tournament.tile.repassage")}</Field.Label>
                        <SuffixInput
                            value={editForm.repassagePrice}
                            onChange={(v) => patchEdit("repassagePrice", sanitizeMoney(v))}
                            suffix="€"
                        />
                        <PerPairHint value={editForm.repassagePrice} />
                    </Field.Root>
                    {/* Drugi repasaž — always visible, empty = not set.
                        Matches Create exactly. */}
                    <Field.Root>
                        <Field.Label color="fg.muted">
                            {tr("tournament.tile.repassageSecond")} <chakra.span fontSize="xs">{tr("tournament.edit.optionalShort")}</chakra.span>
                        </Field.Label>
                        <SuffixInput
                            value={editForm.repassageSecondPrice}
                            onChange={(v) => patchEdit("repassageSecondPrice", sanitizeMoney(v))}
                            placeholder="—"
                            suffix="€"
                        />
                        <PerPairHint value={editForm.repassageSecondPrice} />
                    </Field.Root>
                    <Field.Root>
                        <Field.Label>{tr("tournament.edit.repassageUntilLabel")}</Field.Label>
                        <RadioGroup.Root
                            value={editForm.repassageUntil}
                            onValueChange={(v) =>
                                patchEdit(
                                    "repassageUntil",
                                    (typeof v === "string" ? v : (v as { value?: string } | null)?.value) as "FINALS" | "SEMIFINALS" | "FIRST_ROUND"
                                )
                            }
                        >
                            <HStack gap="5" wrap="wrap" rowGap="2" pt="2">
                                <RadioGroup.Item value="FINALS">
                                    <RadioGroup.ItemHiddenInput />
                                    <RadioGroup.ItemIndicator />
                                    <RadioGroup.ItemText>{tr("tournament.repassageUntil.FINALS")}</RadioGroup.ItemText>
                                </RadioGroup.Item>
                                <RadioGroup.Item value="SEMIFINALS">
                                    <RadioGroup.ItemHiddenInput />
                                    <RadioGroup.ItemIndicator />
                                    <RadioGroup.ItemText>{tr("tournament.repassageUntil.SEMIFINALS")}</RadioGroup.ItemText>
                                </RadioGroup.Item>
                                <RadioGroup.Item value="FIRST_ROUND">
                                    <RadioGroup.ItemHiddenInput />
                                    <RadioGroup.ItemIndicator />
                                    <RadioGroup.ItemText>{tr("tournament.repassageUntil.FIRST_ROUND")}</RadioGroup.ItemText>
                                </RadioGroup.Item>
                            </HStack>
                        </RadioGroup.Root>
                        <Field.HelperText>
                            {tr("tournament.edit.repassageUntilHelp")}
                        </Field.HelperText>
                    </Field.Root>
                </Box>
            </SectionCard>

            <SectionCard icon={<FiGift />} title={tr("tournament.tile.rewards")}>
                <VStack align="stretch" gap="4">
                    <RadioGroup.Root
                        value={editForm.rewardType}
                        onValueChange={(v) =>
                            patchEdit(
                                "rewardType",
                                (typeof v === "string" ? v : (v as { value?: string } | null)?.value) as "FIXED" | "PERCENTAGE"
                            )
                        }
                    >
                        <HStack gap="6" wrap="wrap" rowGap="2">
                            <RadioGroup.Item value="FIXED">
                                <RadioGroup.ItemHiddenInput />
                                <RadioGroup.ItemIndicator />
                                <RadioGroup.ItemText>{tr("tournament.edit.rewardFixed")}</RadioGroup.ItemText>
                            </RadioGroup.Item>
                            <RadioGroup.Item value="PERCENTAGE">
                                <RadioGroup.ItemHiddenInput />
                                <RadioGroup.ItemIndicator />
                                <RadioGroup.ItemText>{tr("tournament.edit.rewardPercentage")}</RadioGroup.ItemText>
                            </RadioGroup.Item>
                        </HStack>
                    </RadioGroup.Root>
                    <Box display="grid" gridTemplateColumns={{ base: "1fr", md: "1fr 1fr 1fr" }} gap="4">
                        <Field.Root required>
                            <Field.Label>{tr("tournament.place.first")} <Field.RequiredIndicator /></Field.Label>
                            <SuffixInput
                                value={editForm.rewardFirst}
                                onChange={(v) => patchEdit("rewardFirst", sanitizeMoney(v))}
                                suffix={editForm.rewardType === "FIXED" ? "€" : "%"}
                            />
                        </Field.Root>
                        <Field.Root required>
                            <Field.Label>{tr("tournament.place.second")} <Field.RequiredIndicator /></Field.Label>
                            <SuffixInput
                                value={editForm.rewardSecond}
                                onChange={(v) => patchEdit("rewardSecond", sanitizeMoney(v))}
                                suffix={editForm.rewardType === "FIXED" ? "€" : "%"}
                            />
                        </Field.Root>
                        <Field.Root required>
                            <Field.Label>{tr("tournament.place.third")} <Field.RequiredIndicator /></Field.Label>
                            <SuffixInput
                                value={editForm.rewardThird}
                                onChange={(v) => patchEdit("rewardThird", sanitizeMoney(v))}
                                suffix={editForm.rewardType === "FIXED" ? "€" : "%"}
                            />
                        </Field.Root>
                    </Box>
                </VStack>
            </SectionCard>

            <SectionCard icon={<FiPhone />} title={tr("tournament.edit.sectionContact")}>
                <Box display="grid" gridTemplateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="4">
                    <Field.Root>
                        <Field.Label>{tr("tournament.edit.contactName")}</Field.Label>
                        <Input
                            placeholder={tr("tournament.edit.contactNamePlaceholder")}
                            value={editForm.contactName}
                            onChange={(e) => patchEdit("contactName", e.target.value)}
                        />
                    </Field.Root>
                    <Field.Root>
                        <Field.Label>{tr("tournament.edit.contactPhone")}</Field.Label>
                        <HStack gap="2">
                            <NativeSelect.Root size="md" w="120px" flexShrink={0}>
                                <NativeSelect.Field
                                    value={editForm.contactPhoneCountry}
                                    onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                                        patchEdit("contactPhoneCountry", e.target.value)
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
                                placeholder={tr("tournament.edit.contactPhonePlaceholder")}
                                value={editForm.contactPhone}
                                onChange={(e) =>
                                    patchEdit("contactPhone", sanitizePhone(e.target.value))
                                }
                            />
                        </HStack>
                    </Field.Root>
                </Box>
            </SectionCard>

            {/* Sticky save bar */}
            <Box
                position="sticky"
                bottom="0"
                // Matches the create wizard's sticky submit bar — same frosted
                // surface, same hairline. Presentation only.
                layerStyle="glass.panel"
                borderTopWidth="1px"
                borderColor="border.glass"
                py="3"
                mt="2"
            >
                <HStack justify="space-between" gap="3" wrap="wrap">
                    <Text fontSize="sm" color="fg.muted">
                        {editMissingRequired.length === 0 && !editStartInPast ? (
                            <chakra.span color="green.fg">{tr("tournament.edit.readyToSave")}</chakra.span>
                        ) : editStartInPast ? (
                            <chakra.span color="red.fg">
                                {tr("tournament.edit.pastInline")}
                            </chakra.span>
                        ) : (
                            <chakra.span color="red.fg">
                                {tr("tournament.edit.missingInline", { fields: editMissingRequired.join(", ") })}
                            </chakra.span>
                        )}
                    </Text>
                    <HStack gap="2">
                        <Button variant="ghost" onClick={onCancel} disabled={savingDetails}>
                            {tr("common.cancel")}
                        </Button>
                        <Button
                            variant="solid"
                            colorPalette="blue"
                            onClick={onSave}
                            loading={savingDetails}
                            disabled={
                                editMissingRequired.length > 0 ||
                                editStartInPast ||
                                savingDetails
                            }
                        >
                            {tr("tournament.edit.saveChanges")}
                        </Button>
                    </HStack>
                </HStack>
            </Box>
        </VStack>
    )
}
