"use client"
/**
 * dashboard/nurse/page.tsx
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * WHAT THIS FILE DOES
 *   Nurse dashboard — first stop after kiosk check-in.
 *   Polls the Flask /queue endpoint (which reads from Supabase)
 *   every 5 seconds for patients with status "pending_nurse".
 *
 *   For each patient the nurse sees:
 *     • Name, age group, language, body region selected
 *     • Every symptom they answered Yes to
 *     • AI-assigned CTAS priority 1-5 + reasoning (Gemini)
 *     • Priority adjuster (↑↓) to override if clinically needed
 *     • "Verify & Send" button → PATCH /queue/<id>/nurse-verify
 *       → changes status to "nurse_verified"
 *       → patient appears in the receptionist queue
 */

import { useEffect, useState, useCallback } from "react"
import { CheckCircle, Shield, Clock, RefreshCw, ChevronUp, ChevronDown } from "lucide-react"

// Calls Flask AI server (port 5001) — which reads/writes Supabase
const AI_SERVER = process.env.NEXT_PUBLIC_AI_SERVER || "http://localhost:5001"

type Patient = {
    id: number
    name: string
    health_id: string
    lang: string
    age_group: "Child" | "Adult" | "Senior"
    body_part: string
    answers: Record<string, boolean>
    ai_priority: number
    nurse_priority: number | null
    ai_reason: string | null
    status: "pending_nurse" | "nurse_verified" | "receptionist_verified"
    timestamp: string
}

const PRIORITY = {
    5: { label: "Resuscitation", bg: "#FEE2E2", text: "#991B1B", border: "#FCA5A5", dot: "#EF4444", desc: "Immediate" },
    4: { label: "Emergent", bg: "#FEF3C7", text: "#92400E", border: "#FCD34D", dot: "#F59E0B", desc: "15 min" },
    3: { label: "Urgent", bg: "#FEFCE8", text: "#713F12", border: "#FDE047", dot: "#EAB308", desc: "30 min" },
    2: { label: "Less Urgent", bg: "#DCFCE7", text: "#14532D", border: "#86EFAC", dot: "#22C55E", desc: "60 min" },
    1: { label: "Non-Urgent", bg: "#F0FDF4", text: "#166534", border: "#BBF7D0", dot: "#4ADE80", desc: "120 min" },
}

const SYMPTOM_LABELS: Record<string, string> = {
    chest_pain: "Chest Pain", radiating_pain: "Radiating Pain", difficulty_breathing: "Breathing Difficulty",
    sweating: "Sweating/Clammy", severe_headache: "Severe Headache", vision_change: "Vision Change",
    dizziness: "Dizziness", confusion: "Confusion", arm_pain: "Arm Pain", numbness: "Numbness",
    injury: "Injury/Fall", weakness: "Weakness", leg_pain: "Leg Pain", leg_injury: "Leg Injury",
    leg_numbness: "Leg Numbness", cannot_walk: "Cannot Walk", abdominal_pain: "Abdominal Pain",
    vomiting: "Vomiting", pain_duration: "Pain >6hrs", fever: "Fever",
    fainting: "Fainting", allergic_reaction: "Allergic Reaction", fever_other: "High Fever",
    general_weakness: "General Weakness",
}

const BODY_ICONS: Record<string, string> = {
    chest: "🫁", head: "🧠", arm: "💪", leg: "🦵", abdomen: "🫃", other: "🩺",
}

const FLAGS: Record<string, string> = {
    en: "🇨🇦", ar: "🇸🇦", fr: "🇫🇷", pa: "🇮🇳", zh: "🇨🇳", es: "🇪🇸",
}

// ── Symptom Tags ────────────────────────────────────────────────
function SymptomTags({ answers }: { answers: Record<string, boolean> }) {
    const pos = Object.entries(answers).filter(([, v]) => v).map(([k]) => k)
    if (!pos.length) return <span style={{ fontSize: 12, color: "#94A3B8" }}>No symptoms flagged</span>
    return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {pos.map(k => (
                <span key={k} style={{
                    fontSize: 11, fontWeight: 500, background: "#FEE2E2",
                    border: "1px solid #FCA5A5", borderRadius: 99,
                    padding: "2px 8px", color: "#991B1B",
                }}>{SYMPTOM_LABELS[k] || k.replace(/_/g, " ")}</span>
            ))}
        </div>
    )
}

// ── Priority Badge ───────────────────────────────────────────────
function PBadge({ level, size = "md" }: { level: number; size?: "sm" | "md" }) {
    const p = PRIORITY[level as keyof typeof PRIORITY] || PRIORITY[1]
    const s = size === "sm"
        ? { num: 16, label: 9, pad: "4px 9px" }
        : { num: 22, label: 10, pad: "8px 14px" }
    return (
        <div style={{ background: p.bg, border: `1px solid ${p.border}`, borderRadius: 10, padding: s.pad, textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: s.num, fontWeight: 700, color: p.text, lineHeight: 1 }}>{level}</div>
            <div style={{ fontSize: s.label, color: p.text, marginTop: 1 }}>{p.label}</div>
        </div>
    )
}

// ── Patient Card ─────────────────────────────────────────────────
function PatientCard({ patient, onVerify }: { patient: Patient; onVerify: (id: number, priority: number) => void }) {
    const [nursePri, setNursePri] = useState(patient.ai_priority)
    const [expanded, setExpanded] = useState(false)
    const [verifying, setVerifying] = useState(false)
    const p = PRIORITY[patient.ai_priority as keyof typeof PRIORITY] || PRIORITY[1]
    const changed = nursePri !== patient.ai_priority

    return (
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ height: 4, background: p.dot }} />
            <div style={{ padding: "18px 22px" }}>

                {/* Header */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 14 }}>
                    <PBadge level={patient.ai_priority} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 17, fontWeight: 600, color: "#1E293B" }}>{patient.name}</span>
                            <span>{FLAGS[patient.lang] || "🌐"}</span>
                            <span style={{ fontSize: 11, background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 99, padding: "1px 8px", color: "#64748B" }}>{patient.age_group}</span>
                            <span style={{ fontSize: 11, background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 99, padding: "1px 8px", color: "#1D4ED8" }}>
                                {BODY_ICONS[patient.body_part] || "🩺"} {patient.body_part}
                            </span>
                        </div>
                        <div style={{ fontSize: 12, color: "#94A3B8" }}>
                            ID: {patient.health_id} · {new Date(patient.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                    </div>
                    <button onClick={() => setExpanded(e => !e)}
                        style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, color: "#64748B", flexShrink: 0 }}>
                        {expanded ? "▲ Less" : "▼ Details"}
                    </button>
                </div>

                {/* Symptoms */}
                <div style={{ marginBottom: 14 }}>
                    <SymptomTags answers={patient.answers} />
                </div>

                {/* Expanded */}
                {expanded && (
                    <div style={{ background: "#F8FAFC", borderRadius: 10, padding: 14, marginBottom: 14 }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>All Responses</p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                            {Object.entries(patient.answers).map(([k, v]) => (
                                <div key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ width: 18, height: 18, borderRadius: 5, background: v ? "#DCFCE7" : "#F1F5F9", border: `1px solid ${v ? "#86EFAC" : "#E2E8F0"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, flexShrink: 0 }}>
                                        {v ? "✓" : "–"}
                                    </span>
                                    <span style={{ fontSize: 12, color: v ? "#15803D" : "#94A3B8", fontWeight: v ? 600 : 400 }}>
                                        {SYMPTOM_LABELS[k] || k.replace(/_/g, " ")}
                                    </span>
                                </div>
                            ))}
                        </div>
                        {patient.ai_reason && (
                            <div style={{ marginTop: 10, padding: "8px 12px", background: "#EFF6FF", borderRadius: 8, border: "1px solid #BFDBFE" }}>
                                <span style={{ fontSize: 12, color: "#1D4ED8" }}>🤖 AI: {patient.ai_reason}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Nurse verify row */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                    <div>
                        <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 6px", fontWeight: 500 }}>Adjust CTAS if needed:</p>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <button onClick={() => setNursePri(p => Math.min(5, p + 1))}
                                style={{ background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}>
                                <ChevronUp size={14} />
                            </button>
                            <PBadge level={nursePri} />
                            <button onClick={() => setNursePri(p => Math.max(1, p - 1))}
                                style={{ background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}>
                                <ChevronDown size={14} />
                            </button>
                            {changed && (
                                <span style={{ fontSize: 11, color: "#F59E0B", background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 99, padding: "2px 8px" }}>
                                    Changed from {patient.ai_priority}
                                </span>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={async () => { setVerifying(true); await onVerify(patient.id, nursePri); setVerifying(false) }}
                        disabled={verifying}
                        style={{
                            background: verifying ? "#E2E8F0" : "#2563EB", color: verifying ? "#94A3B8" : "#fff",
                            border: "none", borderRadius: 10, padding: "12px 20px", fontSize: 14, fontWeight: 600,
                            cursor: verifying ? "default" : "pointer", display: "flex", alignItems: "center", gap: 8,
                        }}>
                        <Shield size={16} />
                        {verifying ? "Verifying..." : "Verify & Send to Receptionist"}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Main Dashboard ───────────────────────────────────────────────
export default function NurseDashboard() {
    const [patients, setPatients] = useState<Patient[]>([])
    const [loading, setLoading] = useState(true)
    const [lastRefresh, setRefresh] = useState<Date | null>(null)
    const [flash, setFlash] = useState<number | null>(null)
    const [lastCount, setLastCount] = useState(0)

    const fetchQueue = useCallback(async () => {
        try {
            const res = await fetch(`${AI_SERVER}/queue?status=pending_nurse`)
            const data: Patient[] = await res.json()
            if (data.length > lastCount) {
                const newest = data[data.length - 1]
                setFlash(newest.id); setTimeout(() => setFlash(null), 4000)
            }
            setLastCount(data.length); setPatients(data)
            setRefresh(new Date())
        } catch { }
        setLoading(false)
    }, [lastCount])

    useEffect(() => {
        fetchQueue()
        const iv = setInterval(fetchQueue, 5000)
        return () => clearInterval(iv)
    }, [fetchQueue])

    const handleVerify = async (id: number, priority: number) => {
        setPatients(prev => prev.filter(p => p.id !== id))
        try {
            await fetch(`${AI_SERVER}/queue/${id}/nurse-verify`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nurse_priority: priority }),
            })
        } catch { }
    }

    const pending = patients.sort((a, b) => b.ai_priority - a.ai_priority)
    const critical = pending.filter(p => p.ai_priority >= 4).length

    return (
        <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

            {/* Header */}
            <div style={{ background: "#fff", borderBottom: "1px solid #E2E8F0", padding: "0 32px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <span style={{ fontSize: 20, fontWeight: 900 }}>
                        <span style={{ color: "#2563EB" }}>Fast</span><span style={{ color: "#EF4444" }}>ER</span>
                    </span>
                    <div style={{ width: 1, height: 24, background: "#E2E8F0" }} />
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "#1E293B" }}>Nurse Dashboard</div>
                        <div style={{ fontSize: 11, color: "#94A3B8" }}>Triage Verification · auto-refresh 5s</div>
                    </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                    {[{ v: pending.length, l: "Pending", c: "#2563EB" }, { v: critical, l: "Critical (4-5)", c: "#EF4444" }].map(({ v, l, c }) => (
                        <div key={l} style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 24, fontWeight: 700, color: c, lineHeight: 1 }}>{v}</div>
                            <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>{l}</div>
                        </div>
                    ))}
                    <button onClick={fetchQueue} style={{ background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 8, padding: "6px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#64748B" }}>
                        <RefreshCw size={12} /> Refresh
                    </button>
                    <span style={{ fontSize: 11, color: "#94A3B8" }}>{lastRefresh ? lastRefresh.toLocaleTimeString() : "--"}</span>
                </div>
            </div>

            {/* Info banner */}
            <div style={{ background: "#EFF6FF", borderBottom: "1px solid #BFDBFE", padding: "8px 32px", display: "flex", alignItems: "center", gap: 8 }}>
                <Shield size={14} color="#2563EB" />
                <span style={{ fontSize: 13, color: "#1D4ED8" }}>
                    Review AI-assigned CTAS priority for each patient. Adjust if clinically needed, then verify to send to the receptionist queue.
                </span>
            </div>

            {/* Content */}
            <div style={{ padding: "24px 32px", maxWidth: 920, margin: "0 auto" }}>
                {loading ? (
                    <div style={{ textAlign: "center", padding: 60, color: "#94A3B8" }}>Loading patients...</div>
                ) : pending.length === 0 ? (
                    <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 16, padding: 60, textAlign: "center" }}>
                        <div style={{ fontSize: 42, marginBottom: 14 }}>✅</div>
                        <div style={{ fontSize: 18, fontWeight: 600, color: "#1E293B", marginBottom: 6 }}>All caught up!</div>
                        <div style={{ fontSize: 14, color: "#94A3B8" }}>No patients pending nurse verification.</div>
                    </div>
                ) : (
                    <>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
                            <Clock size={13} color="#64748B" />
                            <span style={{ fontSize: 12, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                Awaiting Verification — {pending.length} patient{pending.length !== 1 ? "s" : ""}
                            </span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                            {pending.map(p => (
                                <PatientCard key={p.id} patient={p} onVerify={handleVerify} />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
