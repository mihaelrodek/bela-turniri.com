import { useTheme } from "next-themes"

/* ──────────────────────────────────────────────────────────────────────────
   Non-component exports split out of `color-mode.tsx`.

   `react-refresh/only-export-components` wants a file that exports a React
   component (ColorModeProvider) to export ONLY components — a mixed file
   breaks fast refresh's ability to hot-swap the component without a full
   reload. These two hooks have no JSX of their own, so they live here.
   ────────────────────────────────────────────────────────────────────── */

export function useColorMode() {
    const { theme, systemTheme, setTheme } = useTheme()
    const current =
        theme === "system" ? (systemTheme as "light" | "dark" | undefined) ?? "light" : (theme as "light" | "dark")
    const toggleColorMode = () => setTheme(current === "light" ? "dark" : "light")
    const setColorMode = (v: "light" | "dark" | "system") => setTheme(v)
    return { colorMode: current, toggleColorMode, setColorMode }
}

export function useColorModeValue<T>(light: T, dark: T): T {
    const { colorMode } = useColorMode()
    return colorMode === "light" ? light : dark
}
