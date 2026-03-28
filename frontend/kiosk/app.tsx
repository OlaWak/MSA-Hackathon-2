"use client"
import { useState, useEffect, useRef } from "react"

// PI_SERVER  = Raspberry Pi FastAPI (port 8000) — /scan-age ONLY (runs on the Pi hardware)
// AI_SERVER  = Flask AI server  (port 5001) — /speak, /scan-card, /queue, /score-priority
const PI_SERVER = process.env.NEXT_PUBLIC_PI_SERVER || "http://localhost:8000"
const AI_SERVER = process.env.NEXT_PUBLIC_AI_SERVER || "http://localhost:5001"

// ── Brand Colors ───────────────────────────────────────────────
const C = {
    blue: "#2563EB", blueDark: "#1D4ED8", blueLight: "#EFF6FF",
    slate: "#334155", gray: "#64748B", lightGray: "#F1F5F9",
    border: "#E2E8F0", white: "#FFFFFF", red: "#EF4444", green: "#22C55E",
}

// ── Languages ──────────────────────────────────────────────────
const LANGUAGES = [
    { code: "en", label: "English", region: "CA", dir: "ltr" },
    { code: "fr", label: "Français", region: "FR", dir: "ltr" },
    { code: "ar", label: "العربية", region: "SA", dir: "rtl" },
    { code: "pa", label: "ਹਿੰਦੀ", region: "IN", dir: "ltr" },
    { code: "zh", label: "中文", region: "CN", dir: "ltr" },
    { code: "es", label: "Español", region: "ES", dir: "ltr" },
]

// ── Translations ───────────────────────────────────────────────
const T: Record<string, Record<string, string>> = {
    en: {
        welcome: "Welcome to FastER Healthcare", selectLang: "Please select your language",
        scanCard: "Please scan your health card or enter manually",
        scanBtn: "Scan Health Card", enterManual: "Enter Manually",
        detecting: "Looking at camera to detect age...", orManual: "Or select manually:",
        child: "Child", adult: "Adult", senior: "Senior",
        yes: "Yes", no: "No",
        complete: "Check-in Complete!", seated: "Please take a seat. You will be called shortly.",
        name: "Full Name", healthId: "Health Card Number", submit: "Confirm & Continue",
        scanning: "Scanning...", scanAgain: "Scan Again",
        positionCard: "Position your health card in the camera view, then press Scan.",
    },
    fr: {
        welcome: "Bienvenue chez FastER Santé", selectLang: "Veuillez sélectionner votre langue",
        scanCard: "Scannez votre carte santé ou entrez manuellement",
        scanBtn: "Scanner la carte santé", enterManual: "Entrer manuellement",
        detecting: "Détection de l'âge en cours...", orManual: "Ou sélectionner manuellement :",
        child: "Enfant", adult: "Adulte", senior: "Aîné",
        yes: "Oui", no: "Non",
        complete: "Enregistrement Terminé !", seated: "Veuillez vous asseoir. Vous serez appelé bientôt.",
        name: "Nom complet", healthId: "Numéro de carte santé", submit: "Confirmer et continuer",
        scanning: "Numérisation...", scanAgain: "Numériser à nouveau",
        positionCard: "Positionnez votre carte santé devant la caméra, puis appuyez sur Scanner.",
    },
    ar: {
        welcome: "مرحباً بك في FastER للرعاية الصحية", selectLang: "يرجى اختيار لغتك",
        scanCard: "يرجى مسح بطاقة الصحة أو الإدخال يدوياً",
        scanBtn: "مسح بطاقة الصحة", enterManual: "إدخال يدوي",
        detecting: "جارٍ اكتشاف العمر...", orManual: "أو اختر يدوياً:",
        child: "طفل", adult: "بالغ", senior: "كبير السن",
        yes: "نعم", no: "لا",
        complete: "اكتمل تسجيل الوصول!", seated: "يرجى الجلوس. سيتم استدعاؤك قريباً.",
        name: "الاسم الكامل", healthId: "رقم بطاقة الصحة", submit: "تأكيد والمتابعة",
        scanning: "جارٍ المسح...", scanAgain: "مسح مجدداً",
        positionCard: "ضع بطاقتك الصحية أمام الكاميرا ثم اضغط مسح.",
    },
    pa: {
        welcome: "FastER ਹੈਲਥਕੇਅਰ ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ", selectLang: "ਕਿਰਪਾ ਕਰਕੇ ਆਪਣੀ ਭਾਸ਼ਾ ਚੁਣੋ",
        scanCard: "ਆਪਣਾ ਸਿਹਤ ਕਾਰਡ ਸਕੈਨ ਕਰੋ ਜਾਂ ਮੈਨੁਅਲੀ ਦਰਜ ਕਰੋ",
        scanBtn: "ਸਿਹਤ ਕਾਰਡ ਸਕੈਨ ਕਰੋ", enterManual: "ਮੈਨੁਅਲੀ ਦਰਜ ਕਰੋ",
        detecting: "ਉਮਰ ਦਾ ਪਤਾ ਲਗਾਉਂਦੇ ਹੋਏ...", orManual: "ਜਾਂ ਮੈਨੁਅਲੀ ਚੁਣੋ:",
        child: "ਬੱਚਾ", adult: "ਬਾਲਗ", senior: "ਬਜ਼ੁਰਗ",
        yes: "ਹਾਂ", no: "ਨਹੀਂ",
        complete: "ਚੈੱਕ-ਇਨ ਪੂਰਾ ਹੋਇਆ!", seated: "ਕਿਰਪਾ ਕਰਕੇ ਬੈਠੋ। ਤੁਹਾਨੂੰ ਜਲਦੀ ਬੁਲਾਇਆ ਜਾਵੇਗਾ।",
        name: "ਪੂਰਾ ਨਾਮ", healthId: "ਸਿਹਤ ਕਾਰਡ ਨੰਬਰ", submit: "ਪੁਸ਼ਟੀ ਕਰੋ ਅਤੇ ਜਾਰੀ ਰੱਖੋ",
        scanning: "ਸਕੈਨਿੰਗ...", scanAgain: "ਦੁਬਾਰਾ ਸਕੈਨ ਕਰੋ",
        positionCard: "ਕੈਮਰੇ ਦੇ ਸਾਹਮਣੇ ਕਾਰਡ ਰੱਖੋ, ਫਿਰ ਸਕੈਨ ਦਬਾਓ।",
    },
    zh: {
        welcome: "欢迎来到 FastER 医疗", selectLang: "请选择您的语言",
        scanCard: "请扫描您的健康卡或手动输入",
        scanBtn: "扫描健康卡", enterManual: "手动输入",
        detecting: "正在检测年龄...", orManual: "或手动选择：",
        child: "儿童", adult: "成人", senior: "老年人",
        yes: "是", no: "否",
        complete: "登记完成！", seated: "请就座。您将很快被叫到。",
        name: "全名", healthId: "健康卡号码", submit: "确认并继续",
        scanning: "扫描中...", scanAgain: "重新扫描",
        positionCard: "将您的健康卡对准摄像头，然后按扫描。",
    },
    es: {
        welcome: "Bienvenido a FastER Healthcare", selectLang: "Por favor seleccione su idioma",
        scanCard: "Por favor escanee su tarjeta de salud o ingrese manualmente",
        scanBtn: "Escanear Tarjeta", enterManual: "Ingresar Manualmente",
        detecting: "Detectando edad con la cámara...", orManual: "O seleccione manualmente:",
        child: "Niño", adult: "Adulto", senior: "Adulto Mayor",
        yes: "Sí", no: "No",
        complete: "¡Registro Completo!", seated: "Por favor tome asiento. Será llamado en breve.",
        name: "Nombre Completo", healthId: "Número de Tarjeta de Salud", submit: "Confirmar y Continuar",
        scanning: "Escaneando...", scanAgain: "Escanear de Nuevo",
        positionCard: "Coloque su tarjeta frente a la cámara y presione Escanear.",
    },
}

// ── CTAS Triage Questions (7 universal) ────────────────────────
const TRIAGE_Q: Record<string, Record<string, string>> = {
    en: {
        chest_pain: "Do you have chest pain?",
        difficulty_breathing: "Are you having trouble breathing?",
        dizziness: "Do you feel dizzy or lightheaded?",
        severe_pain: "Do you have severe pain anywhere?",
        fever: "Do you have a fever or chills?",
        vomiting: "Are you vomiting or feeling very nauseous?",
        headache: "Do you have a headache?",
    },
    fr: {
        chest_pain: "Avez-vous des douleurs thoraciques ?",
        difficulty_breathing: "Avez-vous du mal à respirer ?",
        dizziness: "Vous sentez-vous étourdi ?",
        severe_pain: "Avez-vous une douleur intense quelque part ?",
        fever: "Avez-vous de la fièvre ou des frissons ?",
        vomiting: "Vomissez-vous ou avez-vous de fortes nausées ?",
        headache: "Avez-vous mal à la tête ?",
    },
    ar: {
        chest_pain: "هل تشعر بألم في الصدر؟",
        difficulty_breathing: "هل تواجه صعوبة في التنفس؟",
        dizziness: "هل تشعر بدوار أو دوخة؟",
        severe_pain: "هل تشعر بألم شديد في أي مكان؟",
        fever: "هل لديك حمى أو قشعريرة؟",
        vomiting: "هل تتقيأ أو تشعر بغثيان شديد؟",
        headache: "هل تعاني من صداع؟",
    },
    pa: {
        chest_pain: "ਕੀ ਤੁਹਾਨੂੰ ਛਾਤੀ ਵਿੱਚ ਦਰਦ ਹੈ?",
        difficulty_breathing: "ਕੀ ਤੁਹਾਨੂੰ ਸਾਹ ਲੈਣ ਵਿੱਚ ਮੁਸ਼ਕਲ ਹੋ ਰਹੀ ਹੈ?",
        dizziness: "ਕੀ ਤੁਸੀਂ ਚੱਕਰ ਮਹਿਸੂਸ ਕਰ ਰਹੇ ਹੋ?",
        severe_pain: "ਕੀ ਤੁਹਾਨੂੰ ਕਿਤੇ ਗੰਭੀਰ ਦਰਦ ਹੈ?",
        fever: "ਕੀ ਤੁਹਾਨੂੰ ਬੁਖਾਰ ਜਾਂ ਠੰਢ ਹੈ?",
        vomiting: "ਕੀ ਤੁਸੀਂ ਉਲਟੀਆਂ ਕਰ ਰਹੇ ਹੋ?",
        headache: "ਕੀ ਤੁਹਾਡੇ ਸਿਰ ਵਿੱਚ ਦਰਦ ਹੈ?",
    },
    zh: {
        chest_pain: "您有胸痛吗？",
        difficulty_breathing: "您呼吸困难吗？",
        dizziness: "您感到头晕吗？",
        severe_pain: "您身体某处有剧烈疼痛吗？",
        fever: "您发烧或发冷吗？",
        vomiting: "您在呕吐或严重恶心吗？",
        headache: "您有头痛吗？",
    },
    es: {
        chest_pain: "¿Tiene dolor en el pecho?",
        difficulty_breathing: "¿Tiene dificultad para respirar?",
        dizziness: "¿Se siente mareado o aturdido?",
        severe_pain: "¿Tiene dolor severo en algún lugar?",
        fever: "¿Tiene fiebre o escalofríos?",
        vomiting: "¿Está vomitando o tiene náuseas intensas?",
        headache: "¿Tiene dolor de cabeza?",
    },
}

const QUESTION_IDS = Object.keys(TRIAGE_Q.en)

// ── Shared Styles ──────────────────────────────────────────────
const btn = (bg: string, color = "#fff", border = "none"): React.CSSProperties => ({
    background: bg, color, border, borderRadius: 12, padding: "16px 24px",
    fontSize: 17, fontWeight: 600, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    gap: 8, width: "100%", transition: "all 0.15s ease",
})

const card: React.CSSProperties = {
    background: C.white, borderRadius: 20, padding: 28,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
    border: `1px solid ${C.border}`,
}

// ── Logo ───────────────────────────────────────────────────────
function Logo({ size = 28 }: { size?: number }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
                background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
                borderRadius: 10, width: size, height: size,
                display: "flex", alignItems: "center", justifyContent: "center",
            }}>
                <span style={{ color: "#fff", fontSize: size * 0.55, fontWeight: 800 }}>+</span>
            </div>
            <span style={{ fontSize: size * 0.75, fontWeight: 800, letterSpacing: -0.5 }}>
                <span style={{ color: C.blue }}>Fast</span>
                <span style={{ color: "#EF4444" }}>ER</span>
            </span>
        </div>
    )
}

// ── Progress Bar ───────────────────────────────────────────────
function ProgressBar({ step, total }: { step: number; total: number }) {
    return (
        <div style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6, fontSize: 13, color: C.gray }}>
                <span style={{ fontWeight: 500 }}>{step} / {total}</span>
            </div>
            <div style={{ height: 6, background: C.border, borderRadius: 99, overflow: "hidden" }}>
                <div style={{
                    height: "100%", width: `${(step / total) * 100}%`,
                    background: `linear-gradient(90deg, ${C.blue} 0%, #60A5FA 100%)`,
                    borderRadius: 99, transition: "width 0.4s ease",
                }} />
            </div>
        </div>
    )
}

// ── Live Camera Preview ────────────────────────────────────────
// Shows live webcam so patient can frame their health card.
// onCapture fires with a base64 JPEG string when patient clicks Scan.
function LiveCamera({
    onCapture,
    scanning,
    t,
}: {
    onCapture: (b64: string) => void
    scanning: boolean
    t: Record<string, string>
}) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const [ready, setReady] = useState(false)
    const [camErr, setCamErr] = useState(false)

    useEffect(() => {
        navigator.mediaDevices
            .getUserMedia({ video: { facingMode: "environment" } })
            .then(stream => {
                streamRef.current = stream
                if (videoRef.current) {
                    videoRef.current.srcObject = stream
                    videoRef.current.play()
                    setReady(true)
                }
            })
            .catch(() => setCamErr(true))

        return () => streamRef.current?.getTracks().forEach(tr => tr.stop())
    }, [])

    const capture = () => {
        if (!videoRef.current || scanning) return
        const canvas = document.createElement("canvas")
        canvas.width = videoRef.current.videoWidth || 640
        canvas.height = videoRef.current.videoHeight || 480
        canvas.getContext("2d")!.drawImage(videoRef.current, 0, 0)
        streamRef.current?.getTracks().forEach(tr => tr.stop())
        const b64 = canvas.toDataURL("image/jpeg", 0.85).split(",")[1]
        onCapture(b64)
    }

    return (
        <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 13, color: C.gray, textAlign: "center", marginBottom: 10 }}>
                {t.positionCard}
            </p>

            {/* Live video with card alignment guide overlay */}
            <div style={{
                position: "relative", borderRadius: 14, overflow: "hidden",
                background: "#0F172A", height: 230, marginBottom: 12,
            }}>
                {camErr ? (
                    <div style={{
                        height: "100%", display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center", gap: 8,
                    }}>
                        <span style={{ fontSize: 32 }}>📷</span>
                        <span style={{ color: "#64748B", fontSize: 13 }}>Camera unavailable</span>
                    </div>
                ) : (
                    <>
                        <video
                            ref={videoRef}
                            muted
                            playsInline
                            style={{
                                width: "100%", height: "100%", objectFit: "cover",
                                opacity: ready ? 1 : 0.2, transition: "opacity 0.4s",
                            }}
                        />
                        {/* Dashed card-framing guide */}
                        <div style={{
                            position: "absolute", inset: 0, display: "flex",
                            alignItems: "center", justifyContent: "center", pointerEvents: "none",
                        }}>
                            <div style={{
                                width: "78%", height: "56%",
                                border: "2.5px dashed rgba(255,255,255,0.55)",
                                borderRadius: 10,
                                boxShadow: "0 0 0 9999px rgba(0,0,0,0.28)",
                            }} />
                        </div>
                        {!ready && (
                            <div style={{
                                position: "absolute", inset: 0, display: "flex",
                                alignItems: "center", justifyContent: "center",
                            }}>
                                <span style={{ color: "#94A3B8", fontSize: 14 }}>Starting camera…</span>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Scan button — triggers capture + Gemini OCR */}
            <button
                onClick={camErr ? undefined : capture}
                disabled={scanning || (!ready && !camErr)}
                style={btn(scanning ? C.border : C.blue, scanning ? C.gray : "#fff")}
            >
                {scanning ? `🔍 ${t.scanning}` : `📷 ${t.scanBtn}`}
            </button>
        </div>
    )
}

// ── Main App ───────────────────────────────────────────────────
type Step = "language" | "age" | "card" | "questions" | "complete"

export default function KioskApp() {
    const [step, setStep] = useState<Step>("language")
    const [lang, setLang] = useState("en")
    const [ageGroup, setAgeGroup] = useState<"Child" | "Adult" | "Senior" | null>(null)
    const [ageCountdown, setAgeCountdown] = useState(3)
    const [cardMode, setCardMode] = useState<"scan" | "manual">("scan")
    const [scanningCard, setScanningCard] = useState(false)
    const [manualName, setManualName] = useState("")
    const [manualId, setManualId] = useState("")
    const [patientName, setPatientName] = useState("")
    const [healthId, setHealthId] = useState("")
    const [qIndex, setQIndex] = useState(0)
    const [answers, setAnswers] = useState<Record<string, boolean>>({})
    const [submitting, setSubmitting] = useState(false)

    const t = T[lang] || T.en
    const isRTL = LANGUAGES.find(l => l.code === lang)?.dir === "rtl"
    const fs = ageGroup === "Senior" ? 1.15 : 1

    // ── Pi age detection: countdown → POST /scan-age ──────────────
    useEffect(() => {
        if (step !== "age") return
        const iv = setInterval(() => {
            setAgeCountdown(c => {
                if (c <= 1) {
                    clearInterval(iv)
                    // Pi FastAPI (port 8000) wraps detect_age_pi.py
                    // Returns: { success, age_group, confidence, next_step, fallback }
                    fetch(`${PI_SERVER}/scan-age`, { method: "POST" })
                        .then(r => r.json())
                        .then(d => setAgeGroup((d.age_group as "Child" | "Adult" | "Senior") || "Adult"))
                        .catch(() => setAgeGroup("Adult"))
                    return 0
                }
                return c - 1
            })
        }, 1000)
        return () => clearInterval(iv)
    }, [step])

    useEffect(() => {
        if (ageGroup && step === "age") setTimeout(() => setStep("card"), 700)
    }, [ageGroup])

    // ── TTS: calls Flask /speak ────────────────────────────────────
    const speak = async (text: string) => {
        try {
            await fetch(`${AI_SERVER}/speak`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text, lang }),
            })
        } catch { }
    }

    // ── Card capture → Flask /scan-card (Gemini Vision OCR) ────────
    const handleCardCapture = async (b64: string) => {
        setScanningCard(true)
        try {
            const res = await fetch(`${AI_SERVER}/scan-card`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image: b64 }),
            })
            const d = await res.json()
            // Server returns: { name, health_id }
            setPatientName(d.name !== "Unknown" ? d.name : "")
            setHealthId(d.health_id !== "N/A" ? d.health_id : "")
        } catch { }
        setScanningCard(false)
        setStep("questions")
        speak(TRIAGE_Q[lang]?.[QUESTION_IDS[0]] || TRIAGE_Q.en[QUESTION_IDS[0]])
    }

    // ── Answer yes/no, advance or submit ──────────────────────────
    const handleAnswer = async (id: string, val: boolean) => {
        const newAnswers = { ...answers, [id]: val }
        setAnswers(newAnswers)

        if (qIndex < QUESTION_IDS.length - 1) {
            const nextId = QUESTION_IDS[qIndex + 1]
            setTimeout(() => {
                setQIndex(i => i + 1)
                speak(TRIAGE_Q[lang]?.[nextId] || TRIAGE_Q.en[nextId])
            }, 250)
        } else {
            // All 7 answered → POST to Flask /queue
            // Server scores priority + stores in Supabase
            // Patient NEVER sees priority (complete screen just says "take a seat")
            setSubmitting(true)
            try {
                await fetch(`${AI_SERVER}/queue`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: patientName || manualName || "Unknown",
                        health_id: healthId || manualId || "N/A",
                        lang,
                        age_group: ageGroup || "Adult",
                        answers: newAnswers,
                    }),
                })
            } catch { }
            setSubmitting(false)
            setStep("complete")
        }
    }

    // ── Reset for next patient ─────────────────────────────────────
    const reset = () => {
        setStep("language"); setLang("en"); setAgeGroup(null); setAgeCountdown(3)
        setManualName(""); setManualId(""); setPatientName(""); setHealthId("")
        setQIndex(0); setAnswers({}); setCardMode("scan"); setScanningCard(false)
    }

    // ─────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────

    if (step === "language") return (
        <Screen rtl={isRTL}>
            <div style={{ textAlign: "center", marginBottom: 36 }}>
                <Logo size={42} />
                <h1 style={{ fontSize: 26, fontWeight: 700, margin: "20px 0 8px", color: C.slate }}>
                    Welcome to FastER Healthcare
                </h1>
                <p style={{ color: C.gray, fontSize: 15 }}>{t.selectLang}</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                {LANGUAGES.map(l => (
                    <button
                        key={l.code}
                        onClick={() => { setLang(l.code); setStep("age") }}
                        style={{
                            background: C.white, border: `2px solid ${C.border}`, borderRadius: 16,
                            padding: "20px 10px", cursor: "pointer", textAlign: "center",
                            transition: "all 0.15s", display: "flex", flexDirection: "column",
                            alignItems: "center", gap: 4,
                        }}
                        onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = C.blue; el.style.background = C.blueLight }}
                        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = C.border; el.style.background = C.white }}
                    >
                        <span style={{ fontSize: 22, fontWeight: 700, color: C.slate }}>{l.region}</span>
                        <span style={{ fontSize: 13, color: C.gray }}>{l.label}</span>
                    </button>
                ))}
            </div>
        </Screen>
    )

    if (step === "age") return (
        <Screen rtl={isRTL}>
            <div style={{ ...card, textAlign: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📷</div>
                <p style={{ color: C.gray, fontSize: 16 * fs, marginBottom: 8 }}>{t.detecting}</p>
                {ageGroup
                    ? <div style={{ fontSize: 32, fontWeight: 700, color: C.green }}>✓ {ageGroup}</div>
                    : <div style={{ fontSize: 56, fontWeight: 800, color: C.blue, lineHeight: 1 }}>{ageCountdown || "…"}</div>
                }
            </div>
            <div style={{ ...card }}>
                <p style={{ textAlign: "center", color: C.gray, marginBottom: 16, fontSize: 14 }}>{t.orManual}</p>
                <div style={{ display: "flex", gap: 10 }}>
                    {(["Child", "Adult", "Senior"] as const).map(g => (
                        <button key={g} onClick={() => setAgeGroup(g)} style={{
                            flex: 1,
                            background: ageGroup === g ? C.blueLight : C.lightGray,
                            border: `2px solid ${ageGroup === g ? C.blue : C.border}`,
                            borderRadius: 12, padding: "14px 8px", cursor: "pointer",
                            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                        }}>
                            <span style={{ fontSize: 24 }}>{g === "Child" ? "🧒" : g === "Adult" ? "🧑" : "👴"}</span>
                            <span style={{ fontSize: 13 * fs, fontWeight: 600, color: C.slate }}>
                                {t[g.toLowerCase() as keyof typeof t]}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </Screen>
    )

    if (step === "card") return (
        <Screen rtl={isRTL}>
            <h2 style={{ fontSize: 20 * fs, fontWeight: 700, color: C.slate, marginBottom: 20, textAlign: "center" }}>
                {t.scanCard}
            </h2>
            {cardMode === "scan" ? (
                <div style={{ ...card, marginBottom: 12 }}>
                    {/* LiveCamera shows real webcam + card frame guide + Scan button */}
                    <LiveCamera onCapture={handleCardCapture} scanning={scanningCard} t={t} />
                    <button
                        onClick={() => setCardMode("manual")}
                        style={{ ...btn("transparent", C.gray, `1px solid ${C.border}`), marginTop: 4 }}
                    >
                        ⌨️ {t.enterManual}
                    </button>
                </div>
            ) : (
                <div style={{ ...card, display: "flex", flexDirection: "column", gap: 16 }}>
                    <div>
                        <label style={{ fontSize: 14, fontWeight: 600, color: C.slate, display: "block", marginBottom: 6 }}>
                            {t.name}
                        </label>
                        <input
                            value={manualName}
                            onChange={e => setManualName(e.target.value)}
                            style={{
                                width: "100%", padding: "14px 16px", borderRadius: 10,
                                border: `1.5px solid ${C.border}`, fontSize: 16 * fs,
                                boxSizing: "border-box", outline: "none",
                            }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: 14, fontWeight: 600, color: C.slate, display: "block", marginBottom: 6 }}>
                            {t.healthId}
                        </label>
                        <input
                            value={manualId}
                            onChange={e => setManualId(e.target.value)}
                            style={{
                                width: "100%", padding: "14px 16px", borderRadius: 10,
                                border: `1.5px solid ${C.border}`, fontSize: 16 * fs,
                                boxSizing: "border-box", outline: "none",
                            }}
                        />
                    </div>
                    <button
                        onClick={() => {
                            setStep("questions")
                            speak(TRIAGE_Q[lang]?.[QUESTION_IDS[0]] || TRIAGE_Q.en[QUESTION_IDS[0]])
                        }}
                        disabled={!manualName || !manualId}
                        style={btn(manualName && manualId ? C.blue : C.border)}
                    >
                        {t.submit}
                    </button>
                    <button onClick={() => setCardMode("scan")} style={{ ...btn("transparent", C.gray, `1px solid ${C.border}`) }}>
                        ← Back to camera
                    </button>
                </div>
            )}
        </Screen>
    )

    if (step === "questions") {
        const qId = QUESTION_IDS[qIndex]
        const qText = TRIAGE_Q[lang]?.[qId] || TRIAGE_Q.en[qId]
        return (
            <Screen rtl={isRTL}>
                <ProgressBar step={qIndex + 1} total={QUESTION_IDS.length} />
                <div style={{ ...card, marginTop: 16 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 32 }}>
                        <button
                            onClick={() => speak(qText)}
                            style={{
                                background: C.blue, border: "none", borderRadius: 50,
                                width: 46, height: 46, cursor: "pointer", flexShrink: 0,
                                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
                            }}
                            title="Hear question aloud"
                        >
                            🔊
                        </button>
                        <p style={{ fontSize: 22 * fs, fontWeight: 600, color: C.slate, lineHeight: 1.4, margin: 0 }}>
                            {qText}
                        </p>
                    </div>
                    <div style={{ display: "flex", gap: 16 }}>
                        <button
                            onClick={() => handleAnswer(qId, true)}
                            disabled={submitting}
                            style={{ ...btn(C.blue), flex: 1, fontSize: 20 * fs, padding: "20px", opacity: submitting ? 0.6 : 1 }}
                        >
                            👍 {t.yes}
                        </button>
                        <button
                            onClick={() => handleAnswer(qId, false)}
                            disabled={submitting}
                            style={{ ...btn("#334155"), flex: 1, fontSize: 20 * fs, padding: "20px", opacity: submitting ? 0.6 : 1 }}
                        >
                            👎 {t.no}
                        </button>
                    </div>
                </div>
            </Screen>
        )
    }

    if (step === "complete") return (
        <Screen rtl={isRTL}>
            <div style={{ ...card, textAlign: "center", padding: 52 }}>
                <div style={{ fontSize: 72, marginBottom: 20 }}>✅</div>
                <h2 style={{ fontSize: 26 * fs, fontWeight: 700, color: C.slate, margin: "0 0 14px" }}>
                    {t.complete}
                </h2>
                {/* Priority intentionally NOT shown to patient */}
                <p style={{ fontSize: 18 * fs, color: C.gray, lineHeight: 1.6, maxWidth: 300, margin: "0 auto 36px" }}>
                    {t.seated}
                </p>
                <button onClick={reset} style={btn(C.lightGray, C.slate, `1px solid ${C.border}`)}>
                    Start New Check-in
                </button>
            </div>
        </Screen>
    )

    return null
}

function Screen({ children, rtl }: { children: React.ReactNode; rtl?: boolean }) {
    return (
        <div style={{
            minHeight: "100vh", background: "#F8FAFC",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            padding: 24, direction: rtl ? "rtl" : "ltr",
            fontFamily: "'Segoe UI', system-ui, sans-serif",
        }}>
            <div style={{ width: "100%", maxWidth: 480 }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
                    <Logo size={32} />
                </div>
                {children}
            </div>
        </div>
    )
}