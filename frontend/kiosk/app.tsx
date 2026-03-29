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

type AgeGroup = "Child" | "Adult" | "Senior"
type CameraMode = "pi" | "app"
type AgeCameraMode = "preview" | "legacy"
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

type FaceBox = {
    x: number
    y: number
    w: number
    h: number
}

const AGE_GUIDE = {
    x: 0.23,
    y: 0.16,
    w: 0.54,
    h: 0.68,
}

function normalizeFaceBox(box: Partial<FaceBox> | null | undefined) {
    if (!box) return null

    const x = Number(box.x)
    const y = Number(box.y)
    const w = Number(box.w)
    const h = Number(box.h)

    if (![x, y, w, h].every(Number.isFinite)) return null
    return { x, y, w, h }
}

function isFaceInsideAgeGuide(faceBox: FaceBox | null) {
    if (!faceBox) return false

    const faceCenterX = faceBox.x + faceBox.w / 2
    const faceCenterY = faceBox.y + faceBox.h / 2
    const faceArea = faceBox.w * faceBox.h

    const centerInside =
        faceCenterX >= AGE_GUIDE.x &&
        faceCenterX <= AGE_GUIDE.x + AGE_GUIDE.w &&
        faceCenterY >= AGE_GUIDE.y &&
        faceCenterY <= AGE_GUIDE.y + AGE_GUIDE.h

    const overlapW = Math.max(
        0,
        Math.min(faceBox.x + faceBox.w, AGE_GUIDE.x + AGE_GUIDE.w) - Math.max(faceBox.x, AGE_GUIDE.x),
    )
    const overlapH = Math.max(
        0,
        Math.min(faceBox.y + faceBox.h, AGE_GUIDE.y + AGE_GUIDE.h) - Math.max(faceBox.y, AGE_GUIDE.y),
    )
    const overlapRatio = faceBox.w * faceBox.h > 0 ? (overlapW * overlapH) / (faceBox.w * faceBox.h) : 0

    return centerInside && overlapRatio >= 0.55 && faceArea >= 0.02 && faceArea <= 0.78
}

function arrayBufferToBase64(buf: ArrayBuffer) {
    const bytes = new Uint8Array(buf)
    let binary = ""
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
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

// ── Live Camera Preview (Age Detection) ───────────────────────
function AgeCamera({
    onDetected,
    mode = "preview",
}: {
    onDetected: (group: AgeGroup) => void
    mode?: AgeCameraMode
}) {
    const AUTO_SCAN_STEPS = 1
    const frameUrlRef = useRef<string | null>(null)
    const autoTriggeredRef = useRef(false)
    const alignedStepsRef = useRef(0)
    const cooldownUntilRef = useRef(0)
    const readyRef = useRef(false)
    const analyzingRef = useRef(false)

    const [ready, setReady] = useState(false)
    const [camErr, setCamErr] = useState<string | null>(null)
    const [analyzing, setAnalyzing] = useState(false)
    const [message, setMessage] = useState("Connecting to Pi camera...")
    const [attempt, setAttempt] = useState(0)
    const [guideState, setGuideState] = useState<"adjust" | "aligned">("adjust")
    const [faceBox, setFaceBox] = useState<FaceBox | null>(null)
    const [autoScanProgress, setAutoScanProgress] = useState(0)
    const [frameUrl, setFrameUrl] = useState<string | null>(null)

    const logCamera = (event: string, details: Record<string, unknown> = {}) => {
        console.log("[AgeCamera]", event, details)
        void fetch(`${PI_SERVER}/camera-debug`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ event, details }),
        }).catch(() => undefined)
    }

    const clearFrameUrl = () => {
        if (frameUrlRef.current) {
            URL.revokeObjectURL(frameUrlRef.current)
            frameUrlRef.current = null
        }
    }

    const parseFaceFromHeaders = (res: Response) => {
        const num = (key: string) => {
            const v = res.headers.get(key)
            if (v === null || v === "") return null
            const n = Number(v)
            return Number.isFinite(n) ? n : null
        }
        return normalizeFaceBox({
            x: num("X-Face-Box-X") ?? undefined,
            y: num("X-Face-Box-Y") ?? undefined,
            w: num("X-Face-Box-W") ?? undefined,
            h: num("X-Face-Box-H") ?? undefined,
        })
    }

    const startScan = async ({ autoTriggered = false, aligned = false, force = false } = {}) => {
        if (((!readyRef.current || camErr) && !force) || analyzingRef.current) return false

        analyzingRef.current = true
        setAnalyzing(true)
        setAutoScanProgress(AUTO_SCAN_STEPS)
        setMessage(force ? "Opening Pi camera window..." : "Analyzing age...")

        try {
            logCamera("scan_begin", {
                auto_triggered: autoTriggered,
                aligned,
                force,
                mode: force ? "pi_legacy_window" : "pi_camera",
            })
            const res = await fetch(`${PI_SERVER}/scan-age`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            })

            let data: Record<string, unknown> = {}
            try { data = await res.json() } catch { data = {} }
            logCamera("scan_response", data)

            if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : `Scan failed (${res.status})`)

            if (data.success && !data.fallback && data.age_group) {
                onDetected(data.age_group as AgeGroup)
                return true
            }

            setMessage(
                typeof data.message === "string"
                    ? data.message
                    : data.fallback
                        ? "Face seen, but age read was unclear. Try again."
                        : "Could not detect age. Please choose manually or retry."
            )
            cooldownUntilRef.current = Date.now() + 600
            autoTriggeredRef.current = false
            alignedStepsRef.current = 0
            setAutoScanProgress(0)
            return false
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Age scan failed. Please choose manually or retry."
            setMessage(msg)
            cooldownUntilRef.current = Date.now() + 600
            autoTriggeredRef.current = false
            alignedStepsRef.current = 0
            setAutoScanProgress(0)
            logCamera("scan_error", { error: msg })
            return false
        } finally {
            analyzingRef.current = false
            setAnalyzing(false)
        }
    }

    useEffect(() => {
        if (mode === "legacy") {
            readyRef.current = false
            analyzingRef.current = false
            autoTriggeredRef.current = false
            alignedStepsRef.current = 0
            cooldownUntilRef.current = 0
            setReady(false)
            setCamErr(null)
            setGuideState("adjust")
            setFaceBox(null)
            setAutoScanProgress(0)
            setMessage("Tap the green button to open the Raspberry Pi camera window.")
            clearFrameUrl()
            return
        }

        let cancelled = false

        readyRef.current = false
        analyzingRef.current = false
        autoTriggeredRef.current = false
        alignedStepsRef.current = 0
        cooldownUntilRef.current = 0
        setReady(false)
        setCamErr(null)
        setGuideState("adjust")
        setFaceBox(null)
        setAutoScanProgress(0)
        setMessage("Connecting to Pi camera...")

        const loop = async () => {
            while (!cancelled) {
                try {
                    const res = await fetch(`${PI_SERVER}/camera-frame?ts=${Date.now()}`, { cache: "no-store" })
                    if (!res.ok) {
                        throw new Error(res.headers.get("X-Camera-Error") || `Camera unavailable (${res.status})`)
                    }

                    const buf = await res.arrayBuffer()
                    const blob = new Blob([buf], { type: "image/jpeg" })
                    const url = URL.createObjectURL(blob)
                    clearFrameUrl()
                    frameUrlRef.current = url
                    setFrameUrl(url)

                    readyRef.current = true
                    setReady(true)
                    setCamErr(null)
                    setMessage("Place your face inside the highlighted area.")

                    const faceDetected = res.headers.get("X-Face-Detected") === "1"
                    const faceCentered = res.headers.get("X-Face-Centered") === "1"
                    const box = parseFaceFromHeaders(res)
                    setFaceBox(box)
                    const faceInGuide = isFaceInsideAgeGuide(box)
                    const aligned = faceDetected && (faceCentered || faceInGuide)
                    setGuideState(aligned ? "aligned" : "adjust")

                    if (!aligned) {
                        alignedStepsRef.current = 0
                        autoTriggeredRef.current = false
                        setAutoScanProgress(0)
                        setMessage(
                            faceDetected
                                ? "Move your face into the highlighted area."
                                : "Place your face inside the highlighted area."
                        )
                    } else {
                        if (Date.now() < cooldownUntilRef.current) {
                            setAutoScanProgress(0)
                            setMessage("Hold your face in the box...")
                            await sleep(150)
                            continue
                        }

                        const nextSteps = Math.min(alignedStepsRef.current + 1, AUTO_SCAN_STEPS)
                        alignedStepsRef.current = nextSteps
                        setAutoScanProgress(nextSteps)

                        if (nextSteps < AUTO_SCAN_STEPS) {
                            setMessage("Face aligned. Hold still for auto scan...")
                        } else if (!autoTriggeredRef.current) {
                            autoTriggeredRef.current = true
                            setMessage("Face aligned. Capturing automatically...")
                            logCamera("auto_scan_triggered", { steps: nextSteps })
                            await sleep(60)
                            if (cancelled) return
                            await startScan({ autoTriggered: true, aligned: true })
                            if (cancelled) return
                            await sleep(120)
                            continue
                        }
                    }

                    await sleep(220)
                } catch (err) {
                    const msg = err instanceof Error ? err.message : "Camera unavailable"
                    if (cancelled) break
                    readyRef.current = false
                    setReady(false)
                    setCamErr(msg)
                    setGuideState("adjust")
                    setFaceBox(null)
                    setAutoScanProgress(0)
                    setMessage(msg)
                    logCamera("camera_error", { error: msg })
                    await sleep(450)
                }
            }
        }

        void loop()

        return () => {
            cancelled = true
            clearFrameUrl()
        }
    }, [attempt, mode])

    if (mode === "legacy") {
        return (
            <div style={{ marginBottom: 12 }}>
                <div style={{
                    position: "relative", borderRadius: 14, overflow: "hidden",
                    background: "#0F172A", minHeight: 250, marginBottom: 14,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    padding: 24, textAlign: "center", gap: 12,
                }}>
                    <div style={{
                        width: 64, height: 64, borderRadius: 20,
                        background: "rgba(37,99,235,0.18)", color: "#BFDBFE",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 20, fontWeight: 800,
                    }}>
                        PI
                    </div>
                    <div style={{ color: "#F8FAFC", fontSize: 18, fontWeight: 700 }}>
                        Raspberry Pi Camera Window
                    </div>
                    <p style={{ color: "#94A3B8", fontSize: 14, lineHeight: 1.6, margin: 0, maxWidth: 420 }}>
                        This opens the fullscreen Pi camera screen on the Raspberry Pi, scans there, and sends the age result back into this app.
                    </p>
                </div>

                <div style={{
                    background: "#F8FAFC", border: `1px solid ${C.border}`, borderRadius: 12,
                    padding: "12px 14px", marginBottom: 12, textAlign: "center",
                    color: C.gray, fontSize: 14,
                }}>
                    {message}
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                    <button
                        onClick={() => { void startScan({ force: true }) }}
                        disabled={analyzing}
                        style={{
                            ...btn(analyzing ? C.border : C.green, analyzing ? C.gray : "#fff"),
                            width: "100%",
                        }}
                    >
                        {analyzing ? "Analyzing..." : "Open Pi Camera Window"}
                    </button>
                </div>

                <p style={{ fontSize: 12, color: C.gray, textAlign: "center", margin: "12px 0 0" }}>
                    This uses the legacy Raspberry Pi/OpenCV scan instead of the in-app preview.
                </p>
            </div>
        )
    }

    return (
        <div style={{ marginBottom: 12 }}>
            <div style={{
                position: "relative", borderRadius: 14, overflow: "hidden",
                background: "#0F172A", height: 250, marginBottom: 14,
            }}>
                {camErr ? (
                    <div style={{
                        height: "100%", display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center", gap: 8, padding: 16,
                    }}>
                        <span style={{ color: "#CBD5E1", fontSize: 16, fontWeight: 700, textAlign: "center" }}>Camera unavailable</span>
                        <span style={{ color: "#94A3B8", fontSize: 12, textAlign: "center" }}>{camErr}</span>
                        <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap", justifyContent: "center" }}>
                            <button
                                onClick={() => { void startScan({ force: true }) }}
                                disabled={analyzing}
                                style={{ ...btn(C.green), width: "auto", padding: "10px 20px", fontSize: 14 }}
                            >
                                Use Pi Camera Window
                            </button>
                            <button
                                onClick={() => setAttempt(a => a + 1)}
                                disabled={analyzing}
                                style={{ ...btn(C.blue), width: "auto", padding: "10px 20px", fontSize: 14 }}
                            >
                                Retry Camera
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {frameUrl && (
                            <img
                                src={frameUrl}
                                alt="Kiosk camera preview"
                                style={{
                                    width: "100%", height: "100%", objectFit: "cover", display: "block",
                                    opacity: ready ? 1 : 0,
                                    transition: "opacity 0.3s",
                                }}
                            />
                        )}

                        <div style={{
                            position: "absolute", inset: 0, display: "flex",
                            alignItems: "center", justifyContent: "center", pointerEvents: "none",
                        }}>
                            <div style={{
                                width: `${AGE_GUIDE.w * 100}%`,
                                height: `${AGE_GUIDE.h * 100}%`,
                                border: guideState === "aligned"
                                    ? `4px solid ${C.green}`
                                    : "3px dashed rgba(191,219,254,0.95)",
                                borderRadius: 24,
                                boxShadow: "0 0 0 9999px rgba(0,0,0,0.28)",
                            }} />
                            <div style={{
                                position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
                                background: guideState === "aligned" ? "rgba(34,197,94,0.9)" : "rgba(15,23,42,0.78)",
                                color: "#fff", padding: "8px 12px", borderRadius: 999,
                                fontSize: 12, fontWeight: 700, letterSpacing: 0.2, whiteSpace: "nowrap",
                            }}>
                                {guideState === "aligned" ? "Face in position" : "Place face inside area"}
                            </div>
                            {faceBox && (
                                <div style={{
                                    position: "absolute",
                                    left: `${faceBox.x * 100}%`,
                                    top: `${faceBox.y * 100}%`,
                                    width: `${faceBox.w * 100}%`,
                                    height: `${faceBox.h * 100}%`,
                                    border: `2px solid ${guideState === "aligned" ? "#86EFAC" : "#60A5FA"}`,
                                    borderRadius: 16,
                                }} />
                            )}
                        </div>

                        {!ready && (
                            <div style={{
                                position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                                alignItems: "center", justifyContent: "center", gap: 10,
                            }}>
                                <CameraSpinner />
                                <span style={{ color: "#94A3B8", fontSize: 14 }}>{message}</span>
                            </div>
                        )}

                        {analyzing && (
                            <div style={{
                                position: "absolute", inset: 0, display: "flex",
                                alignItems: "center", justifyContent: "center",
                                background: "rgba(15,23,42,0.34)",
                            }}>
                                <div style={{
                                    background: "rgba(255,255,255,0.92)",
                                    color: C.slate, padding: "12px 18px",
                                    borderRadius: 12, fontSize: 14, fontWeight: 700,
                                }}>
                                    Analyzing...
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            <div style={{
                background: "#F8FAFC", border: `1px solid ${C.border}`, borderRadius: 12,
                padding: "12px 14px", marginBottom: 12, textAlign: "center",
                color: C.gray, fontSize: 14,
            }}>
                {message}
            </div>

            <div style={{ marginBottom: 12 }}>
                <div style={{
                    height: 6,
                    background: C.border,
                    borderRadius: 999,
                    overflow: "hidden",
                }}>
                    <div style={{
                        height: "100%",
                        width: `${(autoScanProgress / AUTO_SCAN_STEPS) * 100}%`,
                        background: guideState === "aligned" ? C.green : C.blue,
                        borderRadius: 999,
                        transition: "width 0.2s ease",
                    }} />
                </div>
                <p style={{ fontSize: 12, color: C.gray, textAlign: "center", margin: "8px 0 0" }}>
                    Photo captures automatically as soon as your face hits the green box.
                </p>
            </div>

            <p style={{ fontSize: 12, color: C.gray, textAlign: "center", margin: "0 0 12px" }}>
                Preview frames are temporary. This step saves only the age result, not a photo.
            </p>

            <div style={{ display: "flex", gap: 10 }}>
                <button
                    onClick={() => {
                        cooldownUntilRef.current = 0
                        alignedStepsRef.current = 0
                        autoTriggeredRef.current = false
                        setAutoScanProgress(0)
                        setAttempt(a => a + 1)
                    }}
                    disabled={analyzing}
                    style={{
                        ...btn("transparent", C.slate, `1px solid ${C.border}`),
                        width: "100%",
                    }}
                >
                    Refresh
                </button>
            </div>
        </div>
    )
}
// ── Card scan camera ───────────────────────────────────────────
function LiveCamera({
    onCapture,
    scanning,
    t,
}: {
    onCapture: (b64: string) => void
    scanning: boolean
    t: Record<string, string>
}) {
    const frameUrlRef = useRef<string | null>(null)
    const frameB64Ref = useRef<string | null>(null)
    const [frameUrl, setFrameUrl] = useState<string | null>(null)
    const [ready, setReady] = useState(false)
    const [camErr, setCamErr] = useState<string | null>(null)
    const [attempt, setAttempt] = useState(0)
    const [status, setStatus] = useState("Connecting to Pi camera...")

    useEffect(() => {
        return () => {
            if (frameUrlRef.current) URL.revokeObjectURL(frameUrlRef.current)
            frameUrlRef.current = null
            frameB64Ref.current = null
        }
    }, [])

    useEffect(() => {
        if (scanning) return

        let cancelled = false

        const previewLoop = async () => {
            while (!cancelled) {
                try {
                    setStatus("Connecting to Pi camera...")
                    const res = await fetch(`${PI_SERVER}/camera-frame?ts=${Date.now()}`, { cache: "no-store" })
                    if (!res.ok) {
                        throw new Error(res.headers.get("X-Camera-Error") || `Camera unavailable (${res.status})`)
                    }

                    const buf = await res.arrayBuffer()
                    const blob = new Blob([buf], { type: "image/jpeg" })
                    const url = URL.createObjectURL(blob)
                    const b64 = arrayBufferToBase64(buf)

                    if (frameUrlRef.current) URL.revokeObjectURL(frameUrlRef.current)
                    frameUrlRef.current = url
                    frameB64Ref.current = b64
                    setFrameUrl(url)

                    setReady(true)
                    setCamErr(null)
                    setStatus("Position your card inside the guide.")
                } catch (err) {
                    const msg = err instanceof Error ? err.message : "Camera unavailable"
                    if (cancelled) break
                    if (frameUrlRef.current) {
                        URL.revokeObjectURL(frameUrlRef.current)
                        frameUrlRef.current = null
                    }
                    frameB64Ref.current = null
                    setFrameUrl(null)
                    setCamErr(msg)
                    setReady(false)
                    setStatus(msg)
                    await sleep(450)
                    continue
                }

                await sleep(220)
            }
        }

        void previewLoop()

        return () => {
            cancelled = true
        }
    }, [attempt, scanning])

    const capture = async () => {
        if (scanning || !ready || camErr) return
        const b64 = frameB64Ref.current
        if (!b64) {
            setStatus("Camera not ready yet")
            return
        }
        onCapture(b64)
    }

    return (
        <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 13, color: C.gray, textAlign: "center", marginBottom: 10 }}>
                {t.positionCard}
            </p>

            <div style={{
                position: "relative", borderRadius: 14, overflow: "hidden",
                background: "#0F172A", height: 230, marginBottom: 12,
            }}>
                {camErr ? (
                    <div style={{
                        height: "100%", display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center", gap: 8,
                    }}>
                        <span style={{ color: "#CBD5E1", fontSize: 18, fontWeight: 700 }}>Camera unavailable</span>
                        <span style={{ color: "#64748B", fontSize: 13 }}>Refresh the page or reconnect the camera.</span>
                    </div>
                ) : (
                    <>
                        {frameUrl && (
                            <img
                                src={frameUrl}
                                alt="Kiosk card camera"
                                style={{
                                    width: "100%", height: "100%", objectFit: "cover",
                                    opacity: ready ? 1 : 0,
                                    transition: "opacity 0.4s",
                                    display: "block",
                                }}
                            />
                        )}
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
                                position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                                alignItems: "center", justifyContent: "center", gap: 10,
                            }}>
                                <CameraSpinner />
                                <span style={{ color: "#94A3B8", fontSize: 14 }}>{status}</span>
                            </div>
                        )}
                    </>
                )}
            </div>

            <p style={{ fontSize: 12, color: C.gray, textAlign: "center", margin: "0 0 12px" }}>
                Preview frames are temporary. A card image is sent only when you tap Scan.
            </p>

            <div style={{ display: "flex", gap: 10 }}>
                <button
                    onClick={() => { void capture() }}
                    disabled={scanning || !ready || !!camErr}
                    style={btn(
                        scanning || !ready || !!camErr ? C.border : C.blue,
                        scanning || !ready || !!camErr ? C.gray : "#fff",
                    )}
                >
                    {scanning ? t.scanning : t.scanBtn}
                </button>
                <button
                    onClick={() => setAttempt(a => a + 1)}
                    disabled={scanning}
                    style={{
                        ...btn("transparent", C.slate, `1px solid ${C.border}`),
                        width: 150, flexShrink: 0,
                    }}
                >
                    Refresh
                </button>
            </div>
        </div>
    )
}

// ── Spinner shown while camera is initialising ─────────────────
function BrowserCardCamera({
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
    const [camErr, setCamErr] = useState<string | null>(null)

    useEffect(() => {
        let active = true

        navigator.mediaDevices
            .getUserMedia({ video: { facingMode: "environment" } })
            .then(stream => {
                if (!active) {
                    stream.getTracks().forEach(track => track.stop())
                    return
                }

                streamRef.current = stream
                if (videoRef.current) {
                    videoRef.current.srcObject = stream
                    void videoRef.current.play()
                }
                setReady(true)
                setCamErr(null)
            })
            .catch(() => {
                if (!active) return
                setCamErr("Browser camera permission was blocked or unavailable.")
            })

        return () => {
            active = false
            streamRef.current?.getTracks().forEach(track => track.stop())
            streamRef.current = null
        }
    }, [])

    const capture = () => {
        if (!videoRef.current || scanning) return

        const canvas = document.createElement("canvas")
        canvas.width = videoRef.current.videoWidth || 640
        canvas.height = videoRef.current.videoHeight || 480
        canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0)
        const b64 = canvas.toDataURL("image/jpeg", 0.85).split(",")[1]
        onCapture(b64)
    }

    return (
        <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 13, color: C.gray, textAlign: "center", marginBottom: 10 }}>
                {t.positionCard}
            </p>

            <div style={{
                position: "relative", borderRadius: 14, overflow: "hidden",
                background: "#0F172A", height: 230, marginBottom: 12,
            }}>
                {camErr ? (
                    <div style={{
                        height: "100%", display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center", gap: 8, padding: 16,
                    }}>
                        <span style={{ color: "#CBD5E1", fontSize: 18, fontWeight: 700 }}>Camera unavailable</span>
                        <span style={{ color: "#64748B", fontSize: 13, textAlign: "center" }}>{camErr}</span>
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
                                position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                                alignItems: "center", justifyContent: "center", gap: 10,
                            }}>
                                <CameraSpinner />
                                <span style={{ color: "#94A3B8", fontSize: 14 }}>Starting app camera...</span>
                            </div>
                        )}
                    </>
                )}
            </div>

            <p style={{ fontSize: 12, color: C.gray, textAlign: "center", margin: "0 0 12px" }}>
                This mode uses the browser camera on the current device.
            </p>

            <button
                onClick={camErr ? undefined : capture}
                disabled={scanning || !ready || !!camErr}
                style={btn(
                    scanning || !ready || !!camErr ? C.border : C.blue,
                    scanning || !ready || !!camErr ? C.gray : "#fff",
                )}
            >
                {scanning ? t.scanning : t.scanBtn}
            </button>
        </div>
    )
}

function CameraSpinner() {
    return (
        <div style={{
            width: 36, height: 36, borderRadius: "50%",
            border: `3px solid rgba(148,163,184,0.3)`,
            borderTopColor: "#60A5FA",
            animation: "spin 0.9s linear infinite",
        }}>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    )
}

// ── Main App ───────────────────────────────────────────────────
type Step = "language" | "camera" | "age" | "card" | "questions" | "complete"

export default function KioskApp() {
    const [step, setStep] = useState<Step>("language")
    const [lang, setLang] = useState("en")
    const [cameraMode, setCameraMode] = useState<CameraMode | null>(null)
    const [ageGroup, setAgeGroup] = useState<AgeGroup | null>(null)
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

    useEffect(() => {
        if (ageGroup && step === "age") setTimeout(() => setStep("card"), 700)
    }, [ageGroup])

    const speak = async (text: string) => {
        try {
            await fetch(`${AI_SERVER}/speak`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text, lang }),
            })
        } catch { }
    }

    const handleCardCapture = async (b64: string) => {
        setScanningCard(true)
        try {
            const res = await fetch(`${AI_SERVER}/scan-card`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image: b64 }),
            })
            const d = await res.json()
            setPatientName(d.name !== "Unknown" ? d.name : "")
            setHealthId(d.health_id !== "N/A" ? d.health_id : "")
        } catch { }
        setScanningCard(false)
        setStep("questions")
        speak(TRIAGE_Q[lang]?.[QUESTION_IDS[0]] || TRIAGE_Q.en[QUESTION_IDS[0]])
    }

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

    const reset = () => {
        setStep("language"); setLang("en"); setCameraMode(null); setAgeGroup(null)
        setManualName(""); setManualId(""); setPatientName(""); setHealthId("")
        setQIndex(0); setAnswers({}); setCardMode("scan"); setScanningCard(false)
    }

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
                        onClick={() => { setLang(l.code); setCameraMode(null); setStep("camera") }}
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

    if (step === "camera") return (
        <Screen rtl={isRTL}>
            <div style={{ ...card, textAlign: "center", marginBottom: 16 }}>
                <div style={{
                    width: 52, height: 52, margin: "0 auto 14px",
                    borderRadius: 16, background: C.blueLight,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: C.blue, fontSize: 18, fontWeight: 800,
                }}>
                    CAM
                </div>
                <h2 style={{ fontSize: 22 * fs, fontWeight: 700, color: C.slate, margin: "0 0 10px" }}>
                    Choose Camera Mode
                </h2>
                <p style={{ color: C.gray, fontSize: 15, lineHeight: 1.5, margin: 0 }}>
                    Pick how you want to scan. Pi camera uses the Raspberry Pi fullscreen age scanner first, while app camera keeps everything on this device with manual age selection.
                </p>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
                <button
                    onClick={() => { setCameraMode("pi"); setStep("age") }}
                    style={{
                        ...card,
                        textAlign: "left",
                        cursor: "pointer",
                        border: `2px solid ${C.blue}`,
                        background: C.blueLight,
                    }}
                >
                    <div style={{ fontSize: 18, fontWeight: 700, color: C.slate, marginBottom: 6 }}>Pi Camera</div>
                    <div style={{ fontSize: 14, color: C.gray, lineHeight: 1.5 }}>
                        Use the green Pi-camera button for age scanning in the fullscreen Raspberry Pi window. The health card step later still uses the Pi camera preview inside the app.
                    </div>
                </button>

                <button
                    onClick={() => { setCameraMode("app"); setStep("age") }}
                    style={{
                        ...card,
                        textAlign: "left",
                        cursor: "pointer",
                        border: `2px solid ${C.border}`,
                    }}
                >
                    <div style={{ fontSize: 18, fontWeight: 700, color: C.slate, marginBottom: 6 }}>App Camera</div>
                    <div style={{ fontSize: 14, color: C.gray, lineHeight: 1.5 }}>
                        Use this device browser camera for the health card step. Age will be chosen manually instead of auto-detected.
                    </div>
                </button>
            </div>
        </Screen>
    )

    if (step === "age") return (
        <Screen rtl={isRTL}>
            <div style={{ ...card, textAlign: "center", marginBottom: 16 }}>
                <div style={{
                    width: 52, height: 52, margin: "0 auto 14px",
                    borderRadius: 16, background: C.blueLight,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: C.blue, fontSize: 18, fontWeight: 800,
                }}>
                    AGE
                </div>
                <p style={{ color: C.gray, fontSize: 16 * fs, marginBottom: 8 }}>
                    {cameraMode === "pi" ? t.detecting : "App camera mode uses manual age selection."}
                </p>
                {ageGroup
                    ? <div style={{ fontSize: 32, fontWeight: 700, color: C.green }}>{ageGroup} detected</div>
                    : <div style={{ fontSize: 16, fontWeight: 600, color: C.blue, lineHeight: 1.4 }}>
                        {cameraMode === "pi"
                            ? "Use the green button below to launch the Pi camera window"
                            : "The next screen will use the app camera for health card scanning"}
                    </div>
                }
            </div>
            {!ageGroup && cameraMode === "pi" && (
                <div style={{ ...card, marginBottom: 16 }}>
                    <AgeCamera onDetected={setAgeGroup} mode="legacy" />
                </div>
            )}
            {!ageGroup && cameraMode === "app" && (
                <div style={{ ...card, marginBottom: 16, textAlign: "center" }}>
                    <p style={{ color: C.slate, fontSize: 16, fontWeight: 600, margin: "0 0 8px" }}>
                        App camera mode does not auto-detect age yet.
                    </p>
                    <p style={{ color: C.gray, fontSize: 14, lineHeight: 1.5, margin: 0 }}>
                        Choose the age group below, then the health card screen will use this device browser camera.
                    </p>
                </div>
            )}
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
                            <span style={{
                                minWidth: 42, padding: "4px 10px", borderRadius: 999,
                                background: C.white, color: C.blue, fontSize: 12, fontWeight: 800, letterSpacing: 0.3,
                            }}>
                                {g === "Child" ? "0-17" : g === "Adult" ? "18-54" : "55+"}
                            </span>
                            <span style={{ fontSize: 13 * fs, fontWeight: 600, color: C.slate }}>
                                {t[g.toLowerCase() as keyof typeof t]}
                            </span>
                        </button>
                    ))}
                </div>
                <button
                    onClick={() => setStep("camera")}
                    style={{ ...btn("transparent", C.gray, `1px solid ${C.border}`), marginTop: 14 }}
                >
                    Change Camera Mode
                </button>
            </div>
        </Screen>
    )

    if (step === "card") return (
        <Screen rtl={isRTL}>
            <h2 style={{ fontSize: 20 * fs, fontWeight: 700, color: C.slate, marginBottom: 20, textAlign: "center" }}>
                {t.scanCard}
            </h2>
            <p style={{ textAlign: "center", color: C.gray, margin: "0 0 14px", fontSize: 14 }}>
                {cameraMode === "pi"
                    ? "Health card scan is using the Raspberry Pi camera preview inside the app."
                    : "Health card scan is using this device browser camera."}
            </p>
            {cardMode === "scan" ? (
                <div style={{ ...card, marginBottom: 12 }}>
                    {cameraMode === "app"
                        ? <BrowserCardCamera onCapture={handleCardCapture} scanning={scanningCard} t={t} />
                        : <LiveCamera onCapture={handleCardCapture} scanning={scanningCard} t={t} />}
                    <button
                        onClick={() => setCardMode("manual")}
                        style={{ ...btn("transparent", C.gray, `1px solid ${C.border}`), marginTop: 4 }}
                    >
                        {t.enterManual}
                    </button>
                    <button
                        onClick={() => setStep("camera")}
                        style={{ ...btn("transparent", C.gray, `1px solid ${C.border}`), marginTop: 10 }}
                    >
                        Change Camera Mode
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
                        Back to camera
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
                                minWidth: 72, height: 46, cursor: "pointer", flexShrink: 0,
                                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
                            }}
                            title="Hear question aloud"
                        >
                            <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>Play</span>
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
                            {t.yes}
                        </button>
                        <button
                            onClick={() => handleAnswer(qId, false)}
                            disabled={submitting}
                            style={{ ...btn("#334155"), flex: 1, fontSize: 20 * fs, padding: "20px", opacity: submitting ? 0.6 : 1 }}
                        >
                            {t.no}
                        </button>
                    </div>
                </div>
            </Screen>
        )
    }

    if (step === "complete") return (
        <Screen rtl={isRTL}>
            <div style={{ ...card, textAlign: "center", padding: 52 }}>
                <div style={{
                    width: 72, height: 72, margin: "0 auto 20px", borderRadius: "50%",
                    background: "#DCFCE7", color: "#166534",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, fontWeight: 800,
                }}>
                    DONE
                </div>
                <h2 style={{ fontSize: 26 * fs, fontWeight: 700, color: C.slate, margin: "0 0 14px" }}>
                    {t.complete}
                </h2>
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


