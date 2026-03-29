"use client"
/**
 * frontend/kiosk/app.tsx
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * WHAT THIS FILE DOES
 *   This is the patient-facing kiosk screen.
 *   It runs in a browser on the Pi (or any touchscreen).
 *
 * FLOW
 *   1. language   → patient picks their language
 *   2. camera     → choose Pi-camera or browser-camera mode
 *   3. age        → Pi camera detects age OR patient picks manually
 *   4. card       → scan health card (Pi camera feed → Gemini OCR)
 *                   OR enter name/health-ID manually
 *   5. body       → patient taps a BODY REGION on a human silhouette
 *   6. questions  → 3-4 targeted CTAS yes/no questions for that region
 *                   each question is spoken aloud via Flask /speak
 *   7. complete   → "Please take a seat" (priority hidden from patient)
 *
 * SERVERS USED
 *   PI_SERVER  (port 8000) — Pi FastAPI: /scan-age, /camera-frame
 *   AI_SERVER  (port 5001) — Flask:      /speak, /scan-card, /questions, /queue
 */

import { useState, useEffect, useRef } from "react"

const PI_SERVER = process.env.NEXT_PUBLIC_PI_SERVER || "http://localhost:8000"
const AI_SERVER = process.env.NEXT_PUBLIC_AI_SERVER || "http://localhost:5001"

// ── Colors ─────────────────────────────────────────────────────
const C = {
    blue: "#2563EB", blueDark: "#1D4ED8", blueLight: "#EFF6FF",
    slate: "#1E293B", slateLight: "#334155", gray: "#64748B",
    lightGray: "#F1F5F9", border: "#E2E8F0", white: "#FFFFFF",
    red: "#EF4444", green: "#22C55E", amber: "#F59E0B",
}

// ── Languages ───────────────────────────────────────────────────
const LANGUAGES = [
    { code: "en", label: "English", region: "CA", dir: "ltr" },
    { code: "fr", label: "Français", region: "FR", dir: "ltr" },
    { code: "ar", label: "العربية", region: "SA", dir: "rtl" },
    { code: "pa", label: "ਪੰਜਾਬੀ", region: "IN", dir: "ltr" },
    { code: "zh", label: "中文", region: "CN", dir: "ltr" },
    { code: "es", label: "Español", region: "ES", dir: "ltr" },
]

// ── UI Translations ─────────────────────────────────────────────
const T: Record<string, Record<string, string>> = {
    en: {
        welcome: "Welcome to FastER Healthcare",
        selectLang: "Please select your language",
        cameraMode: "Choose Camera Mode",
        cameraModeDesc: "Pi Camera uses the Raspberry Pi for age detection. App Camera uses this device.",
        piCam: "Pi Camera", appCam: "App Camera",
        detectingAge: "Looking at camera to detect your age...",
        orSelectAge: "Or select your age group:",
        child: "Child (0–17)", adult: "Adult (18–54)", senior: "Senior (55+)",
        scanCard: "Scan Your Health Card",
        scanCardDesc: "Position your card in the camera view, then tap Scan.",
        scanBtn: "Scan Card", enterManual: "Enter Manually",
        scanning: "Reading card...",
        name: "Full Name", healthId: "Health Card Number", confirm: "Confirm & Continue",
        whereHurts: "Where does it hurt?",
        whereHurtsDesc: "Tap the area on the body that needs attention.",
        chest: "Chest", head: "Head / Face", arm: "Arm / Shoulder",
        leg: "Leg / Knee / Hip", abdomen: "Abdomen", other: "Other / General",
        otherDesc: "(Vomiting, Fainting, Fever, Rash...)",
        yes: "Yes", no: "No",
        complete: "Check-in Complete!",
        seated: "Thank you. Please take a seat. A nurse will call your name shortly.",
        newCheckin: "Start New Check-in",
        connecting: "Connecting to camera...", refresh: "Refresh",
        cameraUnavailable: "Camera unavailable", retryCamera: "Retry",
        faceInPosition: "Face in position", placeFace: "Place your face in the guide",
        analyzing: "Analyzing...", tapGreen: "Tap the button to open Pi camera window",
        openPiCam: "Open Pi Camera",
        positionCard: "Position your health card inside the dashed guide, then tap Scan.",
        backToScan: "Back to camera scan", changeCamMode: "Change Camera Mode",
        cardNote: "Preview only — photo sent when you tap Scan.",
        play: "🔊",
    },
    fr: {
        welcome: "Bienvenue chez FastER Santé",
        selectLang: "Veuillez sélectionner votre langue",
        cameraMode: "Choisir le mode caméra",
        cameraModeDesc: "Caméra Pi utilise le Raspberry Pi pour la détection d'âge.",
        piCam: "Caméra Pi", appCam: "Caméra appareil",
        detectingAge: "Détection de l'âge en cours...",
        orSelectAge: "Ou sélectionnez votre groupe d'âge :",
        child: "Enfant (0–17)", adult: "Adulte (18–54)", senior: "Aîné (55+)",
        scanCard: "Scanner votre carte santé",
        scanCardDesc: "Placez la carte dans la vue caméra, puis appuyez sur Scanner.",
        scanBtn: "Scanner", enterManual: "Entrer manuellement",
        scanning: "Lecture de la carte...",
        name: "Nom complet", healthId: "Numéro de carte santé", confirm: "Confirmer et continuer",
        whereHurts: "Où avez-vous mal ?",
        whereHurtsDesc: "Appuyez sur la zone du corps qui nécessite attention.",
        chest: "Poitrine", head: "Tête / Visage", arm: "Bras / Épaule",
        leg: "Jambe / Genou / Hanche", abdomen: "Abdomen", other: "Autre / Général",
        otherDesc: "(Vomissements, Évanouissement, Fièvre, Éruption...)",
        yes: "Oui", no: "Non",
        complete: "Enregistrement terminé !",
        seated: "Merci. Veuillez vous asseoir. Une infirmière appellera votre nom bientôt.",
        newCheckin: "Nouvel enregistrement",
        connecting: "Connexion à la caméra...", refresh: "Actualiser",
        cameraUnavailable: "Caméra indisponible", retryCamera: "Réessayer",
        faceInPosition: "Visage en position", placeFace: "Placez votre visage dans le guide",
        analyzing: "Analyse...", tapGreen: "Appuyez pour ouvrir la caméra Pi",
        openPiCam: "Ouvrir caméra Pi",
        positionCard: "Placez votre carte dans le guide, puis appuyez sur Scanner.",
        backToScan: "Retour au scan", changeCamMode: "Changer de mode",
        cardNote: "Aperçu seulement — photo envoyée en appuyant sur Scanner.",
        play: "🔊",
    },
    ar: {
        welcome: "مرحباً بك في FastER للرعاية الصحية",
        selectLang: "يرجى اختيار لغتك",
        cameraMode: "اختر وضع الكاميرا",
        cameraModeDesc: "كاميرا Pi تستخدم Raspberry Pi لاكتشاف العمر.",
        piCam: "كاميرا Pi", appCam: "كاميرا الجهاز",
        detectingAge: "جارٍ اكتشاف عمرك...",
        orSelectAge: "أو اختر فئتك العمرية:",
        child: "طفل (0–17)", adult: "بالغ (18–54)", senior: "كبير السن (55+)",
        scanCard: "مسح بطاقة الصحة",
        scanCardDesc: "ضع البطاقة في إطار الكاميرا ثم اضغط مسح.",
        scanBtn: "مسح", enterManual: "إدخال يدوي",
        scanning: "قراءة البطاقة...",
        name: "الاسم الكامل", healthId: "رقم بطاقة الصحة", confirm: "تأكيد والمتابعة",
        whereHurts: "أين تشعر بالألم؟",
        whereHurtsDesc: "اضغط على المنطقة المؤلمة في جسم الإنسان.",
        chest: "الصدر", head: "الرأس / الوجه", arm: "الذراع / الكتف",
        leg: "الساق / الركبة / الورك", abdomen: "البطن", other: "أخرى / عام",
        otherDesc: "(تقيؤ، إغماء، حمى، طفح جلدي...)",
        yes: "نعم", no: "لا",
        complete: "اكتمل تسجيل الوصول!",
        seated: "شكراً. يرجى الجلوس. ستُستدعى قريباً.",
        newCheckin: "تسجيل جديد",
        connecting: "جارٍ الاتصال بالكاميرا...", refresh: "تحديث",
        cameraUnavailable: "الكاميرا غير متاحة", retryCamera: "إعادة المحاولة",
        faceInPosition: "الوجه في الموضع الصحيح", placeFace: "ضع وجهك في الإطار",
        analyzing: "جارٍ التحليل...", tapGreen: "اضغط لفتح نافذة كاميرا Pi",
        openPiCam: "فتح كاميرا Pi",
        positionCard: "ضع بطاقتك داخل الإطار المتقطع ثم اضغط مسح.",
        backToScan: "العودة للمسح", changeCamMode: "تغيير الوضع",
        cardNote: "معاينة فقط — تُرسل الصورة عند الضغط على مسح.",
        play: "🔊",
    },
    pa: {
        welcome: "FastER ਹੈਲਥਕੇਅਰ ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ",
        selectLang: "ਕਿਰਪਾ ਕਰਕੇ ਆਪਣੀ ਭਾਸ਼ਾ ਚੁਣੋ",
        cameraMode: "ਕੈਮਰਾ ਮੋਡ ਚੁਣੋ",
        cameraModeDesc: "Pi ਕੈਮਰਾ Raspberry Pi ਵਰਤਦਾ ਹੈ।",
        piCam: "Pi ਕੈਮਰਾ", appCam: "ਐਪ ਕੈਮਰਾ",
        detectingAge: "ਉਮਰ ਦਾ ਪਤਾ ਲਗਾਇਆ ਜਾ ਰਿਹਾ ਹੈ...",
        orSelectAge: "ਜਾਂ ਆਪਣੀ ਉਮਰ ਸ਼੍ਰੇਣੀ ਚੁਣੋ:",
        child: "ਬੱਚਾ (0–17)", adult: "ਬਾਲਗ (18–54)", senior: "ਬਜ਼ੁਰਗ (55+)",
        scanCard: "ਸਿਹਤ ਕਾਰਡ ਸਕੈਨ ਕਰੋ",
        scanCardDesc: "ਕਾਰਡ ਕੈਮਰੇ ਵਿੱਚ ਰੱਖੋ, ਫਿਰ ਸਕੈਨ ਦਬਾਓ।",
        scanBtn: "ਸਕੈਨ", enterManual: "ਮੈਨੁਅਲੀ ਦਰਜ ਕਰੋ",
        scanning: "ਕਾਰਡ ਪੜ੍ਹਿਆ ਜਾ ਰਿਹਾ ਹੈ...",
        name: "ਪੂਰਾ ਨਾਮ", healthId: "ਸਿਹਤ ਕਾਰਡ ਨੰਬਰ", confirm: "ਪੁਸ਼ਟੀ ਕਰੋ",
        whereHurts: "ਦਰਦ ਕਿੱਥੇ ਹੈ?",
        whereHurtsDesc: "ਮਨੁੱਖੀ ਚਿੱਤਰ 'ਤੇ ਉਹ ਥਾਂ ਦਬਾਓ ਜਿੱਥੇ ਦਰਦ ਹੈ।",
        chest: "ਛਾਤੀ", head: "ਸਿਰ / ਚਿਹਰਾ", arm: "ਬਾਂਹ / ਮੋਢਾ",
        leg: "ਲੱਤ / ਗੋਡਾ / ਕਮਰ", abdomen: "ਪੇਟ", other: "ਹੋਰ / ਆਮ",
        otherDesc: "(ਉਲਟੀ, ਬੇਹੋਸ਼ੀ, ਬੁਖਾਰ, ਧੱਫੜ...)",
        yes: "ਹਾਂ", no: "ਨਹੀਂ",
        complete: "ਚੈੱਕ-ਇਨ ਪੂਰਾ ਹੋਇਆ!",
        seated: "ਧੰਨਵਾਦ। ਕਿਰਪਾ ਕਰਕੇ ਬੈਠੋ। ਨਰਸ ਜਲਦੀ ਤੁਹਾਡਾ ਨਾਮ ਲਵੇਗੀ।",
        newCheckin: "ਨਵਾਂ ਚੈੱਕ-ਇਨ",
        connecting: "ਕੈਮਰੇ ਨਾਲ ਜੁੜਿਆ ਜਾ ਰਿਹਾ ਹੈ...", refresh: "ਤਾਜ਼ਾ ਕਰੋ",
        cameraUnavailable: "ਕੈਮਰਾ ਉਪਲਬਧ ਨਹੀਂ", retryCamera: "ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼",
        faceInPosition: "ਚਿਹਰਾ ਸਹੀ ਥਾਂ 'ਤੇ", placeFace: "ਚਿਹਰਾ ਫਰੇਮ ਵਿੱਚ ਰੱਖੋ",
        analyzing: "ਵਿਸ਼ਲੇਸ਼ਣ...", tapGreen: "Pi ਕੈਮਰਾ ਵਿੰਡੋ ਖੋਲ੍ਹਣ ਲਈ ਦਬਾਓ",
        openPiCam: "Pi ਕੈਮਰਾ ਖੋਲ੍ਹੋ",
        positionCard: "ਕਾਰਡ ਇਟਾਲਿਕ ਫਰੇਮ ਵਿੱਚ ਰੱਖੋ ਫਿਰ ਸਕੈਨ ਦਬਾਓ।",
        backToScan: "ਸਕੈਨ 'ਤੇ ਵਾਪਸ", changeCamMode: "ਮੋਡ ਬਦਲੋ",
        cardNote: "ਝਲਕ ਅਸਥਾਈ — ਤਸਵੀਰ ਸਿਰਫ਼ ਸਕੈਨ ਦਬਾਉਣ 'ਤੇ ਭੇਜੀ ਜਾਂਦੀ ਹੈ।",
        play: "🔊",
    },
    zh: {
        welcome: "欢迎来到 FastER 医疗",
        selectLang: "请选择您的语言",
        cameraMode: "选择摄像头模式",
        cameraModeDesc: "Pi 摄像头使用 Raspberry Pi 检测年龄。",
        piCam: "Pi 摄像头", appCam: "设备摄像头",
        detectingAge: "正在检测您的年龄...",
        orSelectAge: "或选择您的年龄组：",
        child: "儿童（0–17）", adult: "成人（18–54）", senior: "老年人（55+）",
        scanCard: "扫描健康卡",
        scanCardDesc: "将您的健康卡放在摄像头视野中，然后点击扫描。",
        scanBtn: "扫描", enterManual: "手动输入",
        scanning: "正在读取卡片...",
        name: "全名", healthId: "健康卡号码", confirm: "确认并继续",
        whereHurts: "哪里不舒服？",
        whereHurtsDesc: "请点击人体图上需要关注的部位。",
        chest: "胸部", head: "头部 / 面部", arm: "手臂 / 肩膀",
        leg: "腿部 / 膝盖 / 髋部", abdomen: "腹部", other: "其他 / 全身",
        otherDesc: "（呕吐、晕厥、发烧、皮疹...）",
        yes: "是", no: "否",
        complete: "登记完成！",
        seated: "谢谢。请就座。护士会尽快叫您的名字。",
        newCheckin: "开始新登记",
        connecting: "正在连接摄像头...", refresh: "刷新",
        cameraUnavailable: "摄像头不可用", retryCamera: "重试",
        faceInPosition: "人脸已就位", placeFace: "请将脸放入框内",
        analyzing: "正在分析...", tapGreen: "点击按钮打开 Pi 摄像头窗口",
        openPiCam: "打开 Pi 摄像头",
        positionCard: "将健康卡放入虚线框内，然后点击扫描。",
        backToScan: "返回扫描", changeCamMode: "更改模式",
        cardNote: "预览仅供参考 — 点击扫描时才发送图片。",
        play: "🔊",
    },
    es: {
        welcome: "Bienvenido a FastER Healthcare",
        selectLang: "Por favor seleccione su idioma",
        cameraMode: "Elegir modo de cámara",
        cameraModeDesc: "Cámara Pi usa el Raspberry Pi para detectar la edad.",
        piCam: "Cámara Pi", appCam: "Cámara dispositivo",
        detectingAge: "Detectando su edad...",
        orSelectAge: "O seleccione su grupo de edad:",
        child: "Niño (0–17)", adult: "Adulto (18–54)", senior: "Mayor (55+)",
        scanCard: "Escanear Tarjeta de Salud",
        scanCardDesc: "Coloque la tarjeta en la vista de la cámara y presione Escanear.",
        scanBtn: "Escanear", enterManual: "Ingresar manualmente",
        scanning: "Leyendo tarjeta...",
        name: "Nombre completo", healthId: "Número de tarjeta", confirm: "Confirmar y continuar",
        whereHurts: "¿Dónde le duele?",
        whereHurtsDesc: "Toque el área del cuerpo que necesita atención.",
        chest: "Pecho", head: "Cabeza / Cara", arm: "Brazo / Hombro",
        leg: "Pierna / Rodilla / Cadera", abdomen: "Abdomen", other: "Otro / General",
        otherDesc: "(Vómitos, Desmayo, Fiebre, Sarpullido...)",
        yes: "Sí", no: "No",
        complete: "¡Registro Completo!",
        seated: "Gracias. Por favor tome asiento. Una enfermera llamará su nombre pronto.",
        newCheckin: "Nuevo registro",
        connecting: "Conectando a la cámara...", refresh: "Actualizar",
        cameraUnavailable: "Cámara no disponible", retryCamera: "Reintentar",
        faceInPosition: "Rostro en posición", placeFace: "Coloque su rostro en la guía",
        analyzing: "Analizando...", tapGreen: "Toque para abrir la ventana de la cámara Pi",
        openPiCam: "Abrir cámara Pi",
        positionCard: "Coloque su tarjeta dentro de la guía punteada y presione Escanear.",
        backToScan: "Volver al escaneo", changeCamMode: "Cambiar modo",
        cardNote: "Solo vista previa — foto enviada al presionar Escanear.",
        play: "🔊",
    },
}

// ── CTAS Questions (multilingual) ───────────────────────────────
// These match server/app.py TRIAGE_QUESTIONS exactly (same IDs)
const TRIAGE_Q: Record<string, Record<string, Record<string, string>>> = {
    chest: {
        en: {
            chest_pain: "Do you have chest pain or pressure?",
            radiating_pain: "Does the pain spread to your arm, jaw, or back?",
            difficulty_breathing: "Are you having difficulty breathing?",
            sweating: "Are you sweating or feeling clammy?",
        },
        fr: {
            chest_pain: "Avez-vous des douleurs ou une pression dans la poitrine ?",
            radiating_pain: "La douleur irradie-t-elle vers le bras, la mâchoire ou le dos ?",
            difficulty_breathing: "Avez-vous du mal à respirer ?",
            sweating: "Transpirez-vous ou avez-vous des sueurs froides ?",
        },
        ar: {
            chest_pain: "هل تشعر بألم أو ضغط في الصدر؟",
            radiating_pain: "هل ينتشر الألم إلى ذراعك أو فكك أو ظهرك؟",
            difficulty_breathing: "هل تواجه صعوبة في التنفس؟",
            sweating: "هل تتعرق أو تشعر بالرطوبة الباردة؟",
        },
        pa: {
            chest_pain: "ਕੀ ਤੁਹਾਨੂੰ ਛਾਤੀ ਵਿੱਚ ਦਰਦ ਜਾਂ ਦਬਾਅ ਹੈ?",
            radiating_pain: "ਕੀ ਦਰਦ ਬਾਂਹ, ਜਬਾੜੇ ਜਾਂ ਪਿੱਠ ਵੱਲ ਫੈਲਦਾ ਹੈ?",
            difficulty_breathing: "ਕੀ ਤੁਹਾਨੂੰ ਸਾਹ ਲੈਣ ਵਿੱਚ ਮੁਸ਼ਕਲ ਹੈ?",
            sweating: "ਕੀ ਤੁਸੀਂ ਪਸੀਨਾ ਆਉਣਾ ਮਹਿਸੂਸ ਕਰ ਰਹੇ ਹੋ?",
        },
        zh: {
            chest_pain: "您有胸痛或胸部压迫感吗？",
            radiating_pain: "疼痛是否放射到手臂、下颌或背部？",
            difficulty_breathing: "您有呼吸困难吗？",
            sweating: "您有出汗或感觉潮湿吗？",
        },
        es: {
            chest_pain: "¿Tiene dolor o presión en el pecho?",
            radiating_pain: "¿El dolor se extiende al brazo, mandíbula o espalda?",
            difficulty_breathing: "¿Tiene dificultad para respirar?",
            sweating: "¿Está sudando o se siente húmedo y frío?",
        },
    },
    head: {
        en: {
            severe_headache: "Do you have a sudden or very severe headache?",
            vision_change: "Do you have blurred or double vision?",
            dizziness: "Do you feel dizzy or unsteady?",
            confusion: "Are you feeling confused or disoriented?",
        },
        fr: {
            severe_headache: "Avez-vous un mal de tête soudain ou très sévère ?",
            vision_change: "Avez-vous une vision floue ou double ?",
            dizziness: "Vous sentez-vous étourdi ou instable ?",
            confusion: "Vous sentez-vous confus ou désorienté ?",
        },
        ar: {
            severe_headache: "هل تعاني من صداع مفاجئ أو شديد جداً؟",
            vision_change: "هل تعاني من ضبابية في الرؤية أو رؤية مزدوجة؟",
            dizziness: "هل تشعر بدوار أو عدم توازن؟",
            confusion: "هل تشعر بالارتباك أو فقدان التوجه؟",
        },
        pa: {
            severe_headache: "ਕੀ ਤੁਹਾਨੂੰ ਅਚਾਨਕ ਜਾਂ ਬਹੁਤ ਜ਼ਿਆਦਾ ਸਿਰ ਦਰਦ ਹੈ?",
            vision_change: "ਕੀ ਤੁਹਾਡੀ ਨਜ਼ਰ ਧੁੰਦਲੀ ਜਾਂ ਦੋਹਰੀ ਹੋ ਗਈ ਹੈ?",
            dizziness: "ਕੀ ਤੁਸੀਂ ਚੱਕਰ ਆਉਣੇ ਮਹਿਸੂਸ ਕਰਦੇ ਹੋ?",
            confusion: "ਕੀ ਤੁਸੀਂ ਉਲਝਣ ਮਹਿਸੂਸ ਕਰ ਰਹੇ ਹੋ?",
        },
        zh: {
            severe_headache: "您有突然发作或非常剧烈的头痛吗？",
            vision_change: "您有视力模糊或复视吗？",
            dizziness: "您感到头晕或站立不稳吗？",
            confusion: "您感到意识混乱或方向感丧失吗？",
        },
        es: {
            severe_headache: "¿Tiene un dolor de cabeza repentino o muy severo?",
            vision_change: "¿Tiene visión borrosa o doble?",
            dizziness: "¿Se siente mareado o inestable?",
            confusion: "¿Se siente confundido o desorientado?",
        },
    },
    arm: {
        en: {
            arm_pain: "Do you have pain or swelling in your arm or shoulder?",
            numbness: "Do you have numbness or tingling in your arm or hand?",
            injury: "Did you injure or fall on your arm recently?",
            weakness: "Do you have weakness or inability to move your arm?",
        },
        fr: {
            arm_pain: "Avez-vous de la douleur ou un gonflement dans le bras ou l'épaule ?",
            numbness: "Avez-vous un engourdissement ou des picotements dans le bras ou la main ?",
            injury: "Vous êtes-vous blessé ou avez-vous fait une chute sur le bras récemment ?",
            weakness: "Avez-vous une faiblesse ou une incapacité à bouger le bras ?",
        },
        ar: {
            arm_pain: "هل تعاني من ألم أو تورم في ذراعك أو كتفك؟",
            numbness: "هل تشعر بتنميل أو وخز في ذراعك أو يدك؟",
            injury: "هل أصبت أو سقطت على ذراعك مؤخراً؟",
            weakness: "هل تعاني من ضعف أو عدم قدرة على تحريك ذراعك؟",
        },
        pa: {
            arm_pain: "ਕੀ ਤੁਹਾਡੀ ਬਾਂਹ ਜਾਂ ਮੋਢੇ ਵਿੱਚ ਦਰਦ ਜਾਂ ਸੋਜ ਹੈ?",
            numbness: "ਕੀ ਤੁਹਾਡੀ ਬਾਂਹ ਜਾਂ ਹੱਥ ਸੁੰਨ ਹੈ?",
            injury: "ਕੀ ਤੁਸੀਂ ਹਾਲ ਹੀ ਵਿੱਚ ਬਾਂਹ 'ਤੇ ਡਿੱਗੇ ਜਾਂ ਸੱਟ ਲੱਗੀ?",
            weakness: "ਕੀ ਤੁਹਾਡੀ ਬਾਂਹ ਕਮਜ਼ੋਰ ਹੈ ਜਾਂ ਹਿੱਲ ਨਹੀਂ ਰਹੀ?",
        },
        zh: {
            arm_pain: "您的手臂或肩膀有疼痛或肿胀吗？",
            numbness: "您的手臂或手有麻木或刺痛感吗？",
            injury: "您最近有跌倒或手臂受伤吗？",
            weakness: "您的手臂有无力感或无法移动吗？",
        },
        es: {
            arm_pain: "¿Tiene dolor o inflamación en el brazo o el hombro?",
            numbness: "¿Tiene entumecimiento u hormigueo en el brazo o la mano?",
            injury: "¿Se lesionó o cayó sobre el brazo recientemente?",
            weakness: "¿Tiene debilidad o incapacidad para mover el brazo?",
        },
    },
    leg: {
        en: {
            leg_pain: "Do you have pain or swelling in your leg, knee, or hip?",
            leg_injury: "Did you injure your leg, knee, or ankle recently?",
            leg_numbness: "Do you have numbness or weakness in your leg or foot?",
            cannot_walk: "Are you unable to walk or bear weight on your leg?",
        },
        fr: {
            leg_pain: "Avez-vous de la douleur ou un gonflement dans la jambe, le genou ou la hanche ?",
            leg_injury: "Vous êtes-vous blessé à la jambe, au genou ou à la cheville récemment ?",
            leg_numbness: "Avez-vous un engourdissement ou une faiblesse dans la jambe ou le pied ?",
            cannot_walk: "Êtes-vous incapable de marcher ou de mettre du poids sur la jambe ?",
        },
        ar: {
            leg_pain: "هل تعاني من ألم أو تورم في ساقك أو ركبتك أو وركك؟",
            leg_injury: "هل أصبت في ساقك أو ركبتك أو كاحلك مؤخراً؟",
            leg_numbness: "هل تشعر بتنميل أو ضعف في ساقك أو قدمك؟",
            cannot_walk: "هل أنت غير قادر على المشي أو تحمل وزنك على ساقك؟",
        },
        pa: {
            leg_pain: "ਕੀ ਤੁਹਾਡੀ ਲੱਤ, ਗੋਡੇ ਜਾਂ ਕਮਰ ਵਿੱਚ ਦਰਦ ਜਾਂ ਸੋਜ ਹੈ?",
            leg_injury: "ਕੀ ਤੁਸੀਂ ਹਾਲ ਹੀ ਵਿੱਚ ਲੱਤ, ਗੋਡੇ ਜਾਂ ਗਿੱਟੇ ਵਿੱਚ ਸੱਟ ਲਗਾਈ?",
            leg_numbness: "ਕੀ ਤੁਹਾਡੀ ਲੱਤ ਜਾਂ ਪੈਰ ਸੁੰਨ ਜਾਂ ਕਮਜ਼ੋਰ ਹੈ?",
            cannot_walk: "ਕੀ ਤੁਸੀਂ ਲੱਤ 'ਤੇ ਭਾਰ ਪਾ ਕੇ ਚੱਲ ਨਹੀਂ ਸਕਦੇ?",
        },
        zh: {
            leg_pain: "您的腿部、膝盖或髋部有疼痛或肿胀吗？",
            leg_injury: "您最近有腿、膝盖或脚踝受伤吗？",
            leg_numbness: "您的腿或脚有麻木或无力感吗？",
            cannot_walk: "您无法行走或腿部无法承重吗？",
        },
        es: {
            leg_pain: "¿Tiene dolor o inflamación en la pierna, rodilla o cadera?",
            leg_injury: "¿Se lesionó la pierna, rodilla o tobillo recientemente?",
            leg_numbness: "¿Tiene entumecimiento o debilidad en la pierna o el pie?",
            cannot_walk: "¿No puede caminar o cargar peso en la pierna?",
        },
    },
    abdomen: {
        en: {
            abdominal_pain: "Do you have stomach or abdominal pain?",
            vomiting: "Have you been vomiting?",
            pain_duration: "Has the pain lasted more than 6 hours?",
            fever: "Do you have a fever?",
        },
        fr: {
            abdominal_pain: "Avez-vous des douleurs d'estomac ou abdominales ?",
            vomiting: "Avez-vous vomi ?",
            pain_duration: "La douleur dure-t-elle depuis plus de 6 heures ?",
            fever: "Avez-vous de la fièvre ?",
        },
        ar: {
            abdominal_pain: "هل تعاني من آلام في المعدة أو البطن؟",
            vomiting: "هل كنت تتقيأ؟",
            pain_duration: "هل استمر الألم أكثر من 6 ساعات؟",
            fever: "هل لديك حمى؟",
        },
        pa: {
            abdominal_pain: "ਕੀ ਤੁਹਾਡੇ ਪੇਟ ਵਿੱਚ ਦਰਦ ਹੈ?",
            vomiting: "ਕੀ ਤੁਸੀਂ ਉਲਟੀਆਂ ਕੀਤੀਆਂ ਹਨ?",
            pain_duration: "ਕੀ ਦਰਦ 6 ਘੰਟਿਆਂ ਤੋਂ ਵੱਧ ਸਮੇਂ ਤੋਂ ਹੈ?",
            fever: "ਕੀ ਤੁਹਾਨੂੰ ਬੁਖਾਰ ਹੈ?",
        },
        zh: {
            abdominal_pain: "您有胃痛或腹痛吗？",
            vomiting: "您有呕吐吗？",
            pain_duration: "疼痛是否持续超过6小时？",
            fever: "您有发烧吗？",
        },
        es: {
            abdominal_pain: "¿Tiene dolor de estómago o abdominal?",
            vomiting: "¿Ha estado vomitando?",
            pain_duration: "¿El dolor ha durado más de 6 horas?",
            fever: "¿Tiene fiebre?",
        },
    },
    other: {
        en: {
            fainting: "Did you faint, pass out, or nearly pass out?",
            allergic_reaction: "Do you have a rash, hives, or swollen face?",
            fever_other: "Do you have a high fever (above 38.5°C / 101°F)?",
            general_weakness: "Are you feeling very weak or unusually tired?",
        },
        fr: {
            fainting: "Avez-vous perdu connaissance ou failli vous évanouir ?",
            allergic_reaction: "Avez-vous une éruption cutanée, de l'urticaire ou un visage gonflé ?",
            fever_other: "Avez-vous une forte fièvre (au-dessus de 38,5°C) ?",
            general_weakness: "Vous sentez-vous très faible ou inhabituellement fatigué ?",
        },
        ar: {
            fainting: "هل أغمي عليك أو كادت أن تفقد وعيك؟",
            allergic_reaction: "هل لديك طفح جلدي أو شرى أو تورم في الوجه؟",
            fever_other: "هل لديك حمى شديدة (فوق 38.5°م)؟",
            general_weakness: "هل تشعر بضعف شديد أو تعب غير عادي؟",
        },
        pa: {
            fainting: "ਕੀ ਤੁਸੀਂ ਬੇਹੋਸ਼ ਹੋਏ ਜਾਂ ਹੋਣ ਵਾਲੇ ਸੀ?",
            allergic_reaction: "ਕੀ ਤੁਹਾਡੇ ਚਿਹਰੇ 'ਤੇ ਧੱਫੜ ਜਾਂ ਸੋਜ ਹੈ?",
            fever_other: "ਕੀ ਤੁਹਾਨੂੰ ਉੱਚ ਬੁਖਾਰ (38.5°C ਤੋਂ ਵੱਧ) ਹੈ?",
            general_weakness: "ਕੀ ਤੁਸੀਂ ਬਹੁਤ ਕਮਜ਼ੋਰ ਜਾਂ ਥਕੇ ਮਹਿਸੂਸ ਕਰ ਰਹੇ ਹੋ?",
        },
        zh: {
            fainting: "您是否晕倒、失去意识或差点失去意识？",
            allergic_reaction: "您有皮疹、荨麻疹或面部肿胀吗？",
            fever_other: "您有高烧（超过38.5°C）吗？",
            general_weakness: "您感到非常虚弱或异常疲劳吗？",
        },
        es: {
            fainting: "¿Se desmayó, perdió el conocimiento o casi lo perdió?",
            allergic_reaction: "¿Tiene sarpullido, urticaria o cara hinchada?",
            fever_other: "¿Tiene fiebre alta (por encima de 38.5°C / 101°F)?",
            general_weakness: "¿Se siente muy débil o inusualmente cansado?",
        },
    },
}

// ── Shared Styles ───────────────────────────────────────────────
const btn = (bg: string, fg = "#fff", border = "none"): React.CSSProperties => ({
    background: bg, color: fg, border, borderRadius: 14, padding: "16px 20px",
    fontSize: 17, fontWeight: 600, cursor: "pointer", width: "100%",
    display: "flex", alignItems: "center", justifyContent: "center",
    gap: 8, transition: "opacity 0.15s",
})
const card: React.CSSProperties = {
    background: C.white, borderRadius: 20, padding: 24,
    border: `1px solid ${C.border}`,
    boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.04)",
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ── Logo ────────────────────────────────────────────────────────
function Logo() {
    return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <div style={{
                background: "linear-gradient(135deg,#2563EB,#1D4ED8)",
                borderRadius: 10, width: 34, height: 34,
                display: "flex", alignItems: "center", justifyContent: "center",
            }}>
                <span style={{ color: "#fff", fontSize: 20, fontWeight: 900, lineHeight: 1 }}>+</span>
            </div>
            <span style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.5 }}>
                <span style={{ color: C.blue }}>Fast</span>
                <span style={{ color: "#EF4444" }}>ER</span>
            </span>
        </div>
    )
}

// ── Progress ────────────────────────────────────────────────────
function ProgressBar({ step, total }: { step: number; total: number }) {
    return (
        <div style={{ marginBottom: 4 }}>
            <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 12, color: C.gray, marginBottom: 4 }}>
                {step} / {total}
            </div>
            <div style={{ height: 5, background: C.border, borderRadius: 99, overflow: "hidden" }}>
                <div style={{
                    height: "100%", width: `${(step / total) * 100}%`,
                    background: `linear-gradient(90deg,${C.blue},#60A5FA)`,
                    borderRadius: 99, transition: "width 0.4s ease",
                }} />
            </div>
        </div>
    )
}

// ── Spinner ─────────────────────────────────────────────────────
function Spinner() {
    return (
        <div style={{
            width: 32, height: 32, borderRadius: "50%",
            border: "3px solid rgba(148,163,184,0.3)", borderTopColor: "#60A5FA",
            animation: "spin 0.9s linear infinite",
        }}>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    )
}

// ── Human Silhouette SVG ────────────────────────────────────────
// Clickable regions mapped to body parts
function BodySilhouette({
    selected, onSelect, t,
}: {
    selected: string | null
    onSelect: (part: string) => void
    t: Record<string, string>
}) {
    const regions: Array<{
        id: string; label: string; desc?: string
        x: number; y: number; w: number; h: number
        shape?: "ellipse"
    }> = [
            { id: "head", label: t.head, x: 148, y: 12, w: 64, h: 68 },
            { id: "chest", label: t.chest, x: 120, y: 90, w: 120, h: 90 },
            { id: "abdomen", label: t.abdomen, x: 120, y: 185, w: 120, h: 80 },
            { id: "arm", label: t.arm, x: 58, y: 88, w: 54, h: 160 },
            { id: "arm", label: t.arm, x: 248, y: 88, w: 54, h: 160, },
            { id: "leg", label: t.leg, x: 110, y: 270, w: 60, h: 160 },
            { id: "leg", label: t.leg, x: 190, y: 270, w: 60, h: 160 },
        ]

    // deduplicate for label rendering
    const uniqueIds = ["head", "chest", "abdomen", "arm", "leg"]

    return (
        <div style={{ position: "relative", display: "inline-block" }}>
            <svg viewBox="0 0 360 450" width={280} height={350}
                style={{ display: "block", margin: "0 auto" }}>

                {/* Silhouette shape */}
                <g fill="#E2E8F0" stroke="none">
                    {/* head */}
                    <ellipse cx={180} cy={46} rx={34} ry={38} />
                    {/* neck */}
                    <rect x={165} y={80} width={30} height={20} rx={6} />
                    {/* torso */}
                    <rect x={122} y={96} width={116} height={168} rx={16} />
                    {/* left arm */}
                    <rect x={60} y={96} width={56} height={150} rx={14} />
                    {/* right arm */}
                    <rect x={244} y={96} width={56} height={150} rx={14} />
                    {/* left leg */}
                    <rect x={118} y={258} width={58} height={172} rx={14} />
                    {/* right leg */}
                    <rect x={184} y={258} width={58} height={172} rx={14} />
                </g>

                {/* Clickable hot-zones (invisible, on top) */}
                {regions.map((r, i) => {
                    const isSelected = selected === r.id
                    return (
                        <rect
                            key={`${r.id}-${i}`}
                            x={r.x} y={r.y} width={r.w} height={r.h}
                            rx={12}
                            fill={isSelected ? "rgba(37,99,235,0.35)" : "rgba(37,99,235,0)"}
                            stroke={isSelected ? C.blue : "transparent"}
                            strokeWidth={2}
                            style={{ cursor: "pointer", transition: "fill 0.15s" }}
                            onClick={() => onSelect(r.id)}
                            onMouseEnter={e => {
                                if (!isSelected) (e.target as SVGElement).style.fill = "rgba(37,99,235,0.15)"
                            }}
                            onMouseLeave={e => {
                                if (!isSelected) (e.target as SVGElement).style.fill = "rgba(37,99,235,0)"
                            }}
                        />
                    )
                })}

                {/* Labels inside body */}
                {uniqueIds.map(id => {
                    const isSelected = selected === id
                    const centres: Record<string, [number, number]> = {
                        head: [180, 46], chest: [180, 140], abdomen: [180, 225],
                        arm: [88, 170], leg: [150, 345],
                    }
                    const [cx, cy] = centres[id]
                    return (
                        <text key={id} x={cx} y={cy + 4}
                            textAnchor="middle" fontSize={10} fontWeight={isSelected ? 700 : 500}
                            fill={isSelected ? C.blue : "#64748B"}
                            style={{ pointerEvents: "none", userSelect: "none" }}>
                            {t[id] ? t[id].split(" ")[0] : id}
                        </text>
                    )
                })}
            </svg>

            {/* "Other" button below */}
            <div style={{ marginTop: 10, textAlign: "center" }}>
                <button
                    onClick={() => onSelect("other")}
                    style={{
                        ...btn(selected === "other" ? C.blue : C.lightGray,
                            selected === "other" ? "#fff" : C.slateLight,
                            `1px solid ${selected === "other" ? C.blue : C.border}`),
                        width: 240, fontSize: 14, padding: "10px 16px",
                        display: "inline-flex",
                    }}
                >
                    {t.other}
                    {t.otherDesc && (
                        <span style={{ fontSize: 11, color: selected === "other" ? "rgba(255,255,255,0.75)" : C.gray, marginLeft: 4 }}>
                            {t.otherDesc}
                        </span>
                    )}
                </button>
            </div>
        </div>
    )
}

// ── Pi Camera Stream (for card scan, uses /camera-frame) ────────
function PiCardCamera({
    onCapture, scanning, t,
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

    useEffect(() => {
        if (scanning) return
        let cancelled = false

        const loop = async () => {
            while (!cancelled) {
                try {
                    const res = await fetch(`${PI_SERVER}/camera-frame?ts=${Date.now()}`, { cache: "no-store" })
                    if (!res.ok) throw new Error(res.headers.get("X-Camera-Error") || `Camera error ${res.status}`)
                    const buf = await res.arrayBuffer()
                    const blob = new Blob([buf], { type: "image/jpeg" })
                    const url = URL.createObjectURL(blob)
                    const bytes = new Uint8Array(buf)
                    let bin = ""; for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i])
                    const b64 = btoa(bin)
                    if (frameUrlRef.current) URL.revokeObjectURL(frameUrlRef.current)
                    frameUrlRef.current = url; frameB64Ref.current = b64
                    setFrameUrl(url); setReady(true); setCamErr(null)
                } catch (e) {
                    const msg = e instanceof Error ? e.message : "Camera unavailable"
                    if (cancelled) break
                    setReady(false); setCamErr(msg); setFrameUrl(null)
                    await sleep(500); continue
                }
                await sleep(220)
            }
        }

        void loop()
        return () => {
            cancelled = true
            if (frameUrlRef.current) URL.revokeObjectURL(frameUrlRef.current)
        }
    }, [attempt, scanning])

    const capture = () => {
        const b64 = frameB64Ref.current
        if (!b64 || !ready || scanning) return
        onCapture(b64)
    }

    return (
        <div>
            <p style={{ fontSize: 13, color: C.gray, textAlign: "center", marginBottom: 10 }}>{t.positionCard}</p>
            <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "#0F172A", height: 220, marginBottom: 10 }}>
                {camErr ? (
                    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        <span style={{ color: "#CBD5E1", fontSize: 15, fontWeight: 600 }}>{t.cameraUnavailable}</span>
                        <span style={{ color: "#64748B", fontSize: 12 }}>{camErr}</span>
                    </div>
                ) : (
                    <>
                        {frameUrl && <img src={frameUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: ready ? 1 : 0.2, transition: "opacity 0.3s" }} />}
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                            <div style={{ width: "78%", height: "55%", border: "2px dashed rgba(255,255,255,0.55)", borderRadius: 10, boxShadow: "0 0 0 9999px rgba(0,0,0,0.25)" }} />
                        </div>
                        {!ready && <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}><Spinner /><span style={{ color: "#94A3B8", fontSize: 13 }}>{t.connecting}</span></div>}
                    </>
                )}
            </div>
            <p style={{ fontSize: 11, color: C.gray, textAlign: "center", margin: "0 0 10px" }}>{t.cardNote}</p>
            <div style={{ display: "flex", gap: 8 }}>
                <button onClick={capture} disabled={scanning || !ready || !!camErr}
                    style={btn(scanning || !ready || !!camErr ? C.border : C.blue, scanning || !ready || !!camErr ? C.gray : "#fff")}>
                    {scanning ? t.scanning : t.scanBtn}
                </button>
                <button onClick={() => setAttempt(a => a + 1)} disabled={scanning}
                    style={{ ...btn("transparent", C.slateLight, `1px solid ${C.border}`), width: 120, flexShrink: 0 }}>
                    {t.refresh}
                </button>
            </div>
        </div>
    )
}

// ── Browser Camera (for card scan, app mode) ────────────────────
function BrowserCardCamera({
    onCapture, scanning, t,
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
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
            .then(stream => {
                if (!active) { stream.getTracks().forEach(t => t.stop()); return }
                streamRef.current = stream
                if (videoRef.current) { videoRef.current.srcObject = stream; void videoRef.current.play() }
                setReady(true)
            })
            .catch(() => { if (active) setCamErr("Camera permission blocked or unavailable.") })
        return () => { active = false; streamRef.current?.getTracks().forEach(t => t.stop()) }
    }, [])

    const capture = () => {
        if (!videoRef.current || scanning) return
        const canvas = document.createElement("canvas")
        canvas.width = videoRef.current.videoWidth || 640
        canvas.height = videoRef.current.videoHeight || 480
        canvas.getContext("2d")!.drawImage(videoRef.current, 0, 0)
        onCapture(canvas.toDataURL("image/jpeg", 0.85).split(",")[1])
    }

    return (
        <div>
            <p style={{ fontSize: 13, color: C.gray, textAlign: "center", marginBottom: 10 }}>{t.positionCard}</p>
            <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "#0F172A", height: 220, marginBottom: 10 }}>
                {camErr ? (
                    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        <span style={{ color: "#CBD5E1", fontSize: 15, fontWeight: 600 }}>{t.cameraUnavailable}</span>
                        <span style={{ color: "#64748B", fontSize: 12 }}>{camErr}</span>
                    </div>
                ) : (
                    <>
                        <video ref={videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", opacity: ready ? 1 : 0.2, transition: "opacity 0.4s" }} />
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                            <div style={{ width: "78%", height: "55%", border: "2px dashed rgba(255,255,255,0.55)", borderRadius: 10, boxShadow: "0 0 0 9999px rgba(0,0,0,0.25)" }} />
                        </div>
                        {!ready && <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}><Spinner /><span style={{ color: "#94A3B8", fontSize: 13 }}>{t.connecting}</span></div>}
                    </>
                )}
            </div>
            <button onClick={capture} disabled={scanning || !ready || !!camErr}
                style={btn(scanning || !ready || !!camErr ? C.border : C.blue, scanning || !ready || !!camErr ? C.gray : "#fff")}>
                {scanning ? t.scanning : t.scanBtn}
            </button>
        </div>
    )
}

// ── Main App ────────────────────────────────────────────────────
type Step = "language" | "camera" | "age" | "card" | "body" | "questions" | "complete"
type AgeGroup = "Child" | "Adult" | "Senior"
type CameraMode = "pi" | "app"

export default function KioskApp() {
    const [step, setStep] = useState<Step>("language")
    const [lang, setLang] = useState("en")
    const [cameraMode, setCameraMode] = useState<CameraMode>("pi")
    const [ageGroup, setAgeGroup] = useState<AgeGroup | null>(null)
    const [cardMode, setCardMode] = useState<"scan" | "manual">("scan")
    const [scanningCard, setScanCard] = useState(false)
    const [manualName, setManualName] = useState("")
    const [manualId, setManualId] = useState("")
    const [patientName, setPatientName] = useState("")
    const [healthId, setHealthId] = useState("")
    const [bodyPart, setBodyPart] = useState<string | null>(null)
    const [questions, setQuestions] = useState<Array<{ id: string; text: string }>>([])
    const [qIndex, setQIndex] = useState(0)
    const [answers, setAnswers] = useState<Record<string, boolean>>({})
    const [submitting, setSubmitting] = useState(false)
    // Pi legacy age scan
    const [piAgeScanning, setPiAgeScanning] = useState(false)
    const [piAgeMsg, setPiAgeMsg] = useState("")

    const t = { ...(T.en || {}), ...(T[lang] || {}) }
    const isRTL = LANGUAGES.find(l => l.code === lang)?.dir === "rtl"
    const fs = ageGroup === "Senior" ? 1.15 : 1

    // Auto-advance after age detected
    useEffect(() => {
        if (ageGroup && step === "age") setTimeout(() => setStep("card"), 700)
    }, [ageGroup])

    // Speak a string via Flask /speak
    const speak = async (text: string) => {
        try {
            await fetch(`${AI_SERVER}/speak`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text, lang }),
            })
        } catch { }
    }

    // Pi legacy age window
    const triggerPiAgeScan = async () => {
        setPiAgeScanning(true)
        setPiAgeMsg(t.analyzing || "Analyzing...")
        try {
            const res = await fetch(`${PI_SERVER}/scan-age`, { method: "POST" })
            const d = await res.json()
            if (d.success && d.age_group) {
                setAgeGroup(d.age_group as AgeGroup)
            } else {
                setPiAgeMsg(d.message || "Could not detect age — please choose manually.")
            }
        } catch {
            setPiAgeMsg("Pi camera unavailable — please choose manually.")
        }
        setPiAgeScanning(false)
    }

    // Health card captured → Gemini OCR
    const handleCardCapture = async (b64: string) => {
        setScanCard(true)
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
        setScanCard(false)
        setStep("body")
    }

    // Body part selected → fetch CTAS questions
    const handleBodySelect = async (part: string) => {
        setBodyPart(part)
        // Use client-side questions (already loaded in TRIAGE_Q)
        const qMap = TRIAGE_Q[part]?.[lang] || TRIAGE_Q[part]?.["en"] || {}
        const qArr = Object.entries(qMap).map(([id, text]) => ({ id, text }))
        setQuestions(qArr)
        setAnswers({})
        setQIndex(0)
        setStep("questions")
        if (qArr.length > 0) speak(qArr[0].text)
    }

    // Yes/No answer handler
    const handleAnswer = async (id: string, val: boolean) => {
        const newAnswers = { ...answers, [id]: val }
        setAnswers(newAnswers)

        if (qIndex < questions.length - 1) {
            const next = questions[qIndex + 1]
            setTimeout(() => { setQIndex(i => i + 1); speak(next.text) }, 250)
        } else {
            // All questions answered → POST to Flask /queue
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
                        body_part: bodyPart || "other",
                        answers: newAnswers,
                    }),
                })
            } catch { }
            setSubmitting(false)
            setStep("complete")
        }
    }

    // Reset for next patient
    const reset = () => {
        setStep("language"); setLang("en"); setCameraMode("pi"); setAgeGroup(null)
        setManualName(""); setManualId(""); setPatientName(""); setHealthId("")
        setBodyPart(null); setQuestions([]); setQIndex(0); setAnswers({})
        setCardMode("scan"); setScanCard(false); setSubmitting(false)
        setPiAgeScanning(false); setPiAgeMsg("")
    }

    // ─────────────── RENDER ────────────────────────────────────────

    // 1. Language
    if (step === "language") return (
        <Screen rtl={isRTL}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
                <Logo />
                <h1 style={{ fontSize: 24, fontWeight: 700, color: C.slate, margin: "18px 0 6px" }}>{T.en.welcome}</h1>
                <p style={{ color: C.gray, fontSize: 15 }}>{T.en.selectLang}</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {LANGUAGES.map(l => (
                    <button key={l.code}
                        onClick={() => { setLang(l.code); setStep("camera") }}
                        style={{
                            background: C.white, border: `2px solid ${C.border}`, borderRadius: 14,
                            padding: "18px 8px", cursor: "pointer", textAlign: "center",
                            transition: "all 0.15s", display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                        }}
                        onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = C.blue; el.style.background = C.blueLight }}
                        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = C.border; el.style.background = C.white }}>
                        <span style={{ fontSize: 20, fontWeight: 700, color: C.slate }}>{l.region}</span>
                        <span style={{ fontSize: 12, color: C.gray }}>{l.label}</span>
                    </button>
                ))}
            </div>
        </Screen>
    )

    // 2. Camera mode
    if (step === "camera") return (
        <Screen rtl={isRTL}>
            <div style={{ ...card, textAlign: "center", marginBottom: 16 }}>
                <h2 style={{ fontSize: 22 * fs, fontWeight: 700, color: C.slate, margin: "0 0 8px" }}>{t.cameraMode}</h2>
                <p style={{ color: C.gray, fontSize: 14 }}>{t.cameraModeDesc}</p>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
                {(["pi", "app"] as const).map(mode => (
                    <button key={mode}
                        onClick={() => { setCameraMode(mode); setStep("age") }}
                        style={{ ...card, textAlign: "left", cursor: "pointer", border: `2px solid ${mode === "pi" ? C.blue : C.border}`, background: mode === "pi" ? C.blueLight : C.white }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: C.slate, marginBottom: 4 }}>
                            {mode === "pi" ? t.piCam : t.appCam}
                        </div>
                        <div style={{ fontSize: 13, color: C.gray }}>
                            {mode === "pi" ? "Uses Raspberry Pi camera for age detection and health card scanning." : "Uses this device browser camera for health card only. Age chosen manually."}
                        </div>
                    </button>
                ))}
            </div>
        </Screen>
    )

    // 3. Age detection
    if (step === "age") return (
        <Screen rtl={isRTL}>
            {cameraMode === "pi" && !ageGroup && (
                <div style={{ ...card, textAlign: "center", marginBottom: 16 }}>
                    <p style={{ color: C.gray, fontSize: 15 * fs, marginBottom: 16 }}>{t.detectingAge}</p>
                    {piAgeMsg && <p style={{ color: piAgeMsg.includes("unavailable") ? C.red : C.gray, fontSize: 13, marginBottom: 12 }}>{piAgeMsg}</p>}
                    <button onClick={triggerPiAgeScan} disabled={piAgeScanning}
                        style={btn(piAgeScanning ? C.border : "#16A34A", piAgeScanning ? C.gray : "#fff")}>
                        {piAgeScanning ? t.analyzing : t.openPiCam}
                    </button>
                </div>
            )}
            {ageGroup && (
                <div style={{ ...card, textAlign: "center", marginBottom: 16 }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: C.green }}>✓ {ageGroup}</div>
                </div>
            )}
            <div style={{ ...card }}>
                <p style={{ textAlign: "center", color: C.gray, marginBottom: 14, fontSize: 14 }}>{t.orSelectAge}</p>
                <div style={{ display: "flex", gap: 10 }}>
                    {(["Child", "Adult", "Senior"] as const).map(g => (
                        <button key={g} onClick={() => setAgeGroup(g)} style={{
                            flex: 1,
                            background: ageGroup === g ? C.blueLight : C.lightGray,
                            border: `2px solid ${ageGroup === g ? C.blue : C.border}`,
                            borderRadius: 12, padding: "14px 6px", cursor: "pointer",
                            display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                        }}>
                            <span style={{ fontSize: 22 }}>{g === "Child" ? "🧒" : g === "Adult" ? "🧑" : "👴"}</span>
                            <span style={{ fontSize: 12 * fs, fontWeight: 600, color: C.slateLight, textAlign: "center" }}>{t[g.toLowerCase() as keyof typeof t]}</span>
                        </button>
                    ))}
                </div>
                <button onClick={() => setStep("camera")} style={{ ...btn("transparent", C.gray, `1px solid ${C.border}`), marginTop: 12, fontSize: 14 }}>
                    {t.changeCamMode}
                </button>
            </div>
        </Screen>
    )

    // 4. Health card scan
    if (step === "card") return (
        <Screen rtl={isRTL}>
            <h2 style={{ fontSize: 20 * fs, fontWeight: 700, color: C.slate, textAlign: "center", marginBottom: 16 }}>{t.scanCard}</h2>
            {cardMode === "scan" ? (
                <div style={{ ...card, marginBottom: 12 }}>
                    {cameraMode === "pi"
                        ? <PiCardCamera onCapture={handleCardCapture} scanning={scanningCard} t={t} />
                        : <BrowserCardCamera onCapture={handleCardCapture} scanning={scanningCard} t={t} />}
                    <button onClick={() => setCardMode("manual")} style={{ ...btn("transparent", C.gray, `1px solid ${C.border}`), marginTop: 10, fontSize: 14 }}>
                        {t.enterManual}
                    </button>
                </div>
            ) : (
                <div style={{ ...card, display: "flex", flexDirection: "column", gap: 14 }}>
                    {[{ label: t.name, val: manualName, set: setManualName }, { label: t.healthId, val: manualId, set: setManualId }].map(({ label, val, set }) => (
                        <div key={label}>
                            <label style={{ fontSize: 13, fontWeight: 600, color: C.slateLight, display: "block", marginBottom: 5 }}>{label}</label>
                            <input value={val} onChange={e => set(e.target.value)}
                                style={{ width: "100%", padding: "13px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 16 * fs, boxSizing: "border-box", outline: "none" }} />
                        </div>
                    ))}
                    <button onClick={() => setStep("body")} disabled={!manualName || !manualId}
                        style={btn(manualName && manualId ? C.blue : C.border)}>
                        {t.confirm}
                    </button>
                    <button onClick={() => setCardMode("scan")} style={{ ...btn("transparent", C.gray, `1px solid ${C.border}`), fontSize: 14 }}>
                        {t.backToScan}
                    </button>
                </div>
            )}
        </Screen>
    )

    // 5. Body region selection (human silhouette)
    if (step === "body") return (
        <Screen rtl={isRTL}>
            <div style={{ ...card, marginBottom: 16 }}>
                <h2 style={{ fontSize: 22 * fs, fontWeight: 700, color: C.slate, textAlign: "center", margin: "0 0 6px" }}>
                    {t.whereHurts}
                </h2>
                <p style={{ color: C.gray, fontSize: 14, textAlign: "center", margin: "0 0 20px" }}>{t.whereHurtsDesc}</p>
                <div style={{ display: "flex", justifyContent: "center" }}>
                    <BodySilhouette selected={bodyPart} onSelect={setBodyPart} t={t} />
                </div>
                {bodyPart && (
                    <button
                        onClick={() => handleBodySelect(bodyPart)}
                        style={{ ...btn(C.blue), marginTop: 20 }}
                    >
                        Continue →
                    </button>
                )}
            </div>
        </Screen>
    )

    // 6. Triage questions
    if (step === "questions" && questions.length > 0) {
        const q = questions[qIndex]
        return (
            <Screen rtl={isRTL}>
                <ProgressBar step={qIndex + 1} total={questions.length} />
                <div style={{ ...card, marginTop: 14 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 28 }}>
                        <button onClick={() => speak(q.text)}
                            style={{ background: C.blue, border: "none", borderRadius: 50, minWidth: 46, height: 46, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}
                            title="Hear question aloud">
                            {t.play}
                        </button>
                        <p style={{ fontSize: 22 * fs, fontWeight: 600, color: C.slate, lineHeight: 1.4, margin: 0 }}>
                            {q.text}
                        </p>
                    </div>
                    <div style={{ display: "flex", gap: 14 }}>
                        <button onClick={() => handleAnswer(q.id, true)} disabled={submitting}
                            style={{ ...btn(C.blue), flex: 1, fontSize: 20 * fs, padding: "20px", opacity: submitting ? 0.6 : 1 }}>
                            👍 {t.yes}
                        </button>
                        <button onClick={() => handleAnswer(q.id, false)} disabled={submitting}
                            style={{ ...btn("#334155"), flex: 1, fontSize: 20 * fs, padding: "20px", opacity: submitting ? 0.6 : 1 }}>
                            👎 {t.no}
                        </button>
                    </div>
                </div>
            </Screen>
        )
    }

    // 7. Complete
    if (step === "complete") return (
        <Screen rtl={isRTL}>
            <div style={{ ...card, textAlign: "center", padding: 48 }}>
                <div style={{ fontSize: 72, marginBottom: 18 }}>✅</div>
                <h2 style={{ fontSize: 26 * fs, fontWeight: 700, color: C.slate, margin: "0 0 12px" }}>{t.complete}</h2>
                {/* Priority intentionally NOT shown to patient */}
                <p style={{ fontSize: 17 * fs, color: C.gray, lineHeight: 1.6, maxWidth: 320, margin: "0 auto 32px" }}>{t.seated}</p>
                <button onClick={reset} style={btn(C.lightGray, C.slateLight, `1px solid ${C.border}`)}>{t.newCheckin}</button>
            </div>
        </Screen>
    )

    return null
}

function Screen({ children, rtl }: { children: React.ReactNode; rtl?: boolean }) {
    return (
        <div style={{
            minHeight: "100vh", background: "#F8FAFC",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            padding: 20, direction: rtl ? "rtl" : "ltr",
            fontFamily: "'Segoe UI', system-ui, sans-serif",
        }}>
            <div style={{ width: "100%", maxWidth: 500 }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
                    <Logo />
                </div>
                {children}
            </div>
        </div>
    )
}