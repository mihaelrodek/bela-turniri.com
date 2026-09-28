import type { ImageProps } from "@chakra-ui/react"
import { Box, Image } from "@chakra-ui/react"
import { useColorModeValue } from "../color-mode-hooks"
import { brand, isGamesSite, siteName } from "../site"

/**
 * Product mark that follows the app's explicit theme selection.
 *
 * The full site has distinct light/dark artwork.  Using the saved app theme
 * here (instead of `prefers-color-scheme` inside one external SVG) keeps the
 * logo in step when a user chooses a theme that differs from the OS.  The
 * bela.games assets intentionally point both variants at its existing mark.
 */
export default function BrandMark({ alt = "", draggable = false, ...props }: ImageProps) {
    const src = useColorModeValue(brand.symbolLightSvg, brand.symbolDarkSvg)
    return <Image src={src} alt={alt || ""} draggable={draggable} {...props} />
}

/** Wordmark paired with the mark in app chrome; bela.games keeps its own name. */
export function BrandWordmark() {
    if (isGamesSite) return <>{siteName}</>
    return <>bela<Box as="span" color="brand.fg">·</Box>turniri</>
}
