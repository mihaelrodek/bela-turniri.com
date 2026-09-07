import { Box, Card, HStack } from "@chakra-ui/react"
import type { ReactNode } from "react"

/* ──────────────────────────────────────────────────────────────────────────
   SectionCard — the bordered, titled block the create form and the organiser
   edit form are both built out of.

   The two pages shipped near-identical private copies whose comments each
   said "mirrors the other one"; they had already drifted (different header
   padding, different icon colour, only one supported a header action). This
   is the union: the details page's `action` slot on the create page's tighter
   padding, with the icon on the `brand` palette so it follows the theme.
   ────────────────────────────────────────────────────────────────────── */

export default function SectionCard({
    icon,
    title,
    description,
    action,
    children,
}: {
    /** A rendered node, e.g. `<FiInfo />`. */
    icon?: ReactNode
    title: string
    description?: string
    /** Right-aligned header slot — a small button or badge. */
    action?: ReactNode
    children: ReactNode
}) {
    return (
        <Card.Root variant="outline" rounded="xl" borderColor="border.emphasized" shadow="sm" bg="bg.panel">
            <Card.Header pb="2" pt="4" px={{ base: "4", md: "5" }}>
                <HStack justify="space-between" align="start" gap="2">
                    <Box>
                        <HStack gap="2.5" align="center">
                            {icon && (
                                <Box color="brand.fg" display="flex" alignItems="center">
                                    {icon}
                                </Box>
                            )}
                            <Card.Title fontSize="md">{title}</Card.Title>
                        </HStack>
                        {description && (
                            <Card.Description fontSize="sm" color="fg.muted" mt="1">
                                {description}
                            </Card.Description>
                        )}
                    </Box>
                    {action}
                </HStack>
            </Card.Header>
            <Card.Body pt="3" pb="4" px={{ base: "4", md: "5" }}>
                {children}
            </Card.Body>
        </Card.Root>
    )
}
