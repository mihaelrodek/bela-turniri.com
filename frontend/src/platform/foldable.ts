import { registerPlugin, type PluginListenerHandle } from "@capacitor/core"

export type FoldBounds = {
    left: number
    top: number
    width: number
    height: number
}

export type FoldState = {
    present: boolean
    separating: boolean
    orientation: "vertical" | "horizontal" | "none"
    state: "flat" | "half-opened" | "none"
    occlusion: "full" | "none"
    bounds: FoldBounds
}

type FoldablePlugin = {
    getState(): Promise<FoldState>
    addListener(eventName: "foldChange", listener: (state: FoldState) => void): Promise<PluginListenerHandle>
}

/** Native Android bridge backed by Jetpack WindowManager. The web/PWA path
 * uses the standard viewport-segment media queries in foldable.css instead. */
export const Foldable = registerPlugin<FoldablePlugin>("Foldable")

const LENGTH_VARS = [
    "--fold-left",
    "--fold-top",
    "--fold-width",
    "--fold-height",
    "--fold-segment-start-width",
    "--fold-segment-end-left",
    "--fold-segment-start-height",
    "--fold-segment-end-top",
] as const

export function applyFoldState(state: FoldState): void {
    const root = document.documentElement
    if (!state.present || !state.separating) {
        delete root.dataset.foldOrientation
        delete root.dataset.foldState
        delete root.dataset.foldOcclusion
        for (const name of LENGTH_VARS) root.style.removeProperty(name)
        return
    }

    const { left, top, width, height } = state.bounds
    root.dataset.foldOrientation = state.orientation
    root.dataset.foldState = state.state
    root.dataset.foldOcclusion = state.occlusion
    root.style.setProperty("--fold-left", `${left}px`)
    root.style.setProperty("--fold-top", `${top}px`)
    root.style.setProperty("--fold-width", `${width}px`)
    root.style.setProperty("--fold-height", `${height}px`)

    if (state.orientation === "vertical") {
        root.style.setProperty("--fold-segment-start-width", `${left}px`)
        root.style.setProperty("--fold-segment-end-left", `${left + width}px`)
        root.style.removeProperty("--fold-segment-start-height")
        root.style.removeProperty("--fold-segment-end-top")
    } else {
        root.style.removeProperty("--fold-segment-start-width")
        root.style.removeProperty("--fold-segment-end-left")
        root.style.setProperty("--fold-segment-start-height", `${top}px`)
        root.style.setProperty("--fold-segment-end-top", `${top + height}px`)
    }
}
