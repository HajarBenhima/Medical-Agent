import { Activity } from "lucide-react"
import { Outlet, Link } from "react-router-dom"

/**
 * Top-level layout shared by every screen.
 * - Slim header (slate) with the project mark + tagline.
 * - Persistent disclaimer banner above the footer (spec §2 — non-negotiable).
 */
export function AppShell() {
    return (
        <div className="min-h-svh flex flex-col bg-background">
            <header className="border-b border-border bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/40 sticky top-0 z-30">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    <Link
                        to="/"
                        className="flex items-center gap-3 text-foreground hover:opacity-90 transition-opacity"
                    >
                        <span className="grid place-items-center size-9 rounded-xl bg-primary text-primary-foreground">
                            <Activity className="size-5" strokeWidth={1.75} />
                        </span>
                        <div className="leading-tight">
                            <div className="font-semibold tracking-tight">
                                Assistant diagnostic
                            </div>
                            <div className="text-xs text-muted-foreground -mt-0.5">
                                Orientation clinique préliminaire
                            </div>
                        </div>
                    </Link>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="size-1.5 rounded-full bg-secondary animate-pulse-soft" />
                        EMSI · IA Distribuée
                    </div>
                </div>
            </header>

            <main className="flex-1">
                <Outlet />
            </main>

            <footer className="border-t border-border bg-card/40">
                <div className="max-w-6xl mx-auto px-6 py-4 text-center text-xs text-muted-foreground">
                    Ce système ne remplace pas une consultation médicale. Exercice
                    académique — EMSI S8, Pr. M. Youssfi.
                </div>
            </footer>
        </div>
    )
}
