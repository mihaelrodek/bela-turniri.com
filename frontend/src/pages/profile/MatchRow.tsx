import type { BadgeProps } from "@chakra-ui/react"
import { Badge, chakra, HStack, Text } from "@chakra-ui/react"
import type { PairMatchHistory } from "../../api/publicProfile"
import { useTranslation } from "../../i18n"

export function MatchRow({ m }: { m: PairMatchHistory["matches"][number] }) {
    const { t } = useTranslation()
    const finished = m.status === "FINISHED" || m.status === "COMPLETED"
    const wonColor: BadgeProps["colorPalette"] = m.won === true ? "green" : m.won === false ? "red" : "gray"
    const wonLabel = m.isBye
        ? t("profile.match.bye")
        : m.won === true ? t("profile.match.won")
        : m.won === false ? t("profile.match.lost")
        : finished ? t("profile.match.resolved") : t("profile.match.inProgress")

    return (
        <HStack
            gap="2.5"
            wrap="wrap"
            borderWidth="1px"
            borderColor="border.emphasized"
            bg="bg"
            rounded="sm"
            px="2.5"
            py="1.5"
            fontSize="sm"
        >
            <Badge variant="outline" colorPalette="blue" size="sm">
                {t("profile.match.round", { n: m.roundNumber ?? "?" })}
            </Badge>
            {m.tableNo != null && (
                <Text color="fg.muted" fontSize="xs">{t("profile.match.table", { n: m.tableNo })}</Text>
            )}
            <Text flex="1" minW="0" lineClamp={1}>
                {t("profile.vs")} <chakra.b>{m.opponentName ?? (m.isBye ? "—" : "?")}</chakra.b>
            </Text>
            {(m.ourScore != null || m.opponentScore != null) && (
                <Text fontFamily="mono" fontWeight="semibold">
                    {m.ourScore ?? 0} : {m.opponentScore ?? 0}
                </Text>
            )}
            <Badge variant="solid" colorPalette={wonColor} size="sm">
                {wonLabel}
            </Badge>
        </HStack>
    )
}
