import React from "react"
import { FaTrophy } from "react-icons/fa"
import { FiBarChart2, FiBookOpen, FiFileText, FiGrid, FiLayers, FiMail, FiUsers } from "react-icons/fi"
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
    | "analitika"
    | "popis-igraca"
    | "poruke"
    // bela.games only (src/site.ts) — replaces "turniri" there, see
    // buildProfileSections below: just the online-bela stats, no tournament
    // history for a site that has no tournaments.
    | "statistika"

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
export const SIDEBAR_MAX_H = `calc(100vh - ${NAVBAR_H.md + 24}px - 16px - var(--safe-top))`

/**
 * Builds the section list, in sidebar order. Admin entries are appended only
 * when the Firebase `role=admin` claim is present, exactly as the old tab
 * strip gated them; a non-admin never gets the row, so the lazy chunk behind
 * it is never even referenced.
 *
 * `isGamesSite` (src/site.ts) drops every tournament-only row: "Turniri"
 * (tournament history) becomes "Statistika" (online-bela stats only, see
 * PublicProfilePage's "statistika" tab), "Predlošci" (saved pair names for
 * tournament registration) and "Računi" (match bills) disappear entirely, and
 * so does the admin "Dashboard" (tournament management — AdminDashboardTab).
 * The other three admin rows are general-purpose (game analytics, the player
 * directory, the contact inbox) and stay on both sites.
 */
export function buildProfileSections(
    t: (key: string) => string,
    isAdmin: boolean,
    isGamesSite: boolean,
): ProfileSectionDef[] {
    return [
        // The scorepad is the primary personal tool, so keep it first in
        // both the mobile strip and the desktop sidebar.
        { key: "blok", label: t("profile.tab.blok"), icon: React.createElement(FiBookOpen, { size: 15 }) },
        isGamesSite
            ? { key: "statistika", label: t("profile.tab.gameStats"), icon: React.createElement(FiBarChart2, { size: 15 }) }
            : { key: "turniri", label: t("profile.tab.tournaments"), icon: React.createElement(FaTrophy, { size: 14 }) },
        ...(isGamesSite
            ? []
            : [
                { key: "predlosci", label: t("profile.tab.presets"), icon: React.createElement(FiLayers, { size: 15 }) },
                // No "postavke" row here on purpose — it's reached by clicking
                // the identity block above this list (name or the edit
                // pencil), not by its own nav item. See
                // `ProfileIdentityBlock`'s `onEdit`.
                { key: "racuni", label: t("profile.tab.invoices"), icon: React.createElement(FiFileText, { size: 15 }) },
            ] as ProfileSectionDef[]),
        ...(isAdmin
            ? ([
                ...(isGamesSite
                    ? []
                    : [{ key: "dashboard", label: t("profile.tab.dashboard"), icon: React.createElement(FiGrid, { size: 15 }), admin: true }]),
                { key: "analitika", label: t("profile.tab.gameAnalytics"), icon: React.createElement(FiBarChart2, { size: 15 }), admin: true },
                { key: "popis-igraca", label: t("profile.tab.playersList"), icon: React.createElement(FiUsers, { size: 15 }), admin: true },
                { key: "poruke", label: t("profile.tab.contactMessages"), icon: React.createElement(FiMail, { size: 15 }), admin: true },
            ] as ProfileSectionDef[])
            : []),
    ]
}
