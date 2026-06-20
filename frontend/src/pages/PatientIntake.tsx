import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useMutation } from "@tanstack/react-query"
import { Stethoscope, ArrowRight, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { startConsultation, startSession } from "@/lib/api"

/**
 * Écran 1 — Saisie du cas initial patient.
 * Le patient (ou son aidant) décrit librement son cas avant que
 * le Diagnostic Agent ne prenne le relais.
 */
export default function PatientIntake() {
    const [patientCase, setPatientCase] = useState("")
    const navigate = useNavigate()

    const mutation = useMutation({
        mutationFn: async (initialCase: string) => {
            const { thread_id } = await startSession()
            await startConsultation(thread_id, initialCase)
            return thread_id
        },
        onSuccess: (threadId) => navigate(`/consultation/${threadId}/qa`),
        onError: (err) => {
            console.error(err)
            toast.error("Impossible de démarrer la consultation. Vérifiez que l'API tourne (port 8000).")
        },
    })

    const submit = (e: React.FormEvent) => {
        e.preventDefault()
        if (patientCase.trim().length < 10) {
            toast.warning("Merci de décrire un peu plus précisément votre situation.")
            return
        }
        mutation.mutate(patientCase.trim())
    }

    return (
        <div className="max-w-3xl mx-auto px-6 py-12 sm:py-16">
            <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground mb-4">
                    <ShieldCheck className="size-3.5" strokeWidth={1.75} />
                    Confidentiel · données conservées le temps de la session
                </div>
                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-3">
                    Décrivez votre situation
                </h1>
                <p className="text-muted-foreground max-w-lg mx-auto">
                    Notre assistant va analyser votre cas et vous orienter avec une synthèse
                    préliminaire validée par un médecin.
                </p>
            </div>

            <Card className="border-border shadow-sm">
                <CardHeader className="border-b border-border/60">
                    <CardTitle className="flex items-center gap-2 text-base font-medium">
                        <Stethoscope className="size-4 text-secondary" strokeWidth={1.75} />
                        Cas patient initial
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <form onSubmit={submit} className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="case" className="text-sm">
                                Symptômes, durée, contexte
                            </Label>
                            <Textarea
                                id="case"
                                value={patientCase}
                                onChange={(e) => setPatientCase(e.target.value)}
                                placeholder="Ex : J'ai mal à la tête depuis trois jours, surtout le matin. Fièvre légère et sensation de fatigue."
                                className="min-h-36 resize-none text-base bg-card border-border focus-visible:ring-secondary"
                                disabled={mutation.isPending}
                            />
                            <p className="text-xs text-muted-foreground">
                                Plus le contexte est précis, plus l'orientation préliminaire sera adaptée.
                            </p>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <p className="text-xs text-muted-foreground max-w-sm">
                                Ce système ne remplace pas une consultation médicale.
                            </p>
                            <Button
                                type="submit"
                                size="lg"
                                disabled={mutation.isPending}
                                className="gap-2 rounded-xl"
                            >
                                {mutation.isPending ? "Démarrage…" : "Démarrer la consultation"}
                                {!mutation.isPending && <ArrowRight className="size-4" strokeWidth={2} />}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
