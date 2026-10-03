import { Suspense } from "react"
import { Skeleton, VStack } from "@chakra-ui/react"
import { RulesDocumentLazy } from "../../../components/rules/lazyRules"
import { formatDate } from "../../../utils/format"
import { gameParamsFromDto } from "../../../utils/tournamentForm"
import type { TournamentDetails } from "../../../types/tournaments"
import { tournamentQrRef } from "../../../components/tournamentQr"

/* "Pravila" tab (2026-10-03, owner): that tournament's own rulebook — its five
   game parameters plus the organiser's stored edits (`t.rules`, null = the
   global defaults, which is what every tournament created before this tab
   existed shows). Public: anyone who can see the tournament can read and print
   it. The document itself is the one /pravila renders; here it is told the
   tournament, so the title block, the print letterhead and the glance strip
   carry its name, date, place and values. Not sticky: the tournament page's
   own mobile band already pins itself under the navbar. */
export default function RulesSection({ t }: { t: TournamentDetails }) {
    const subtitle = [t.startAt ? formatDate(t.startAt) : "", t.location ?? ""].filter(Boolean).join(" · ")
    return (
        <Suspense
            fallback={
                <VStack align="stretch" gap="4" aria-busy="true">
                    <Skeleton height="64px" rounded="xl" />
                    <Skeleton height="240px" rounded="xl" />
                </VStack>
            }
        >
            <RulesDocumentLazy
                rules={t.rules ?? null}
                game={gameParamsFromDto(t)}
                tournament={{ name: t.name, subtitle: subtitle || undefined, qrRef: tournamentQrRef(t.uuid, t.slug) }}
                sticky={false}
            />
        </Suspense>
    )
}
