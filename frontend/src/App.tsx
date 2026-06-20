import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { Toaster } from "@/components/ui/sonner"
import { AppShell } from "@/components/layout/AppShell"
import PatientIntake from "@/pages/PatientIntake"
import DiagnosticChat from "@/pages/DiagnosticChat"
import PhysicianReview from "@/pages/PhysicianReview"
import FinalReport from "@/pages/FinalReport"

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 30,
            retry: 1,
            refetchOnWindowFocus: false,
        },
    },
})

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <Routes>
                    <Route element={<AppShell />}>
                        <Route index element={<PatientIntake />} />
                        <Route
                            path="/consultation/:threadId/qa"
                            element={<DiagnosticChat />}
                        />
                        <Route
                            path="/consultation/:threadId/physician"
                            element={<PhysicianReview />}
                        />
                        <Route
                            path="/consultation/:threadId/report"
                            element={<FinalReport />}
                        />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Route>
                </Routes>
            </BrowserRouter>
            <Toaster richColors position="top-center" />
        </QueryClientProvider>
    )
}

export default App
