import React from "react"
import { Navigate, useLocation } from "react-router-dom"
import { Box, HStack, Spinner, Text } from "@chakra-ui/react"
import { useAuth } from "../auth/authContextValue"
import { useTranslation } from "../i18n"

/**
 * Wrap a route element to require authentication. Anonymous visitors get
 * redirected to /prijava with a `?next=` back-link (and the same value in
 * `state.from`, which older call sites still read) so login can send them back
 * where they came from. While the initial auth-state probe is running, render a
 * lightweight spinner instead of bouncing — that prevents a brief flash of
 * the login page for users who are signed-in but the SDK hasn't restored yet.
 *
 * The `?next=` form is what the axios 401 interceptor also emits, so both
 * paths into the login page look identical; LoginPage validates it through
 * `pickSafeNext` before navigating.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth()
    const location = useLocation()
    const { t } = useTranslation()

    if (loading) {
        return (
            <HStack justify="center" py="16">
                <Spinner />
                <Text color="fg.muted">{t("common.checkingAuth")}</Text>
            </HStack>
        )
    }

    if (!user) {
        const from = `${location.pathname}${location.search}`
        return (
            <Navigate
                to={`/prijava?next=${encodeURIComponent(from)}`}
                replace
                state={{ from }}
            />
        )
    }

    return <Box>{children}</Box>
}
