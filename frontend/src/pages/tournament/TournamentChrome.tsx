import { Button, HStack, IconButton, Menu } from "@chakra-ui/react"
import {
    FiCalendar,
    FiChevronLeft,
    FiCreditCard,
    FiEdit2,
    FiMoreHorizontal,
    FiTrash2,
} from "react-icons/fi"
import { FaQrcode } from "react-icons/fa"

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
    onBackToList: () => void
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
    onBackToList,
}: TournamentChromeProps) {
    const { t: tr } = useTranslation()
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
                                <Menu.Item value="back" onSelect={onBackToList}>
                                    <FiChevronLeft /> {tr("tournament.backToList")}
                                </Menu.Item>
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
    // `onBackToList` is deliberately unused here: the sidebar has no
    // overflow menu — the app navbar above it already carries the way back.
}: TournamentChromeProps) {
    const { t: tr } = useTranslation()
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
