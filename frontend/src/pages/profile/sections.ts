import React from "react"
import { FaTrophy } from "react-icons/fa"
import { FiBookOpen, FiFileText, FiGrid, FiLayers, FiMail, FiUsers } from "react-icons/fi"
import { NAVBAR_H } from "../../components/navChrome"

/**
 * Section list + nav sizing, split out of PublicProfilePage.tsx so the
 * shell's `sections` array and the sidebar's viewport-height clamp live next
 * to the type they describe.
 *
 * Plain `.ts` (no JSX): icons are built with `React.createElement` so this
 * file never needs the `.tsx` extension.
 */

/** Every section the owner's profile can show. */
export type ProfileSectionKey =
    | "turniri"
    | "predlosci"
    | "postavke"
    | "racuni"
    | "blok"
    | "dashboard"
    | "popis-igraca"
    | "poruke"

export type ProfileSectionDef = {
    key: ProfileSectionKey
    label: string
    icon: React.ReactNode
    /** Admin-only rows (Dashboard, Popis igrača, Poruke) get a distinct
     *  colour so an admin can spot them in the list at a glance, rather than
     *  reading every label. */
    admin?: boolean
}

/** Viewport height left for the pinned sidebar, minus a 16px breathing gap —
 *  built from NAVBAR_H's md value, the only breakpoint where it renders. */
export const SIDEBAR_MAX_H = `calc(100vh - ${NAVBAR_H.md + 24}px - 16px - env(safe-area-inset-top, 0px))`

/**
 * Builds the section list, in sidebar order. Admin entries are appended only
 * when the Firebase `role=admin` claim is present, exactly as the old tab
 * strip gated them; a non-admin never gets the row, so the lazy chunk behind
 * it is never even referenced.
 */
export function buildProfileSections(
    t: (key: string) => string,
    isAdmin: boolean,
): ProfileSectionDef[] {
    return [
        { key: "turniri", label: t("profile.tab.tournaments"), icon: React.createElement(FaTrophy, { size: 14 }) },
        { key: "predlosci", label: t("profile.tab.presets"), icon: React.createElement(FiLayers, { size: 15 }) },
        // No "postavke" row here on purpose — it's reached by clicking the
        // identity block above this list (name or the edit pencil), not by
        // its own nav item. See `ProfileIdentityBlock`'s `onEdit`.
        { key: "racuni", label: t("profile.tab.invoices"), icon: React.createElement(FiFileText, { size: 15 }) },
        // Private scorepad history (BLOK-HISTORY.md §4) — never shown on a
        // visitor's view of this page; see PublicProfilePage's isOwner branch.
        { key: "blok", label: t("profile.tab.blok"), icon: React.createElement(FiBookOpen, { size: 15 }) },
        ...(isAdmin
            ? ([
                { key: "dashboard", label: t("profile.tab.dashboard"), icon: React.createElement(FiGrid, { size: 15 }), admin: true },
                { key: "popis-igraca", label: t("profile.tab.playersList"), icon: React.createElement(FiUsers, { size: 15 }), admin: true },
                { key: "poruke", label: t("profile.tab.contactMessages"), icon: React.createElement(FiMail, { size: 15 }), admin: true },
            ] as ProfileSectionDef[])
            : []),
    ]
}
