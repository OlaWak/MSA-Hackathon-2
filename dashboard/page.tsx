"use client"
import { useEffect, useState, useCallback } from "react"
import { CheckCircle } from "lucide-react"

// Person 1: set NEXT_PUBLIC_PI_SERVER in your .env.local file
// Example: NEXT_PUBLIC_PI_SERVER=http://localhost:5000
const PI_SERVER = process.env.NEXT_PUBLIC_PI_SERVER || "http://localhost:5000"

type Patient = {
    id: number
    name: string
    health_id: string
    lang: string
    age_group: string
    priority: number
    priority_color: string
    status: string
    timestamp: string
    answers: Record<string, boolean>
}

const PC: Record<number, { label: string; bg: string; text: string; border: string }> = {
    5: { label: "Critical", bg: "#FCEBEB", text: "#A32D2D", border: "#F09595" },
    4: { label: "Urgent", bg: "#FAEEDA", text: "#633806", border: "#FAC775" },
    3: { label: "Moderate", bg: "#FAEEDA", text: "#854F0B", border: "#EF9F27" },
    2: { label: "Low", bg: "#EAF3DE", text: "#27500A", border: "#97C459" },
    1: { label: "Minor", bg: "#EAF3DE", text: "#3B6D11", border: "#C0DD97" },
}

const FLAGS: Record<string, string> = {
    en: "🇨🇦", ar: "🇸🇦", fr: "🇫🇷",
    pa: "🇮🇳", zh: "🇨🇳", es: "🇪🇸"
}

export default function Dashboard() {
    const [patients, setPatients] = useState<Patient[]>([])
    const [lastCount, setLastCount] = useState(0)
    const [flash, setFlash] = useState<number | null>(null)

    const fetchQueue = useCallback(async () => {
        try {
            const res = await fetch(`${PI_SERVER}/queue`)
            const data: Patient[] = await res.json()

            if (data.length > lastCount) {
                const newId = data[data.length - 1].id
                setFlash(newId)
                setTimeout(() => setFlash(null), 3000)
            }
            setLastCount(data.length)
            setPatients(data)
        } catch {
            // Server not reachable — silently retry on next interval
        }
    }, [lastCount])

    useEffect(() => {
        fetchQueue()
        const iv = setInterval(fetchQueue, 4000)
        return () => clearInterval(iv)
    }, [fetchQueue])

    const verify = async (id: number) => {
        // Optimistic update — change UI immediately, confirm with server after
        setPatients(prev => prev.map(p => p.id === id ? { ...p, status: "verified" } : p))
        try {
            await fetch(`${PI_SERVER}/queue/${id}/verify`, { method: "PATCH" })
        } catch {
            // Server update failed — UI already updated, will resync on next fetch
        }
    }

    const waiting = patients.filter(p => p.status === "waiting").sort((a, b) => b.priority - a.priority)
    const verified = patients.filter(p => p.status === "verified").sort((a, b) => b.priority - a.priority)

    return (
        <div style={{ minHeight: "100vh", background: "#F8F7F4", fontFamily: "system-ui, sans-serif" }}>

            {/* ── HEADER ── */}
            <div style={{
                background: "#fff", borderBottom: "0.5px solid #E0DED6",
                padding: "16px 32px", display: "flex",
                alignItems: "center", justifyContent: "space-between"
            }}>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>
                        Tawfiq — Receptionist Dashboard
                    </h1>
                    <p style={{ fontSize: 13, color: "#888780", margin: "2px 0 0" }}>
                        Live queue · refreshes every 4 seconds
                    </p>
                </div>
                <div style={{ display: "flex", gap: 24 }}>
                    <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 28, fontWeight: 500, color: "#D85A30", lineHeight: 1 }}>
                            {waiting.length}
                        </div>
                        <div style={{ fontSize: 11, color: "#888780", marginTop: 2 }}>Waiting</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 28, fontWeight: 500, color: "#639922", lineHeight: 1 }}>
                            {verified.length}
                        </div>
                        <div style={{ fontSize: 11, color: "#888780", marginTop: 2 }}>Verified</div>
                    </div>
                </div>
            </div>

            <div style={{ padding: "24px 32px" }}>

                {/* ── WAITING SECTION ── */}
                <p style={{
                    fontSize: 12, fontWeight: 500, color: "#888780",
                    textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12
                }}>
                    Waiting — {waiting.length} patient{waiting.length !== 1 ? "s" : ""}
                </p>

                {waiting.length === 0 && (
                    <div style={{
                        background: "#fff", border: "0.5px solid #E0DED6",
                        borderRadius: 12, padding: 32, textAlign: "center",
                        color: "#888780", fontSize: 14, marginBottom: 24
                    }}>
                        No patients waiting
                    </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 32 }}>
                    {waiting.map(p => {
                        const pc = PC[p.priority] || PC[1]
                        const isNew = flash === p.id
                        return (
                            <div key={p.id} style={{
                                background: isNew ? "#FAEEDA" : "#fff",
                                border: `0.5px solid ${isNew ? "#FAC775" : "#E0DED6"}`,
                                borderRadius: 12, padding: "16px 20px",
                                display: "flex", alignItems: "center", gap: 16,
                                transition: "background 0.6s, border-color 0.6s"
                            }}>

                                {/* Priority badge */}
                                <div style={{
                                    background: pc.bg, border: `0.5px solid ${pc.border}`,
                                    borderRadius: 8, padding: "8px 14px",
                                    minWidth: 70, textAlign: "center", flexShrink: 0
                                }}>
                                    <div style={{ fontSize: 22, fontWeight: 500, color: pc.text, lineHeight: 1 }}>
                                        {p.priority}
                                    </div>
                                    <div style={{ fontSize: 10, color: pc.text, marginTop: 2 }}>
                                        {pc.label}
                                    </div>
                                </div>

                                {/* Patient info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        display: "flex", alignItems: "center",
                                        gap: 8, marginBottom: 4, flexWrap: "wrap"
                                    }}>
                                        <span style={{ fontSize: 15, fontWeight: 500 }}>{p.name}</span>
                                        <span style={{ fontSize: 16 }}>{FLAGS[p.lang] || "🌐"}</span>
                                        <span style={{
                                            fontSize: 11, background: "#F1EFE8",
                                            border: "0.5px solid #D3D1C7", borderRadius: 20,
                                            padding: "1px 8px", color: "#5F5E5A"
                                        }}>
                                            {p.age_group}
                                        </span>
                                        {isNew && (
                                            <span style={{
                                                fontSize: 11, background: "#FAEEDA",
                                                border: "0.5px solid #FAC775", borderRadius: 20,
                                                padding: "1px 8px", color: "#633806"
                                            }}>
                                                Just arrived
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: 12, color: "#888780" }}>
                                        Health ID: {p.health_id} · {new Date(p.timestamp).toLocaleTimeString()}
                                    </div>
                                </div>

                                {/* Symptom tags — only shows YES answers */}
                                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", maxWidth: 200 }}>
                                    {p.answers && Object.entries(p.answers)
                                        .filter(([, v]) => v)
                                        .map(([k]) => (
                                            <span key={k} style={{
                                                fontSize: 10, background: "#FCEBEB",
                                                border: "0.5px solid #F09595", borderRadius: 20,
                                                padding: "2px 8px", color: "#A32D2D"
                                            }}>
                                                {k.replace(/_/g, " ")}
                                            </span>
                                        ))}
                                </div>

                                {/* Verify button */}
                                <button
                                    onClick={() => verify(p.id)}
                                    style={{
                                        background: "#fff", border: "0.5px solid #D3D1C7",
                                        borderRadius: 8, padding: "10px 18px", fontSize: 13,
                                        cursor: "pointer", display: "flex", alignItems: "center",
                                        gap: 6, whiteSpace: "nowrap", flexShrink: 0
                                    }}
                                >
                                    <CheckCircle size={14} /> Verify
                                </button>
                            </div>
                        )
                    })}
                </div>

                {/* ── VERIFIED SECTION ── */}
                {verified.length > 0 && (
                    <>
                        <p style={{
                            fontSize: 12, fontWeight: 500, color: "#888780",
                            textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12
                        }}>
                            Verified — {verified.length} patient{verified.length !== 1 ? "s" : ""}
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {verified.map(p => {
                                const pc = PC[p.priority] || PC[1]
                                return (
                                    <div key={p.id} style={{
                                        background: "#F8F7F4", border: "0.5px solid #E0DED6",
                                        borderRadius: 12, padding: "12px 20px",
                                        display: "flex", alignItems: "center", gap: 16, opacity: 0.65
                                    }}>
                                        <div style={{
                                            background: pc.bg, border: `0.5px solid ${pc.border}`,
                                            borderRadius: 8, padding: "6px 12px",
                                            minWidth: 50, textAlign: "center", flexShrink: 0
                                        }}>
                                            <div style={{ fontSize: 18, fontWeight: 500, color: pc.text }}>
                                                {p.priority}
                                            </div>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <span style={{ fontSize: 14, fontWeight: 500 }}>{p.name}</span>
                                                <span>{FLAGS[p.lang] || "🌐"}</span>
                                            </div>
                                            <div style={{ fontSize: 12, color: "#888780" }}>
                                                Health ID: {p.health_id}
                                            </div>
                                        </div>
                                        <div style={{
                                            display: "flex", alignItems: "center",
                                            gap: 6, fontSize: 13, color: "#3B6D11"
                                        }}>
                                            <CheckCircle size={14} /> Verified
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}