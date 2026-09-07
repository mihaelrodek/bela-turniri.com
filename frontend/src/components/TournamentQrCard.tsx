import { Box, Button, Image, Text, VStack } from "@chakra-ui/react"
import { FiDownload } from "react-icons/fi"
import { FaQrcode } from "react-icons/fa"

import SectionCard from "./SectionCard"
import { useTranslation } from "../i18n"
import {
    tournamentQrImageUrl,
    tournamentQrRef,
    useTournamentQrDownload,
} from "./tournamentQr"

/* ──────────────────────────────────────────────────────────────────────────
   TournamentQrCard — the QR code as a first-class card on the Detalji view,
   not something hidden behind a dialog.

   An organiser prints this and tapes it to the door; a player at the venue
   scans it off someone's phone. Both of those want the code *visible*, which
   is why it sits in the flow of the page and the dialog stays as the
   "blow it up on a projector" affordance.

   The download button reuses `useTournamentQrDownload` — the same routine
   TournamentQrDialog uses — so there is exactly one implementation of
   fetch → blob → anchor → toast in the app.

   The plate under the <img> is a literal white rather than `bg.panel`: the
   PNG the backend renders carries its own opaque white quiet zone, so in
   dark mode a themed plate would draw a dark ring around a white square.
   Painting the plate to match also keeps the card correct if the renderer
   ever starts emitting alpha — a QR whose quiet zone follows the dark theme
   is a QR most scanners refuse. White here is a functional requirement, not
   a colour choice, hence the one exception to the semantic-token rule.
   ────────────────────────────────────────────────────────────────────── */

export default function TournamentQrCard({
    tournamentUuid,
    tournamentSlug,
    tournamentName,
}: {
    tournamentUuid: string
    tournamentSlug?: string | null
    tournamentName: string
}) {
    const { t: tr } = useTranslation()
    const ref = tournamentQrRef(tournamentUuid, tournamentSlug)
    const { downloading, download } = useTournamentQrDownload(ref)

    return (
        <SectionCard icon={<FaQrcode />} title={tr("tournament.qr.cardTitle")}>
            <VStack align="stretch" gap="3">
                <Text fontSize="sm" color="fg.muted">
                    {tr("tournament.qr.cardHint")}
                </Text>
                <Box
                    alignSelf="center"
                    bg="white"
                    borderWidth="1px"
                    borderColor="border.subtle"
                    rounded="lg"
                    p="2.5"
                    w="full"
                    maxW="220px"
                >
                    <Image
                        src={tournamentQrImageUrl(ref, 512)}
                        alt={tr("common.qr.altText", { name: tournamentName })}
                        w="full"
                        h="auto"
                        // The PNG is square by construction; declaring it up
                        // front reserves the space so the white plate does
                        // not flash as a thin bar before the image lands.
                        aspectRatio="1"
                        display="block"
                        loading="lazy"
                        draggable={false}
                    />
                </Box>
                <Button
                    size="sm"
                    variant="outline"
                    colorPalette="blue"
                    loading={downloading}
                    onClick={download}
                >
                    <FiDownload /> {tr("common.qr.downloadButton")}
                </Button>
            </VStack>
        </SectionCard>
    )
}
