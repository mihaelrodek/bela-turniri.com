import { Box, Flex, Heading, Icon, Text } from "@chakra-ui/react"
import type { ElementType, ReactNode } from "react"

/* ──────────────────────────────────────────────────────────────────────────
   EmptyState — the one placeholder every "nothing here yet" branch renders.

   Before this, each list hand-rolled its own centred stack with slightly
   different padding, font sizes and colours, so an empty tournaments list and
   an empty pair board looked like two different apps. All of it is semantic
   tokens (`brand.subtle` tile, `fg.muted` copy) so both themes come for free.

   `icon` is a component reference (e.g. `FiCalendar`), not a rendered node —
   that keeps the tile's sizing in one place instead of at every call site.
   ────────────────────────────────────────────────────────────────────── */

export default function EmptyState({
    icon,
    title,
    description,
    action,
    compact = false,
}: {
    icon?: ElementType
    title: ReactNode
    description?: ReactNode
    /** Rendered under the copy — usually a single primary button. */
    action?: ReactNode
    /** Tighter vertical padding, for a state nested inside a card or tab. */
    compact?: boolean
}) {
    return (
        <Flex
            direction="column"
            align="center"
            textAlign="center"
            py={compact ? "8" : "12"}
            px="6"
            gap="3"
        >
            {icon ? (
                <Flex
                    align="center"
                    justify="center"
                    boxSize={compact ? "12" : "14"}
                    rounded="2xl"
                    bg="brand.subtle"
                    color="brand.fg"
                >
                    <Icon as={icon} boxSize={compact ? "6" : "7"} />
                </Flex>
            ) : null}
            <Box>
                <Heading size="sm" color="fg.ink">
                    {title}
                </Heading>
                {description ? (
                    <Text fontSize="sm" color="fg.muted" mt="1" maxW="sm" mx="auto">
                        {description}
                    </Text>
                ) : null}
            </Box>
            {action ? <Box pt="1">{action}</Box> : null}
        </Flex>
    )
}
