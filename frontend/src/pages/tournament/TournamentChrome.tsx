import { useState } from "react"
import { Button, HStack, IconButton, Menu } from "@chakra-ui/react"
import {
    FiCalendar,
    FiCreditCard,
    FiEdit2,
    FiFlag,
    FiMoreHorizontal,
    FiTrash2,
} from "react-icons/fi"
import { FaQrcode } from "react-icons/fa"

import { useAuth } from "../../auth/authContextValue"
import ReportDialog from "../../components/ReportDialog"
import SyncIndicator from "../../components/SyncIndicator"
import TournamentResultsCard from "../../components/TournamentResultsCard"
import {
    TournamentMobileBar,
    TournamentSidebar,
    type TournamentSectionDef,
} from "../../components/TournamentSidebar"
import { useTranslation } from "../../i18n"
import { AddToCalendarButton, ShareButton } from "./ShareActions"
import { downloadTournamentIcs, hasCalendarDate } from "./shareUtils"
import type { TournamentDetails } from "../../types/tournaments"

/**
 * The page chrome around every section: the pinned mobile header and the lg+
 * sidebar. They are two components rather than one because they sit in
 * different places in the tree (the header is a sibling above the layout Flex,
 * the sidebar is its first column) — but they share this props shape, which is
 * what stops their action sets from drifting apart.
 */
export type TournamentChromeProps = {
    t: TournamentDetails
    /** The route's id/slug — SyncIndicator scopes the offline queue by it. */
    uuid?: string
    sections: TournamentSectionDef[]
    active: string
    onSelect: (key: string) => void
    /** True in the shell that currently owns the guided-tour anchors. */
    tourAnchors: boolean
    canEditTournament: boolean
    showEditAction: boolean
    showDeleteAction: boolean
    shareUrl: string
    onEdit: () => void
    onDelete: () => void
    onOpenQr: () => void
}

/**
 * "Prijavi turnir" wiring, shared by both shells so the phone header and the
 * desktop sidebar can never end up offering different things.
 *
 * ANONYMOUS READERS GET NOTHING — `canReport` is false without a session.
 * A report is attributed to its reporter, so a disabled item with a "Prijavi
 * se" tooltip would be an affordance that cannot work where it is shown; the
 * profile and pair entry points hide themselves on the same rule.
 *
 * The dialog lives here rather than on the page, because the page (which is
 * not part of this shell) would otherwise have to grow a prop and a piece of
 * state for something that never touches tournament data.
 */
function useReportTournament(tournament: TournamentDetails) {
    const { user } = useAuth()
    const [open, setOpen] = useState(false)
    return {
        canReport: !!user,
        openReport: () => setOpen(true),
        dialog: (
            <ReportDialog
                targetType="TOURNAMENT"
                targetId={tournament.uuid}
                targetLabel={tournament.name}
                open={open}
                onClose={() => setOpen(false)}
            />
        ),
    }
}

/** Phone / tablet: title, status, the section pills and a compact action row. */
export function TournamentTopBar({
    t,
    uuid,
    sections,
    active,
    onSelect,
    tourAnchors,
    canEditTournament,
    showEditAction,
    showDeleteAction,
    shareUrl,
    onEdit,
    onDelete,
    onOpenQr,
}: TournamentChromeProps) {
    const { t: tr } = useTranslation()
    const { canReport, openReport, dialog: reportDialog } = useReportTournament(t)
    return (
        <TournamentMobileBar
            name={t.name}
            status={t.status}
            sections={sections}
            active={active}
            onSelect={onSelect}
            tourAnchors={tourAnchors}
            actions={
                <>
                    {/* Only the organiser ever queues anything, and only they
                        need to know whether it has landed. Hidden entirely
                        while there is nothing to say. */}
                    {canEditTournament && (
                        <SyncIndicator tournamentUuid={uuid} hideWhenIdle />
                    )}
                    {showEditAction && (
                        <IconButton
                            aria-label={tr("tournament.actions.edit")}
                            title={tr("tournament.actions.edit")}
                            size="sm"
                            variant="outline"
                            rounded="full"
                            colorPalette="blue"
                            onClick={onEdit}
                        >
                            <FiEdit2 />
                        </IconButton>
                    )}
                    <ShareButton url={shareUrl} title={t.name} iconOnly />
                    {/* Everything that doesn't fit a 390px header row. A menu
                        rather than a fourth and fifth icon: the title needs the
                        width more than these do. */}
                    <Menu.Root>
                        <Menu.Trigger asChild>
                            <IconButton
                                aria-label={tr("tournament.actions.more")}
                                title={tr("tournament.actions.more")}
                                size="sm"
                                variant="outline"
                                rounded="full"
                            >
                                <FiMoreHorizontal />
                            </IconButton>
                        </Menu.Trigger>
                        <Menu.Positioner>
                            <Menu.Content minW="220px">
                                {hasCalendarDate(t) && (
                                    <Menu.Item
                                        value="calendar"
                                        onSelect={() => downloadTournamentIcs(t)}
                                    >
                                        <FiCalendar /> {tr("tournament.addToCalendar")}
                                    </Menu.Item>
                                )}
                                <Menu.Item value="qr" onSelect={onOpenQr}>
                                    <FaQrcode /> {tr("common.qr.dialogTitle")}
                                </Menu.Item>
                                {canReport && (
                                    <Menu.Item value="report" onSelect={openReport}>
                                        <FiFlag /> {tr("tournament.report.tournamentItem")}
                                    </Menu.Item>
                                )}
                                {showDeleteAction && (
                                    <Menu.Item
                                        value="delete"
                                        color="red.fg"
                                        onSelect={onDelete}
                                    >
                                        <FiTrash2 /> {tr("common.delete")}
                                    </Menu.Item>
                                )}
                            </Menu.Content>
                        </Menu.Positioner>
                    </Menu.Root>
                    {reportDialog}
                </>
            }
        />
    )
}

/** lg+: the sticky left column — nav, actions, and the podium card. */
export function TournamentSideNav({
    t,
    uuid,
    sections,
    active,
    onSelect,
    tourAnchors,
    canEditTournament,
    showEditAction,
    showDeleteAction,
    shareUrl,
    onEdit,
    onDelete,
    onOpenQr,
}: TournamentChromeProps) {
    const { t: tr } = useTranslation()
    const { canReport, openReport, dialog: reportDialog } = useReportTournament(t)
    return (
        <TournamentSidebar
            name={t.name}
            status={t.status}
            sections={sections}
            active={active}
            onSelect={onSelect}
            tourAnchors={tourAnchors}
            topSlot={
                canEditTournament ? (
                    <HStack justify="flex-end" gap="2">
                        <SyncIndicator tournamentUuid={uuid} hideWhenIdle />
                    </HStack>
                ) : undefined
            }
            primaryActions={
                showEditAction || showDeleteAction ? (
                    <>
                        {showEditAction && (
                            <Button
                                size="sm"
                                variant="outline"
                                colorPalette="blue"
                                flex="1"
                                onClick={onEdit}
                            >
                                <FiEdit2 size={14} /> {tr("tournament.actions.edit")}
                            </Button>
                        )}
                        {showDeleteAction && (
                            <Button
                                size="sm"
                                variant="outline"
                                colorPalette="red"
                                flex="1"
                                onClick={onDelete}
                            >
                                <FiTrash2 size={14} /> {tr("common.delete")}
                            </Button>
                        )}
                    </>
                ) : undefined
            }
            iconActions={
                <>
                    <ShareButton url={shareUrl} title={t.name} iconOnly />
                    <AddToCalendarButton t={t} iconOnly />
                    <IconButton
                        aria-label={tr("common.qr.dialogTitle")}
                        title={tr("common.qr.dialogTitle")}
                        size="sm"
                        variant="outline"
                        rounded="full"
                        colorPalette="blue"
                        onClick={onOpenQr}
                    >
                        <FaQrcode />
                    </IconButton>
                    {/* The "Računi" section is hidden from anyone without a
                        session (owner or code-holder) — so without this icon, a
                        viewer who was handed a code but not a `?kod=` link had
                        no way to reach the entry screen at all. Always shown; it
                        just opens the code gate for a viewer with no session
                        yet, same as the sidebar item does once they have one. */}
                    {active !== "racuni" && (
                        <IconButton
                            aria-label={tr("tournament.waiter.tab")}
                            title={tr("tournament.waiter.tab")}
                            size="sm"
                            variant="outline"
                            rounded="full"
                            colorPalette="blue"
                            onClick={() => onSelect("racuni")}
                        >
                            <FiCreditCard />
                        </IconButton>
                    )}
                    {/* Same item as the phone header's overflow menu — the
                        sidebar has no menu, so it becomes an icon. */}
                    {canReport && (
                        <IconButton
                            aria-label={tr("tournament.report.tournamentItem")}
                            title={tr("tournament.report.tournamentItem")}
                            size="sm"
                            variant="outline"
                            rounded="full"
                            onClick={openReport}
                        >
                            <FiFlag />
                        </IconButton>
                    )}
                    {reportDialog}
                </>
            }
        >
            {/* Renders nothing until a podium exists, so a DRAFT or in-progress
                tournament keeps the short sidebar. */}
            <TournamentResultsCard
                winnerName={t.winnerName}
                secondName={t.secondPlaceName}
                thirdName={t.thirdPlaceName}
            />
        </TournamentSidebar>
    )
}
