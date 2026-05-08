import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { ChakraProvider, defaultSystem } from "@chakra-ui/react"
import { ColorModeProvider } from "./color-mode"
import { system } from "./system"
import { AuthProvider } from "./auth/AuthContext"
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
        </ChakraProvider>
    </React.StrictMode>
)