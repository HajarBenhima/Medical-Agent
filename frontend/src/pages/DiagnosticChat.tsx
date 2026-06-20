import { useEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useMutation, useQuery } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { Activity, Send, FileText, User } from "lucide-react"
import { toast } from "sonner"

import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { TypingIndicator } from "@/components/chat/TypingIndicator"
import { getConsultationState, resumeConsultation } from "@/lib/api"
import type { ConsultationState } from "@/lib/api"

type Bubble = {
    role: "bot" | "patient"
    text: string
    key: string
}

/**
 * Écran 2 — Conversation patient (5 questions adaptatives).
 * Layout : header conversationnel + liste de bulles + carte synthèse provisoire
 * + barre de progression + champ de saisie flottant.
 */
export default function DiagnosticChat() {
    const { threadId = "" } = useParams<{ threadId: string }>()
    const navigate = useNavigate()
    const [bubbles, setBubbles] = useState<Bubble[]>([])
    const [draft, setDraft] = useState("")
    const scrollRef = useRef<HTMLDivElement>(null)
    const seenQuestion = useRef<string | null>(null)

    const stateQuery = useQuery<ConsultationState>({
        queryKey: ["consultation", threadId],
        queryFn: () => getConsultationState(threadId),
        refetchOnWindowFocus: false,
    })

    /* When state arrives or changes, append the new bot question into the chat. */
    useEffect(() => {
        const s = stateQuery.data
        if (!s) return

        // Route away when the workflow has moved past the patient interview
        if (s.next_action === "await_physician") {
            navigate(`/consultation/${threadId}/physician`)
            return
        }
        if (s.next_action === "done") {
            navigate(`/consultation/${threadId}/report`)
            return
        }

        if (
            s.next_action === "await_patient" &&
            s.pending_question &&
            s.pending_question !== seenQuestion.current
        ) {
            seenQuestion.current = s.pending_question
            setBubbles((prev) => [
                ...prev,
                { role: "bot", text: s.pending_question!, key: `bot-${prev.length}` },
            ])
        }
    }, [stateQuery.data, navigate, threadId])

    /* Auto-scroll on new bubbles */
    useEffect(() => {
        scrollRef.current?.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: "smooth",
        })
    }, [bubbles])

    const sendAnswer = useMutation({
        mutationFn: (answer: string) => resumeConsultation(threadId, answer),
        onSuccess: (next) => {
            stateQuery.refetch()
            if (next.next_action === "await_physician") {
                navigate(`/consultation/${threadId}/physician`)
            } else if (next.next_action === "done") {
                navigate(`/consultation/${threadId}/report`)
            }
        },
        onError: (err) => {
            console.error(err)
            toast.error("La réponse n'a pas pu être envoyée. Vérifiez l'API.")
        },
    })

    const submit = (e: React.FormEvent) => {
        e.preventDefault()
        const text = draft.trim()
        if (!text || sendAnswer.isPending) return
        setBubbles((prev) => [
            ...prev,
            { role: "patient", text, key: `p-${prev.length}` },
        ])
        setDraft("")
        sendAnswer.mutate(text)
    }

    const s = stateQuery.data
    const questionCount = s?.question_count ?? 0
    const progress = Math.min(100, (questionCount / 5) * 100)
    const isWaitingBot =
        sendAnswer.isPending ||
        (stateQuery.isFetching && bubbles.length > 0 && bubbles[bubbles.length - 1]?.role === "patient")

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
            <Card className="overflow-hidden border-border shadow-sm py-0">
                {/* ---------------- Conversational header ---------------- */}
                <div className="bg-primary text-primary-foreground px-5 py-4 flex items-center gap-3">
                    <span className="grid place-items-center size-9 rounded-xl bg-primary-foreground/10">
                        <Activity className="size-5" strokeWidth={1.75} />
                    </span>
                    <div className="leading-tight">
                        <div className="text-sm font-semibold">Assistant diagnostic</div>
                        <div className="text-xs text-primary-foreground/70 flex items-center gap-1.5">
                            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse-soft" />
                            Analyse en cours
                        </div>
                    </div>
                </div>

                {/* ---------------- Bubbles ---------------- */}
                <CardContent className="p-0 pb-2">
                    <div
                        ref={scrollRef}
                        className="px-4 sm:px-5 py-5 min-h-[420px] max-h-[55vh] overflow-y-auto bg-background"
                    >
                        {/* Welcome message — only on first render before first question */}
                        {bubbles.length === 0 && (
                            <Bubble role="bot" first>
                                Bonjour. Je vais vous poser quelques questions afin de mieux
                                comprendre vos symptômes.
                            </Bubble>
                        )}

                        <AnimatePresence initial={false}>
                            {bubbles.map((b) => (
                                <motion.div
                                    key={b.key}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <Bubble role={b.role}>{b.text}</Bubble>
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {/* Synthèse provisoire card — only after first answer */}
                        {questionCount >= 1 && (
                            <ProvisionalSynthesis
                                questionCount={questionCount}
                                summary={s?.diagnostic_summary ?? null}
                                interim={s?.interim_care ?? null}
                            />
                        )}

                        {isWaitingBot && (
                            <div className="flex items-end gap-2 mt-3">
                                <AvatarDot />
                                <TypingIndicator />
                            </div>
                        )}
                    </div>

                    {/* ---------------- Progress strip ---------------- */}
                    <div className="px-5 pt-3 pb-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                            <span>Progression</span>
                            <span className="font-clinical text-foreground">
                                {Math.min(questionCount, 5)}/5
                            </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                    width: `${progress}%`,
                                    background:
                                        "linear-gradient(90deg, #C8D9E6 0%, #567C8D 60%, #2F4156 100%)",
                                }}
                            />
                        </div>
                    </div>

                    {/* ---------------- Input ---------------- */}
                    <form onSubmit={submit} className="px-5 py-4 pt-3">
                        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-1.5 focus-within:ring-2 focus-within:ring-secondary/40 transition-shadow">
                            <Input
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                placeholder="Décrivez vos symptômes…"
                                className="border-0 shadow-none focus-visible:ring-0 px-1 text-base bg-transparent"
                                disabled={sendAnswer.isPending}
                            />
                            <Button
                                type="submit"
                                size="icon"
                                className="rounded-full size-9 shrink-0"
                                disabled={!draft.trim() || sendAnswer.isPending}
                            >
                                <Send className="size-4" strokeWidth={2} />
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}

/* --------------------------------------------------------------------- */
/* Sub-components                                                         */
/* --------------------------------------------------------------------- */

function AvatarDot() {
    return (
        <span className="grid place-items-center size-7 rounded-lg bg-muted text-secondary shrink-0">
            <Activity className="size-3.5" strokeWidth={1.75} />
        </span>
    )
}

function Bubble({
    role,
    children,
    first,
}: {
    role: "bot" | "patient"
    children: React.ReactNode
    first?: boolean
}) {
    if (role === "bot") {
        return (
            <div className={`flex items-end gap-2 ${first ? "" : "mt-3"}`}>
                <AvatarDot />
                <div className="max-w-[78%] rounded-2xl rounded-bl-md bg-primary text-primary-foreground px-4 py-3 text-[15px] leading-relaxed">
                    {children}
                </div>
            </div>
        )
    }
    return (
        <div className="flex items-end gap-2 justify-end mt-3">
            <div className="max-w-[78%] rounded-2xl rounded-br-md bg-muted text-foreground px-4 py-3 text-[15px] leading-relaxed">
                {children}
            </div>
            <span className="grid place-items-center size-7 rounded-lg bg-secondary text-secondary-foreground shrink-0">
                <User className="size-3.5" strokeWidth={1.75} />
            </span>
        </div>
    )
}

function ProvisionalSynthesis({
    questionCount,
    summary,
    interim,
}: {
    questionCount: number
    summary: string | null
    interim: string | null
}) {
    // Hide until at least one answer has been given to avoid an empty card
    if (questionCount < 1) return null
    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-5 mx-auto max-w-[88%]"
        >
            <div className="rounded-2xl bg-card border border-border p-4">
                <div className="flex items-center gap-2 text-xs font-medium text-secondary mb-2">
                    <FileText className="size-3.5" strokeWidth={1.75} />
                    Synthèse provisoire
                </div>
                <dl className="space-y-1.5 text-sm">
                    <Row label="Questions posées" value={`${Math.min(questionCount, 5)} / 5`} mono />
                    {summary && <Row label="Orientation" value={truncate(summary, 90)} />}
                    {interim && !summary && <Row label="Recommandation" value={truncate(interim, 90)} />}
                </dl>
                <div className="mt-3 text-[11px] text-muted-foreground">
                    Étape {Math.min(questionCount, 5)} sur 5 du diagnostic
                </div>
            </div>
        </motion.div>
    )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="flex justify-between gap-4 items-baseline">
            <dt className="text-muted-foreground">{label}</dt>
            <dd
                className={`text-foreground text-right ${mono ? "font-clinical" : ""}`}
                style={{ maxWidth: "60%" }}
            >
                {value}
            </dd>
        </div>
    )
}

function truncate(s: string, n: number): string {
    return s.length > n ? s.slice(0, n - 1) + "…" : s
}
