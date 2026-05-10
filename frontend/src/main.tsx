import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { ChakraProvider, defaultSystem, Toaster } from "@chakra-ui/react"
import { ColorModeProvider } from "./color-mode"
import { system } from "./system"
import { AuthProvider } from "./auth/AuthContext"
import { toaster } from "./toaster"
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
            {/* Mounted at root so toasts survive route changes. The shared
                toaster instance is imported by both main.tsx (for the
                viewport) and api/http.ts (for the axios interceptor). */}
            <Toaster toaster={toaster} />
        </ChakraProvider>
    </React.StrictMode>
)