import { useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { FileText, Printer, ShieldAlert } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getConsultationReport } from "@/lib/api"

/**
 * Écran 4 — Rapport final structuré.
 * Mise en page "document médical" avec sections, bandeau disclaimer,
 * et bouton imprimer/PDF (via le navigateur).
 */
export default function FinalReport() {
    const { threadId = "" } = useParams<{ threadId: string }>()

    const { data, isLoading, error } = useQuery({
        queryKey: ["report", threadId],
        queryFn: () => getConsultationReport(threadId),
        retry: 2,
    })

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 print:py-0">
            {/* Mandatory disclaimer banner (top, always visible, also printed) */}
            <div className="mb-6 print:mb-3 rounded-2xl bg-card border border-border p-4 flex items-start gap-3">
                <ShieldAlert className="size-5 text-secondary shrink-0 mt-0.5" strokeWidth={1.75} />
                <div className="text-sm text-foreground">
                    <strong>Ce système ne remplace pas une consultation médicale.</strong>{" "}
                    <span className="text-muted-foreground">
                        Exercice académique — orientation préliminaire uniquement.
                    </span>
                </div>
            </div>

            <div className="flex items-center justify-between mb-5 print:hidden">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="size-4" strokeWidth={1.75} />
                    Rapport d'orientation clinique
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.print()}
                    className="gap-2 rounded-xl"
                    disabled={!data}
                >
                    <Printer className="size-4" strokeWidth={1.75} />
                    Imprimer · PDF
                </Button>
            </div>

            <Card className="border-border shadow-sm print:shadow-none print:border-0">
                <CardContent className="pt-8 sm:pt-10 px-6 sm:px-10 pb-10">
                    {isLoading && (
                        <div className="space-y-4">
                            <Skeleton className="h-6 w-2/3" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-5/6" />
                            <Skeleton className="h-4 w-3/4" />
                        </div>
                    )}

                    {error && (
                        <p className="text-sm text-muted-foreground">
                            Le rapport n'est pas encore prêt. Réessayez dans quelques secondes,
                            ou revenez à l'étape de revue médecin.
                        </p>
                    )}

                    {data && (
                        <article className="prose prose-slate max-w-none text-foreground report-content">
                            {/* Render the markdown manually to keep zero new dependencies */}
                            <pre className="whitespace-pre-wrap font-sans text-[15px] leading-relaxed bg-transparent border-0 p-0 m-0">
                                {data.final_report}
                            </pre>
                        </article>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
