import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { ChakraProvider, defaultSystem } from "@chakra-ui/react"
import { ColorModeProvider } from "./color-mode"
import { system } from "./system"
import { AuthProvider } from "./auth/AuthContext"
import AppToaster from "./components/AppToaster"
import App from "./App"

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <ChakraProvider value={system ?? defaultSystem}>
            <ColorModeProvider>
                <AuthProvider>
                    <BrowserRouter>
                        <App />
                    </BrowserRouter>
                </AuthProvider>
            </ColorModeProvider>
            {/* Toast viewport. Mounted at root so toasts survive route
                changes. The shared toaster instance lives in src/toaster.ts
                and is imported by both AppToaster (rendering) and
                api/http.ts (the axios interceptor that creates toasts). */}
            <AppToaster />
        </ChakraProvider>
    </React.StrictMode>
)
