import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Stethoscope, FileText, ArrowRight, AlertCircle } from "lucide-react"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { getConsultationState, resumeConsultation } from "@/lib/api"

/**
 * Écran 3 — Revue médecin (Human-in-the-Loop).
 * Split-view : synthèse en lecture seule à gauche, formulaire de traitement à droite.
 */
export default function PhysicianReview() {
    const { threadId = "" } = useParams<{ threadId: string }>()
    const navigate = useNavigate()
    const [treatment, setTreatment] = useState("")

    const { data, isLoading } = useQuery({
        queryKey: ["consultation", threadId],
        queryFn: () => getConsultationState(threadId),
        refetchOnWindowFocus: false,
    })

    const submit = useMutation({
        mutationFn: (value: string) => resumeConsultation(threadId, value),
        onSuccess: () => navigate(`/consultation/${threadId}/report`),
        onError: () => toast.error("Échec d'envoi du traitement. Vérifiez l'API."),
    })

    if (isLoading) {
        return (
            <div className="max-w-5xl mx-auto px-6 py-16 text-center text-muted-foreground">
                Chargement de la synthèse…
            </div>
        )
    }

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
            <div className="mb-8 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground mb-3">
                    <AlertCircle className="size-3.5" strokeWidth={1.75} />
                    Revue médecin requise — Human-in-the-Loop
                </div>
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                    Validation médicale
                </h1>
                <p className="text-muted-foreground mt-2 max-w-xl mx-auto text-sm">
                    Le médecin traitant relit la synthèse et propose un traitement ou une conduite
                    à tenir avant la génération du rapport final.
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
                {/* ---------- Left : agent output (read-only) ---------- */}
                <Card className="border-border shadow-sm">
                    <CardHeader className="border-b border-border/60">
                        <CardTitle className="flex items-center gap-2 text-base font-medium">
                            <FileText className="size-4 text-secondary" strokeWidth={1.75} />
                            Synthèse de l'agent
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-5 space-y-5">
                        <section>
                            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
                                Synthèse clinique préliminaire
                            </h3>
                            <p className="text-sm leading-relaxed text-foreground">
                                {data?.diagnostic_summary ?? "—"}
                            </p>
                        </section>
                        <section>
                            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
                                Recommandation intermédiaire
                            </h3>
                            <p className="text-sm leading-relaxed text-foreground">
                                {data?.interim_care ?? "—"}
                            </p>
                        </section>
                    </CardContent>
                </Card>

                {/* ---------- Right : physician input ---------- */}
                <Card className="border-border shadow-sm">
                    <CardHeader className="border-b border-border/60">
                        <CardTitle className="flex items-center gap-2 text-base font-medium">
                            <Stethoscope className="size-4 text-secondary" strokeWidth={1.75} />
                            Traitement ou conduite à tenir
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-5">
                        <form
                            onSubmit={(e) => {
                                e.preventDefault()
                                if (treatment.trim().length < 5) {
                                    toast.warning("Indiquez un traitement ou une conduite à tenir.")
                                    return
                                }
                                submit.mutate(treatment.trim())
                            }}
                            className="space-y-5"
                        >
                            <div className="space-y-2">
                                <Label htmlFor="tx" className="text-sm">
                                    Validation médicale
                                </Label>
                                <Textarea
                                    id="tx"
                                    value={treatment}
                                    onChange={(e) => setTreatment(e.target.value)}
                                    placeholder="Ex : Paracétamol 1g x3/j si fièvre, hydratation, contrôle à 48h si pas d'amélioration."
                                    className="min-h-44 resize-none text-base bg-card border-border focus-visible:ring-secondary"
                                    disabled={submit.isPending}
                                />
                            </div>
                            <Button
                                type="submit"
                                size="lg"
                                disabled={submit.isPending}
                                className="w-full gap-2 rounded-xl"
                            >
                                {submit.isPending ? "Validation…" : "Valider et générer le rapport"}
                                {!submit.isPending && <ArrowRight className="size-4" strokeWidth={2} />}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
