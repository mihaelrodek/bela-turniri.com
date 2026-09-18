"use client"
import * as React from "react"
import { ThemeProvider, useTheme } from "next-themes"

// `useColorMode` / `useColorModeValue` live in the sibling `color-mode-hooks.ts`
// now — react-refresh/only-export-components wants a file that exports a
// component to export ONLY components, and mixing hooks in here broke fast
// refresh for ColorModeProvider. Importers: see that file.

/** `bg.canvas` dark value from src/system.ts (#161719, slightly off Chakra's
 *  gray.950 as of 2026-09-08); light is plain white, matching
 *  manifest.webmanifest's background_color. Kept here (not imported from
 *  system.ts) because that file is a Chakra system config, not a small
 *  constant module — pulling it in for two hex strings would drag the whole
 *  theme build into this tiny component. */
const THEME_COLOR_DARK = "#161719"
const THEME_COLOR_LIGHT = "#ffffff"

/**
 * Keeps the browser's own chrome (Android status bar/task-switcher card,
 * Safari's URL bar tint) matching the app's ACTUAL live theme.
 *
 * index.html ships a light `<meta name="theme-color">` for the first paint,
 * before any JS runs. Once mounted, this writes a second, dynamic meta that
 * follows the actual saved app mode. Browsers use the LAST matching
 * `theme-color` meta in document order, so this one wins from mount onward
 * and updates live on every toggle.
 */
function ThemeColorSync() {
    const { theme, systemTheme } = useTheme()
    const current = theme === "system" ? systemTheme : theme

    React.useEffect(() => {
        const color = current === "dark" ? THEME_COLOR_DARK : THEME_COLOR_LIGHT
        let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][data-dynamic]')
        if (!meta) {
            meta = document.createElement("meta")
            meta.setAttribute("name", "theme-color")
            meta.setAttribute("data-dynamic", "true")
            document.head.appendChild(meta)
        }
        meta.setAttribute("content", color)
    }, [current])

    return null
}

export function ColorModeProvider({ children }: { children: React.ReactNode }) {
    // Light is the app's default on first visit, ignoring the OS preference.
    // Users can still toggle to dark via the theme control in the navbar;
    // their choice persists in localStorage on this device
    // (next-themes) and, once signed in, syncs to the profile itself
    // (see ThemeSync.tsx / api/userMe.ts's updateColorMode) so it follows
    // them to another browser or device too. `enableSystem={false}` keeps
    // the OS preference from silently overriding either the default or a
    // saved choice.
    return (
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
            <ThemeColorSync />
            {children}
        </ThemeProvider>
    )
}
