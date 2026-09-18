import { useEffect, useState } from "react"
import { isNative } from "./index"
import { nativeKeyboard } from "./nativeIo"

/* ──────────────────────────────────────────────────────────────────────────
   True while the software keyboard is open, native platforms only.

   `capacitor.config.ts`'s `Keyboard.resize: "body"` already keeps a focused
   input above the keyboard everywhere, but `BlokPage`'s bottom action bar is
   `position: fixed` — resize or not, a fixed element stays pinned to the
   (now keyboard-covered) bottom of the *viewport*, so it would float on top
   of whatever input the keyboard just came up for. This hook is the signal
   `BlokPage` hides that bar on. Always false on the web: a browser's virtual
   keyboard already shrinks the visual viewport under a fixed bar without
   this, and there is no `keyboardWillShow`/`keyboardWillHide` to listen to
   there anyway.
   ────────────────────────────────────────────────────────────────────── */
export function useKeyboardOpen(): boolean {
    const [open, setOpen] = useState(false)

    useEffect(() => {
        if (!isNative) return
        let cancelled = false
        let showHandle: { remove: () => void } | null = null
        let hideHandle: { remove: () => void } | null = null

        void (async () => {
            const Keyboard = await nativeKeyboard()
            if (cancelled) return
            showHandle = await Keyboard.addListener("keyboardWillShow", () => setOpen(true))
            hideHandle = await Keyboard.addListener("keyboardWillHide", () => setOpen(false))
        })()

        return () => {
            cancelled = true
            showHandle?.remove()
            hideHandle?.remove()
        }
    }, [])

    return open
}

export default useKeyboardOpen
