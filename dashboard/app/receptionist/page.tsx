"use client"
/**
 * dashboard/receptionist/page.tsx
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * WHAT THIS FILE DOES
 *   Receptionist dashboard — shows nurse-verified patients in
 *   CTAS priority order.  Receptionist clicks "Call" to send
 *   the patient to the doctor.
 *
 *   Polls Flask /queue?status=nurse_verified,receptionist_verified
 *   every 4 seconds (reads Supabase via server).
 *
 *   On "Call": PATCH /queue/<id>/verify → status = receptionist_verified
 */

import { useEffect, useState, useCallback } from "react"
import { CheckCircle, Phone, RefreshCw, Users } from "lucide-react"

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
    status: "nurse_verified" | "receptionist_verified"
    timestamp: string
    called_at?: string
}

const PRIORITY = {
    5: { label: "Resuscitation", short: "CTAS 5", color: "#EF4444", bg: "#FEE2E2", border: "#FCA5A5", text: "#991B1B" },
    4: { label: "Emergent", short: "CTAS 4", color: "#F59E0B", bg: "#FEF3C7", border: "#FCD34D", text: "#92400E" },
    3: { label: "Urgent", short: "CTAS 3", color: "#EAB308", bg: "#FEFCE8", border: "#FDE047", text: "#713F12" },
    2: { label: "Less Urgent", short: "CTAS 2", color: "#22C55E", bg: "#DCFCE7", border: "#86EFAC", text: "#14532D" },
    1: { label: "Non-Urgent", short: "CTAS 1", color: "#4ADE80", bg: "#F0FDF4", border: "#BBF7D0", text: "#166534" },
}

const SYMPTOM_LABELS: Record<string, string> = {
    chest_pain: "Chest Pain", radiating_pain: "Radiating Pain",
    difficulty_breathing: "Breathing", sweating: "Sweating",
    severe_headache: "Severe Headache", vision_change: "Vision", dizziness: "Dizziness", confusion: "Confusion",
    arm_pain: "Arm Pain", numbness: "Numbness", injury: "Injury", weakness: "Weakness",
    leg_pain: "Leg Pain", leg_injury: "Leg Injury", leg_numbness: "Leg Numbness", cannot_walk: "Can't Walk",
    abdominal_pain: "Abdominal Pain", vomiting: "Vomiting", pain_duration: "Pain >6h", fever: "Fever",
    fainting: "Fainting", allergic_reaction: "Allergic", fever_other: "High Fever", general_weakness: "Weakness",
}

const FLAGS: Record<string, string> = { en: "🇨🇦", ar: "🇸🇦", fr: "🇫🇷", pa: "🇮🇳", zh: "🇨🇳", es: "🇪🇸" }
const BODY_ICONS: Record<string, string> = { chest: "🫁", head: "🧠", arm: "💪", leg: "🦵", abdomen: "🫃", other: "🩺" }

function WaitTime({ timestamp }: { timestamp: string }) {
    const [mins, setMins] = useState(0)
    useEffect(() => {
        const update = () => setMins(Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000))
        update(); const iv = setInterval(update, 30000); return () => clearInterval(iv)
    }, [timestamp])
    const color = mins > 30 ? "#EF4444" : mins > 15 ? "#F59E0B" : "#22C55E"
    return <span style={{ fontSize: 12, color, fontWeight: 600 }}>{mins}m waiting</span>
}

function PriorityDot({ level }: { level: number }) {
    const p = PRIORITY[level as keyof typeof PRIORITY] || PRIORITY[1]
    return (
        <div style={{ width: 52, height: 52, borderRadius: 12, background: p.bg, border: `2px solid ${p.border}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: p.text, lineHeight: 1 }}>{level}</span>
            <span style={{ fontSize: 8, color: p.text, fontWeight: 600 }}>{p.label.toUpperCase().split(" ")[0]}</span>
        </div>
    )
}

// ── Next-Up Hero Card ───────────────────────────────────────────
function NextUpCard({ patient, onCall, calling }: { patient: Patient; onCall: (p: Patient) => void; calling: boolean }) {
    const pr = patient.nurse_priority ?? patient.ai_priority
    const p = PRIORITY[pr as keyof typeof PRIORITY] || PRIORITY[1]
    const symptoms = Object.entries(patient.answers).filter(([, v]) => v).map(([k]) => k)

    return (
        <div style={{ background: "#fff", border: `2px solid ${p.color}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 20px rgba(37,99,235,0.08)" }}>
            <div style={{ background: p.color, padding: "7px 20px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>⬆ NEXT TO CALL</span>
            </div>
            <div style={{ padding: "18px 22px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                    <PriorityDot level={pr} />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 22, fontWeight: 700, color: "#1E293B", marginBottom: 4 }}>{patient.name}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span>{FLAGS[patient.lang] || "🌐"}</span>
                            <span style={{ fontSize: 12, color: "#64748B", background: "#F1F5F9", borderRadius: 99, padding: "1px 8px" }}>{patient.age_group}</span>
                            <span style={{ fontSize: 12, color: "#1D4ED8", background: "#EFF6FF", borderRadius: 99, padding: "1px 8px" }}>
                                {BODY_ICONS[patient.body_part] || "🩺"} {patient.body_part}
                            </span>
                            <WaitTime timestamp={patient.timestamp} />
                        </div>
                    </div>
                </div>
                {symptoms.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 14 }}>
                        {symptoms.map(k => (
                            <span key={k} style={{ fontSize: 11, background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 99, padding: "2px 8px", color: "#991B1B" }}>
                                {SYMPTOM_LABELS[k] || k}
                            </span>
                        ))}
                    </div>
                )}
                {patient.ai_reason && (
                    <div style={{ padding: "8px 12px", background: "#EFF6FF", borderRadius: 8, marginBottom: 14, border: "1px solid #BFDBFE" }}>
                        <span style={{ fontSize: 12, color: "#1D4ED8" }}>🤖 {patient.ai_reason}</span>
                    </div>
                )}
                <button onClick={() => onCall(patient)} disabled={calling}
                    style={{ width: "100%", background: calling ? "#E2E8F0" : "#2563EB", color: calling ? "#94A3B8" : "#fff", border: "none", borderRadius: 12, padding: "16px", fontSize: 16, fontWeight: 700, cursor: calling ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                    <Phone size={18} />
                    {calling ? "Calling..." : `Call ${patient.name}`}
                </button>
            </div>
        </div>
    )
}

// ── Queue Row ───────────────────────────────────────────────────
function QueueRow({ patient, position, onCall, calling }: { patient: Patient; position: number; onCall: (p: Patient) => void; calling: boolean }) {
    const pr = patient.nurse_priority ?? patient.ai_priority
    const p = PRIORITY[pr as keyof typeof PRIORITY] || PRIORITY[1]
    const symptoms = Object.entries(patient.answers).filter(([, v]) => v).map(([k]) => k)

    return (
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#94A3B8", width: 20, textAlign: "center", flexShrink: 0 }}>{position}</span>
            <PriorityDot level={pr} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "#1E293B" }}>{patient.name}</span>
                    <span>{FLAGS[patient.lang] || "🌐"}</span>
                    <span style={{ fontSize: 11, color: "#64748B", background: "#F1F5F9", borderRadius: 99, padding: "1px 6px" }}>{patient.age_group}</span>
                    <span style={{ fontSize: 11, color: "#1D4ED8", background: "#EFF6FF", borderRadius: 99, padding: "1px 6px" }}>{BODY_ICONS[patient.body_part] || "🩺"} {patient.body_part}</span>
                    <WaitTime timestamp={patient.timestamp} />
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {symptoms.slice(0, 4).map(k => (
                        <span key={k} style={{ fontSize: 10, background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 99, padding: "1px 6px", color: "#991B1B" }}>
                            {SYMPTOM_LABELS[k] || k}
                        </span>
                    ))}
                    {symptoms.length > 4 && <span style={{ fontSize: 10, color: "#94A3B8" }}>+{symptoms.length - 4}</span>}
                </div>
            </div>
            <button onClick={() => onCall(patient)} disabled={calling}
                style={{ background: calling ? "#E2E8F0" : "#F8FAFC", color: calling ? "#94A3B8" : "#2563EB", border: `1px solid ${calling ? "#E2E8F0" : "#BFDBFE"}`, borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: calling ? "default" : "pointer", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <Phone size={14} />{calling ? "Calling..." : "Call"}
            </button>
        </div>
    )
}

// ── Main Dashboard ───────────────────────────────────────────────
export default function ReceptionistDashboard() {
    const [patients, setPatients] = useState<Patient[]>([])
    const [loading, setLoading] = useState(true)
    const [lastRefresh, setRefresh] = useState<Date | null>(null)
    const [calledIds, setCalledIds] = useState<Set<number>>(new Set())
    const [lastCount, setLastCount] = useState(0)

    const fetchQueue = useCallback(async () => {
        try {
            const res = await fetch(`${AI_SERVER}/queue?status=nurse_verified,receptionist_verified`)
            const data: Patient[] = await res.json()
            setPatients(data); setRefresh(new Date())
            setLastCount(data.filter(p => p.status === "nurse_verified").length)
        } catch { }
        setLoading(false)
    }, [])

    useEffect(() => {
        fetchQueue()
        const iv = setInterval(fetchQueue, 4000)
        return () => clearInterval(iv)
    }, [fetchQueue])

    const callPatient = async (patient: Patient) => {
        setCalledIds(s => new Set([...s, patient.id]))
        setTimeout(() => setPatients(prev => prev.map(p => p.id === patient.id ? { ...p, status: "receptionist_verified" as const } : p)), 1500)
        try { await fetch(`${AI_SERVER}/queue/${patient.id}/verify`, { method: "PATCH" }) } catch { }
    }

    const queue = patients
        .filter(p => p.status === "nurse_verified")
        .sort((a, b) => {
            const ap = a.nurse_priority ?? a.ai_priority
            const bp = b.nurse_priority ?? b.ai_priority
            if (bp !== ap) return bp - ap
            return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        })

    const done = patients
        .filter(p => p.status === "receptionist_verified")
        .sort((a, b) => new Date(b.called_at || b.timestamp).getTime() - new Date(a.called_at || a.timestamp).getTime())
        .slice(0, 12)

    const critCount = queue.filter(p => (p.nurse_priority ?? p.ai_priority) >= 4).length

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
                        <div style={{ fontSize: 15, fontWeight: 600, color: "#1E293B" }}>Receptionist Dashboard</div>
                        <div style={{ fontSize: 11, color: "#94A3B8" }}>Patient Call Queue · auto-refresh 4s</div>
                    </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                    {[{ v: queue.length, l: "In Queue", c: "#2563EB" }, { v: critCount, l: "Critical", c: "#EF4444" }, { v: done.length, l: "Called", c: "#22C55E" }].map(({ v, l, c }) => (
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

            <div style={{ padding: "24px 32px", display: "grid", gridTemplateColumns: "1fr 340px", gap: 22, maxWidth: 1300, margin: "0 auto" }}>

                {/* Main queue */}
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
                        <Users size={13} color="#64748B" />
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                            Active Queue — {queue.length} patient{queue.length !== 1 ? "s" : ""}
                        </span>
                    </div>
                    {loading ? (
                        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 16, padding: 60, textAlign: "center", color: "#94A3B8" }}>Loading...</div>
                    ) : queue.length === 0 ? (
                        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 16, padding: 60, textAlign: "center" }}>
                            <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
                            <div style={{ fontSize: 16, fontWeight: 600, color: "#334155" }}>Queue is empty</div>
                            <div style={{ fontSize: 13, color: "#94A3B8" }}>All verified patients have been called.</div>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {queue[0] && <NextUpCard patient={queue[0]} onCall={callPatient} calling={calledIds.has(queue[0].id)} />}
                            {queue.slice(1).map((p, i) => (
                                <QueueRow key={p.id} patient={p} position={i + 2} onCall={callPatient} calling={calledIds.has(p.id)} />
                            ))}
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div>
                    {/* Recently called */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                        <CheckCircle size={13} color="#64748B" />
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em" }}>Recently Called</span>
                    </div>
                    {done.length === 0 ? (
                        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: 20, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
                            No patients called yet
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                            {done.map(p => {
                                const pr = p.nurse_priority ?? p.ai_priority
                                const pc = PRIORITY[pr as keyof typeof PRIORITY] || PRIORITY[1]
                                return (
                                    <div key={p.id} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, opacity: 0.7 }}>
                                        <div style={{ width: 34, height: 34, borderRadius: 9, background: pc.bg, border: `1px solid ${pc.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                            <span style={{ fontSize: 15, fontWeight: 700, color: pc.text }}>{pr}</span>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                                            <div style={{ fontSize: 11, color: "#94A3B8" }}>{FLAGS[p.lang] || "🌐"} {p.age_group} · {BODY_ICONS[p.body_part] || "🩺"} {p.body_part}</div>
                                        </div>
                                        <CheckCircle size={14} color="#22C55E" />
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* CTAS legend */}
                    <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: 14 }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>CTAS Quick Reference</p>
                        {([5, 4, 3, 2, 1] as const).map(level => {
                            const p = PRIORITY[level]
                            const times = { 5: "Immediate", 4: "15 min", 3: "30 min", 2: "60 min", 1: "120 min" }
                            return (
                                <div key={level} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
                                    <span style={{ fontSize: 12, color: "#334155", fontWeight: 600, width: 16 }}>{level}</span>
                                    <span style={{ fontSize: 12, color: "#64748B", flex: 1 }}>{p.label}</span>
                                    <span style={{ fontSize: 11, color: "#94A3B8" }}>{times[level]}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}
