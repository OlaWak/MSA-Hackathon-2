"use client"
import { useEffect, useState, useCallback } from "react"
import { CheckCircle, AlertTriangle, Clock, User, Shield, ChevronUp, ChevronDown, RefreshCw } from "lucide-react"

// AI_SERVER = Flask server (port 5001) — handles queue, triage, TTS, card scan
// PI_SERVER = Raspberry Pi FastAPI (port 8000) — handles /scan-age only
const AI_SERVER = process.env.NEXT_PUBLIC_AI_SERVER || "http://localhost:5001"

// ── Types ─────────────────────────────────────────────────────
type Patient = {
    id: number
    name: string
    health_id: string
    lang: string
    age_group: "Child" | "Adult" | "Senior"
    ai_priority: number
    nurse_priority: number | null
    answers: Record<string, boolean>
    status: "pending_nurse" | "nurse_verified" | "receptionist_verified"
    timestamp: string
    ai_reason?: string
}

// ── Priority Config ────────────────────────────────────────────
const PRIORITY = {
    5: { label: "Resuscitation", short: "CTAS 5", bg: "#FEE2E2", text: "#991B1B", border: "#FCA5A5", dot: "#EF4444", desc: "Immediate — life-threatening" },
    4: { label: "Emergent", short: "CTAS 4", bg: "#FEF3C7", text: "#92400E", border: "#FCD34D", dot: "#F59E0B", desc: "Seen within 15 min" },
    3: { label: "Urgent", short: "CTAS 3", bg: "#FEF3C7", text: "#78350F", border: "#FDE68A", dot: "#EAB308", desc: "Seen within 30 min" },
    2: { label: "Less Urgent", short: "CTAS 2", bg: "#DCFCE7", text: "#14532D", border: "#86EFAC", dot: "#22C55E", desc: "Seen within 60 min" },
    1: { label: "Non-Urgent", short: "CTAS 1", bg: "#F0FDF4", text: "#166534", border: "#BBF7D0", dot: "#4ADE80", desc: "Seen within 120 min" },
}

const SYMPTOM_LABELS: Record<string, string> = {
    chest_pain: "Chest Pain",
    difficulty_breathing: "Breathing Difficulty",
    dizziness: "Dizziness",
    severe_pain: "Severe Pain",
    fever: "Fever",
    vomiting: "Vomiting",
    headache: "Headache",
}

const FLAGS: Record<string, string> = {
    en: "🇨🇦", ar: "🇸🇦", fr: "🇫🇷", pa: "🇮🇳", zh: "🇨🇳", es: "🇪🇸"
}

// ── Priority Badge ────────────────────────────────────────────
function PriorityBadge({ level, size = "md" }: { level: number; size?: "sm" | "md" | "lg" }) {
    const p = PRIORITY[level as keyof typeof PRIORITY] || PRIORITY[1]
    const sizes = { sm: { num: 16, label: 9, pad: "4px 8px" }, md: { num: 22, label: 10, pad: "8px 14px" }, lg: { num: 32, label: 12, pad: "12px 20px" } }
    const s = sizes[size]
    return (
        <div style={{ background: p.bg, border: `1px solid ${p.border}`, borderRadius: 10, padding: s.pad, textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: s.num, fontWeight: 700, color: p.text, lineHeight: 1 }}>{level}</div>
            <div style={{ fontSize: s.label, color: p.text, marginTop: 2, whiteSpace: "nowrap" }}>{p.label}</div>
        </div>
    )
}

// ── Symptom Tags ──────────────────────────────────────────────
function SymptomTags({ answers }: { answers: Record<string, boolean> }) {
    const positive = Object.entries(answers).filter(([, v]) => v).map(([k]) => k)
    if (positive.length === 0) return <span style={{ fontSize: 12, color: "#94A3B8" }}>No symptoms flagged</span>
    return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {positive.map(k => (
                <span key={k} style={{
                    fontSize: 11, background: "#FEE2E2", border: "1px solid #FCA5A5",
                    borderRadius: 99, padding: "2px 8px", color: "#991B1B", fontWeight: 500,
                }}>
                    {SYMPTOM_LABELS[k] || k}
                </span>
            ))}
        </div>
    )
}

// ── Priority Adjuster ─────────────────────────────────────────
function PriorityAdjuster({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => onChange(Math.min(5, value + 1))} style={{ background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}>
                <ChevronUp size={14} />
            </button>
            <PriorityBadge level={value} size="md" />
            <button onClick={() => onChange(Math.max(1, value - 1))} style={{ background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}>
                <ChevronDown size={14} />
            </button>
        </div>
    )
}

// ── Patient Card ──────────────────────────────────────────────
function PatientCard({ patient, onVerify }: { patient: Patient; onVerify: (id: number, priority: number) => void }) {
    const [nursePriority, setNursePriority] = useState(patient.ai_priority)
    const [verifying, setVerifying] = useState(false)
    const [expanded, setExpanded] = useState(false)
    const p = PRIORITY[patient.ai_priority as keyof typeof PRIORITY] || PRIORITY[1]
    const aiMatch = nursePriority === patient.ai_priority

    const handleVerify = async () => {
        setVerifying(true)
        await onVerify(patient.id, nursePriority)
        setVerifying(false)
    }

    return (
        <div style={{
            background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 16,
            overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}>
            {/* Top stripe */}
            <div style={{ height: 4, background: p.dot }} />

            <div style={{ padding: "20px 24px" }}>
                {/* Header row */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 16 }}>
                    <PriorityBadge level={patient.ai_priority} size="md" />

                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 17, fontWeight: 600, color: "#1E293B" }}>{patient.name}</span>
                            <span style={{ fontSize: 16 }}>{FLAGS[patient.lang] || "🌐"}</span>
                            <span style={{
                                fontSize: 11, background: "#F1F5F9", border: "1px solid #E2E8F0",
                                borderRadius: 99, padding: "2px 8px", color: "#64748B", fontWeight: 500,
                            }}>{patient.age_group}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "#94A3B8" }}>
                            #{patient.health_id} · {new Date(patient.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                        <button
                            onClick={() => setExpanded(e => !e)}
                            style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 13, color: "#64748B" }}
                        >
                            {expanded ? "▲ Less" : "▼ Details"}
                        </button>
                    </div>
                </div>

                {/* Symptoms */}
                <div style={{ marginBottom: 16 }}>
                    <SymptomTags answers={patient.answers} />
                </div>

                {/* Expanded details */}
                {expanded && (
                    <div style={{ background: "#F8FAFC", borderRadius: 10, padding: 16, marginBottom: 16 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>
                            Full Symptom Review
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {Object.entries(patient.answers).map(([k, v]) => (
                                <div key={k} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{
                                        width: 20, height: 20, borderRadius: 6, background: v ? "#DCFCE7" : "#F1F5F9",
                                        border: `1px solid ${v ? "#86EFAC" : "#E2E8F0"}`,
                                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0,
                                    }}>
                                        {v ? "✓" : "–"}
                                    </span>
                                    <span style={{ fontSize: 13, color: v ? "#15803D" : "#94A3B8", fontWeight: v ? 600 : 400 }}>
                                        {SYMPTOM_LABELS[k] || k}
                                    </span>
                                </div>
                            ))}
                        </div>
                        {patient.ai_reason && (
                            <div style={{ marginTop: 12, padding: 10, background: "#EFF6FF", borderRadius: 8, border: "1px solid #BFDBFE" }}>
                                <span style={{ fontSize: 12, color: "#1D4ED8" }}>🤖 AI Reasoning: {patient.ai_reason}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Nurse verification row */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                    <div>
                        <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 6px", fontWeight: 500 }}>
                            Adjust priority if needed:
                        </p>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <PriorityAdjuster value={nursePriority} onChange={setNursePriority} />
                            {!aiMatch && (
                                <span style={{ fontSize: 11, color: "#F59E0B", background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 99, padding: "2px 8px" }}>
                                    Changed from {patient.ai_priority}
                                </span>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={handleVerify}
                        disabled={verifying}
                        style={{
                            background: verifying ? "#E2E8F0" : "#2563EB", color: "#fff", border: "none",
                            borderRadius: 10, padding: "12px 20px", fontSize: 14, fontWeight: 600,
                            cursor: verifying ? "default" : "pointer",
                            display: "flex", alignItems: "center", gap: 8,
                        }}
                    >
                        <Shield size={16} />
                        {verifying ? "Verifying..." : "Verify & Send to Receptionist"}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Main Dashboard ────────────────────────────────────────────
export default function NurseDashboard() {
    const [patients, setPatients] = useState<Patient[]>([])
    const [loading, setLoading] = useState(true)
    const [lastRefresh, setLastRefresh] = useState(new Date())
    const [newFlash, setNewFlash] = useState<number | null>(null)
    const [lastCount, setLastCount] = useState(0)

    const fetchQueue = useCallback(async () => {
        try {
            const res = await fetch(`${AI_SERVER}/queue?status=pending_nurse`)
            const data: Patient[] = await res.json()
            if (data.length > lastCount) {
                const newest = data[data.length - 1]
                setNewFlash(newest.id)
                setTimeout(() => setNewFlash(null), 4000)
            }
            setLastCount(data.length)
            setPatients(data)
            setLastRefresh(new Date())
        } catch {
            // silent retry
        } finally {
            setLoading(false)
        }
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
                body: JSON.stringify({ nurse_priority: priority, status: "nurse_verified" }),
            })
        } catch { }
    }

    const pending = patients.filter(p => p.status === "pending_nurse")
        .sort((a, b) => b.ai_priority - a.ai_priority)

    const criticalCount = pending.filter(p => p.ai_priority >= 4).length
    const urgentCount = pending.filter(p => p.ai_priority === 3).length

    return (
        <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

            {/* ── Header ─────────────────────────────────────────── */}
            <div style={{
                background: "#FFFFFF", borderBottom: "1px solid #E2E8F0",
                padding: "0 32px", display: "flex", alignItems: "center",
                justifyContent: "space-between", height: 64,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ background: "linear-gradient(135deg, #2563EB, #1D4ED8)", borderRadius: 10, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <span style={{ color: "#fff", fontSize: 16, fontWeight: 800 }}>+</span>
                        </div>
                        <span style={{ fontWeight: 800, fontSize: 18 }}>
                            <span style={{ color: "#2563EB" }}>Fast</span>
                            <span style={{ color: "#EF4444" }}>ER</span>
                        </span>
                    </div>
                    <div style={{ width: 1, height: 24, background: "#E2E8F0" }} />
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "#1E293B" }}>Nurse Dashboard</div>
                        <div style={{ fontSize: 11, color: "#94A3B8" }}>Triage Verification</div>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                    {/* Stats */}
                    <div style={{ display: "flex", gap: 16 }}>
                        <Stat value={pending.length} label="Pending" color="#2563EB" />
                        <Stat value={criticalCount} label="Critical" color="#EF4444" />
                        <Stat value={urgentCount} label="Urgent" color="#F59E0B" />
                    </div>

                    <button onClick={fetchQueue} style={{ background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 8, padding: "6px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#64748B" }}>
                        <RefreshCw size={13} /> Refresh
                    </button>

                    <div style={{ fontSize: 11, color: "#94A3B8" }}>
                        Updated {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </div>
                </div>
            </div>

            {/* ── Info Banner ────────────────────────────────────── */}
            <div style={{ background: "#EFF6FF", borderBottom: "1px solid #BFDBFE", padding: "10px 32px", display: "flex", alignItems: "center", gap: 8 }}>
                <Shield size={14} color="#2563EB" />
                <span style={{ fontSize: 13, color: "#1D4ED8" }}>
                    Review AI-assigned priority for each patient. Adjust if needed, then verify to send to the receptionist queue.
                </span>
            </div>

            {/* ── Content ────────────────────────────────────────── */}
            <div style={{ padding: "28px 32px", maxWidth: 900, margin: "0 auto" }}>

                {loading ? (
                    <div style={{ textAlign: "center", padding: 60, color: "#94A3B8" }}>Loading patients...</div>
                ) : pending.length === 0 ? (
                    <EmptyState />
                ) : (
                    <>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                            <Clock size={14} color="#64748B" />
                            <span style={{ fontSize: 13, fontWeight: 500, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                Awaiting Nurse Verification — {pending.length} patient{pending.length !== 1 ? "s" : ""}
                            </span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
    return (
        <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>{label}</div>
        </div>
    )
}

function EmptyState() {
    return (
        <div style={{
            background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 16,
            padding: 60, textAlign: "center",
        }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "#1E293B", marginBottom: 8 }}>All caught up!</div>
            <div style={{ fontSize: 14, color: "#94A3B8" }}>No patients pending nurse verification right now.</div>
        </div>
    )
}