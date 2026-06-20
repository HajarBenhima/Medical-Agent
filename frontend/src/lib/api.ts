/**
 * Typed HTTP client for the FastAPI backend.
 *
 * Endpoints (spec §10):
 *   POST /sessions/start                  → { thread_id }
 *   POST /consultation/start              → state response
 *   POST /consultation/resume             → state response
 *   GET  /consultation/{thread_id}        → state response
 *   GET  /consultation/{thread_id}/report → { final_report }
 */

import axios from "axios"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000"

export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: { "Content-Type": "application/json" },
    timeout: 60000,
})

/* ----------------------------------------------------------------------- */
/* Types                                                                    */
/* ----------------------------------------------------------------------- */

export type NextAction =
    | "await_patient"
    | "await_physician"
    | "running"
    | "done"
    | "await_start"

export interface ConsultationState {
    thread_id: string
    next_action: NextAction
    question_count: number
    pending_question: string | null
    diagnostic_summary: string | null
    interim_care: string | null
    physician_treatment: string | null
    final_report: string | null
}

export interface SessionStartResponse {
    thread_id: string
    status: string
}

export interface ReportResponse {
    thread_id: string
    final_report: string
}

/* ----------------------------------------------------------------------- */
/* Calls                                                                    */
/* ----------------------------------------------------------------------- */

export async function startSession(): Promise<SessionStartResponse> {
    const { data } = await apiClient.post<SessionStartResponse>("/sessions/start")
    return data
}

export async function startConsultation(
    threadId: string,
    patientInitialCase: string,
): Promise<ConsultationState> {
    const { data } = await apiClient.post<ConsultationState>("/consultation/start", {
        thread_id: threadId,
        patient_initial_case: patientInitialCase,
    })
    return data
}

export async function resumeConsultation(
    threadId: string,
    value: string,
): Promise<ConsultationState> {
    const { data } = await apiClient.post<ConsultationState>("/consultation/resume", {
        thread_id: threadId,
        value,
    })
    return data
}

export async function getConsultationState(threadId: string): Promise<ConsultationState> {
    const { data } = await apiClient.get<ConsultationState>(`/consultation/${threadId}`)
    return data
}

export async function getConsultationReport(threadId: string): Promise<ReportResponse> {
    const { data } = await apiClient.get<ReportResponse>(`/consultation/${threadId}/report`)
    return data
}

export async function healthCheck(): Promise<{ status: string }> {
    const { data } = await apiClient.get<{ status: string }>("/health")
    return data
}
