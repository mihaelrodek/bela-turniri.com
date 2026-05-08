"use client"
import * as React from "react"
import { ThemeProvider, useTheme } from "next-themes"

export function ColorModeProvider({ children }: { children: React.ReactNode }) {
    // adds `class="light|dark"` to <html> and syncs with system
    return (
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            {children}
        </ThemeProvider>
    )
}

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