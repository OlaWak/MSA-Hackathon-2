"use client"
import { useEffect, useState, useCallback } from "react"
import { CheckCircle, Phone, RefreshCw, Users, Clock } from "lucide-react"

// AI_SERVER = Flask server (port 5001) — handles queue, triage, TTS, card scan
// PI_SERVER = Raspberry Pi FastAPI (port 8000) — handles /scan-age only
const AI_SERVER = process.env.NEXT_PUBLIC_AI_SERVER || "http://localhost:5001"

type Patient = {
    id: number
    name: string
    health_id: string
    lang: string
    age_group: "Child" | "Adult" | "Senior"
    ai_priority: number
    nurse_priority: number
    answers: Record<string, boolean>
    status: "nurse_verified" | "receptionist_verified"
    timestamp: string
    called_at?: string
}

const PRIORITY = {
    5: { label: "Resuscitation", color: "#EF4444", bg: "#FEE2E2", border: "#FCA5A5", text: "#991B1B", ring: "#EF4444" },
    4: { label: "Emergent", color: "#F59E0B", bg: "#FEF3C7", border: "#FCD34D", text: "#92400E", ring: "#F59E0B" },
    3: { label: "Urgent", color: "#EAB308", bg: "#FEFCE8", border: "#FDE047", text: "#713F12", ring: "#EAB308" },
    2: { label: "Less Urgent", color: "#22C55E", bg: "#DCFCE7", border: "#86EFAC", text: "#14532D", ring: "#22C55E" },
    1: { label: "Non-Urgent", color: "#4ADE80", bg: "#F0FDF4", border: "#BBF7D0", text: "#166534", ring: "#4ADE80" },
}

const FLAGS: Record<string, string> = {
    en: "🇨🇦", ar: "🇸🇦", fr: "🇫🇷", pa: "🇮🇳", zh: "🇨🇳", es: "🇪🇸"
}

const SYMPTOM_LABELS: Record<string, string> = {
    chest_pain: "Chest Pain",
    difficulty_breathing: "Breathing",
    dizziness: "Dizziness",
    severe_pain: "Severe Pain",
    fever: "Fever",
    vomiting: "Vomiting",
    headache: "Headache",
}

function PriorityDot({ level }: { level: number }) {
    const p = PRIORITY[level as keyof typeof PRIORITY] || PRIORITY[1]
    return (
        <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: p.bg, border: `2px solid ${p.border}`,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: p.text, lineHeight: 1 }}>{level}</span>
            <span style={{ fontSize: 9, color: p.text, fontWeight: 600 }}>{p.label.toUpperCase().split(" ")[0]}</span>
        </div>
    )
}

function WaitTime({ timestamp }: { timestamp: string }) {
    const [minutes, setMinutes] = useState(0)
    useEffect(() => {
        const update = () => setMinutes(Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000))
        update()
        const iv = setInterval(update, 30000)
        return () => clearInterval(iv)
    }, [timestamp])
    const color = minutes > 30 ? "#EF4444" : minutes > 15 ? "#F59E0B" : "#22C55E"
    return <span style={{ fontSize: 12, color, fontWeight: 600 }}>{minutes}m waiting</span>
}

export default function ReceptionistDashboard() {
    const [patients, setPatients] = useState<Patient[]>([])
    const [loading, setLoading] = useState(true)
    const [lastRefresh, setLastRefresh] = useState(new Date())
    const [calledIds, setCalledIds] = useState<Set<number>>(new Set())
    const [flash, setFlash] = useState<number | null>(null)
    const [lastCount, setLastCount] = useState(0)

    const fetchQueue = useCallback(async () => {
        try {
            const res = await fetch(`${AI_SERVER}/queue?status=nurse_verified,receptionist_verified`)
            const data: Patient[] = await res.json()
            if (data.filter(p => p.status === "nurse_verified").length > lastCount) {
                const newest = data.filter(p => p.status === "nurse_verified").slice(-1)[0]
                if (newest) { setFlash(newest.id); setTimeout(() => setFlash(null), 4000) }
            }
            setLastCount(data.filter(p => p.status === "nurse_verified").length)
            setPatients(data)
            setLastRefresh(new Date())
        } catch { }
        finally { setLoading(false) }
    }, [lastCount])

    useEffect(() => {
        fetchQueue()
        const iv = setInterval(fetchQueue, 4000)
        return () => clearInterval(iv)
    }, [fetchQueue])

    const callPatient = async (patient: Patient) => {
        setCalledIds(s => new Set([...s, patient.id]))
        setTimeout(() => {
            setPatients(prev => prev.map(p => p.id === patient.id ? { ...p, status: "receptionist_verified" } : p))
        }, 2000)
        try {
            await fetch(`${AI_SERVER}/queue/${patient.id}/verify`, { method: "PATCH" })
        } catch { }
    }

    const queue = patients
        .filter(p => p.status === "nurse_verified")
        .sort((a, b) => {
            const ap = a.nurse_priority || a.ai_priority
            const bp = b.nurse_priority || b.ai_priority
            if (bp !== ap) return bp - ap
            return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        })

    const done = patients
        .filter(p => p.status === "receptionist_verified")
        .sort((a, b) => new Date(b.called_at || b.timestamp).getTime() - new Date(a.called_at || a.timestamp).getTime())
        .slice(0, 10)

    const critCount = queue.filter(p => (p.nurse_priority || p.ai_priority) >= 4).length

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
                        <div style={{ background: "linear-gradient(135deg, #2563EB, #1D4ED8)", borderRadius: 10, width: 32, height: 32 }} />
                        <span style={{ fontWeight: 800, fontSize: 18 }}>
                            <span style={{ color: "#2563EB" }}>Fast</span>
                            <span style={{ color: "#EF4444" }}>ER</span>
                        </span>
                    </div>
                    <div style={{ width: 1, height: 24, background: "#E2E8F0" }} />
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "#1E293B" }}>Receptionist Dashboard</div>
                        <div style={{ fontSize: 11, color: "#94A3B8" }}>Patient Call Queue</div>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                    <div style={{ display: "flex", gap: 20 }}>
                        <StatBox value={queue.length} label="In Queue" color="#2563EB" />
                        <StatBox value={critCount} label="Critical" color="#EF4444" />
                        <StatBox value={done.length} label="Seen Today" color="#22C55E" />
                    </div>
                    <button onClick={fetchQueue} style={{ background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 8, padding: "6px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#64748B" }}>
                        <RefreshCw size={13} /> Refresh
                    </button>
                    <span style={{ fontSize: 11, color: "#94A3B8" }}>
                        {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                </div>
            </div>

            <div style={{ padding: "28px 32px", display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, maxWidth: 1300, margin: "0 auto" }}>

                {/* ── Main Queue ─────────────────────────────────────── */}
                <div>
                    <SectionLabel icon={<Users size={14} />} label={`Active Queue — ${queue.length} patient${queue.length !== 1 ? "s" : ""}`} />

                    {loading ? (
                        <Placeholder label="Loading queue..." />
                    ) : queue.length === 0 ? (
                        <Placeholder label="No patients in queue" icon="🎉" sub="All verified patients have been called." />
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {/* Next up - highlighted */}
                            {queue[0] && (
                                <NextUpCard
                                    patient={queue[0]}
                                    onCall={callPatient}
                                    calling={calledIds.has(queue[0].id)}
                                    isNew={flash === queue[0].id}
                                />
                            )}
                            {/* Rest of queue */}
                            {queue.slice(1).map((p, i) => (
                                <QueueRow key={p.id} patient={p} position={i + 2} onCall={callPatient} calling={calledIds.has(p.id)} isNew={flash === p.id} />
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Sidebar: Recently Called ──────────────────────── */}
                <div>
                    <SectionLabel icon={<CheckCircle size={14} />} label="Recently Called" />
                    {done.length === 0 ? (
                        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: 24, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
                            No patients called yet
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {done.map(p => {
                                const pr = p.nurse_priority || p.ai_priority
                                const pc = PRIORITY[pr as keyof typeof PRIORITY] || PRIORITY[1]
                                return (
                                    <div key={p.id} style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, opacity: 0.7 }}>
                                        <div style={{ width: 36, height: 36, borderRadius: 10, background: pc.bg, border: `1px solid ${pc.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                            <span style={{ fontSize: 16, fontWeight: 700, color: pc.text }}>{pr}</span>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 14, fontWeight: 600, color: "#1E293B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                                            <div style={{ fontSize: 11, color: "#94A3B8" }}>{FLAGS[p.lang] || "🌐"} {p.age_group}</div>
                                        </div>
                                        <CheckCircle size={16} color="#22C55E" />
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* Priority Legend */}
                    <div style={{ marginTop: 24, background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 12, padding: 16 }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 12px" }}>CTAS Priority Guide</p>
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

// ── Next Up Card ─────────────────────────────────────────────
function NextUpCard({ patient, onCall, calling, isNew }: { patient: Patient; onCall: (p: Patient) => void; calling: boolean; isNew: boolean }) {
    const pr = patient.nurse_priority || patient.ai_priority
    const pc = PRIORITY[pr as keyof typeof PRIORITY] || PRIORITY[1]
    const symptoms = Object.entries(patient.answers).filter(([, v]) => v).map(([k]) => k)

    return (
        <div style={{
            background: "#FFFFFF", border: `2px solid ${isNew ? "#2563EB" : pc.border}`,
            borderRadius: 16, overflow: "hidden",
            boxShadow: "0 4px 20px rgba(37,99,235,0.08)",
        }}>
            <div style={{ background: isNew ? "#2563EB" : pc.color, padding: "8px 20px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>⬆ NEXT TO BE CALLED</span>
                {isNew && <span style={{ fontSize: 11, background: "rgba(255,255,255,0.2)", borderRadius: 99, padding: "2px 8px", color: "#fff" }}>Just arrived</span>}
            </div>
            <div style={{ padding: "20px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                    <PriorityDot level={pr} />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 22, fontWeight: 700, color: "#1E293B", marginBottom: 4 }}>{patient.name}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span>{FLAGS[patient.lang] || "🌐"}</span>
                            <span style={{ fontSize: 13, color: "#64748B", background: "#F1F5F9", borderRadius: 99, padding: "2px 8px" }}>{patient.age_group}</span>
                            <WaitTime timestamp={patient.timestamp} />
                            <span style={{ fontSize: 12, color: "#94A3B8" }}>#{patient.health_id}</span>
                        </div>
                    </div>
                </div>

                {symptoms.length > 0 && (
                    <div style={{ marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {symptoms.map(k => (
                            <span key={k} style={{ fontSize: 11, background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 99, padding: "2px 8px", color: "#991B1B" }}>
                                {SYMPTOM_LABELS[k] || k}
                            </span>
                        ))}
                    </div>
                )}

                <button
                    onClick={() => onCall(patient)}
                    disabled={calling}
                    style={{
                        width: "100%", background: calling ? "#E2E8F0" : "#2563EB",
                        color: calling ? "#94A3B8" : "#fff", border: "none",
                        borderRadius: 12, padding: "16px", fontSize: 16, fontWeight: 700,
                        cursor: calling ? "default" : "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                        transition: "all 0.15s",
                    }}
                >
                    <Phone size={18} />
                    {calling ? "Calling..." : `Call ${patient.name}`}
                </button>
            </div>
        </div>
    )
}

// ── Queue Row ─────────────────────────────────────────────────
function QueueRow({ patient, position, onCall, calling, isNew }: { patient: Patient; position: number; onCall: (p: Patient) => void; calling: boolean; isNew: boolean }) {
    const pr = patient.nurse_priority || patient.ai_priority
    const pc = PRIORITY[pr as keyof typeof PRIORITY] || PRIORITY[1]
    const symptoms = Object.entries(patient.answers).filter(([, v]) => v).map(([k]) => k)

    return (
        <div style={{
            background: isNew ? "#EFF6FF" : "#FFFFFF",
            border: `1px solid ${isNew ? "#BFDBFE" : "#E2E8F0"}`,
            borderRadius: 14, padding: "16px 20px",
            display: "flex", alignItems: "center", gap: 16,
            transition: "all 0.3s",
        }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#94A3B8", width: 20, textAlign: "center", flexShrink: 0 }}>
                {position}
            </span>
            <PriorityDot level={pr} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "#1E293B" }}>{patient.name}</span>
                    <span>{FLAGS[patient.lang] || "🌐"}</span>
                    <span style={{ fontSize: 11, color: "#64748B", background: "#F1F5F9", borderRadius: 99, padding: "1px 6px" }}>{patient.age_group}</span>
                    <WaitTime timestamp={patient.timestamp} />
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {symptoms.slice(0, 3).map(k => (
                        <span key={k} style={{ fontSize: 10, background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 99, padding: "1px 6px", color: "#991B1B" }}>
                            {SYMPTOM_LABELS[k] || k}
                        </span>
                    ))}
                    {symptoms.length > 3 && <span style={{ fontSize: 10, color: "#94A3B8" }}>+{symptoms.length - 3} more</span>}
                </div>
            </div>
            <button
                onClick={() => onCall(patient)}
                disabled={calling}
                style={{
                    background: calling ? "#E2E8F0" : "#F8FAFC",
                    color: calling ? "#94A3B8" : "#2563EB",
                    border: `1px solid ${calling ? "#E2E8F0" : "#BFDBFE"}`,
                    borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 600,
                    cursor: calling ? "default" : "pointer",
                    display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
                }}
            >
                <Phone size={14} />
                {calling ? "Calling..." : "Call"}
            </button>
        </div>
    )
}

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
            <span style={{ color: "#64748B" }}>{icon}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
        </div>
    )
}

function StatBox({ value, label, color }: { value: number; label: string; color: string }) {
    return (
        <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>{label}</div>
        </div>
    )
}

function Placeholder({ label, icon = "⏳", sub }: { label: string; icon?: string; sub?: string }) {
    return (
        <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 16, padding: 60, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#334155", marginBottom: 6 }}>{label}</div>
            {sub && <div style={{ fontSize: 13, color: "#94A3B8" }}>{sub}</div>}
        </div>
    )
}
