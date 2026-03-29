"use client"
import { useState, useEffect, useRef } from "react"

// PI_SERVER  = Raspberry Pi FastAPI (port 8000) — /scan-age ONLY (runs on the Pi hardware)
// AI_SERVER  = Flask AI server  (port 5001) — /speak, /scan-card, /queue, /score-priority
const PI_SERVER = process.env.NEXT_PUBLIC_PI_SERVER || "http://localhost:8000"
const AI_SERVER = process.env.NEXT_PUBLIC_AI_SERVER || "http://localhost:5001"

// ── Brand Colors ───────────────────────────────────────────────
const C = {
    blue: "#2563EB", blueDark: "#1D4ED8", blueLight: "#EFF6FF",
    pink: "#EC4899", pinkDark: "#DB2777", pinkLight: "#FCE7F3",
    sky: "#38BDF8", skyDark: "#0284C7", skyLight: "#E0F2FE",
    slate: "#334155", gray: "#64748B", lightGray: "#F1F5F9",
    border: "#E2E8F0", white: "#FFFFFF", red: "#EF4444", green: "#22C55E",
    kidBorder: "#F9A8D4",
}

// ── Languages ──────────────────────────────────────────────────
const LANGUAGES = [
    { code: "en", label: "English", region: "CA", dir: "ltr" },
    { code: "fr", label: "Français", region: "FR", dir: "ltr" },
    { code: "ar", label: "العربية", region: "SA", dir: "rtl" },
    { code: "pa", label: "ਪੰਜਾਬੀ", region: "IN", dir: "ltr" },
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

const EXTRA_T: Record<string, Record<string, string>> = {
    en: {
        connectingPiCamera: "Connecting to Pi camera...",
        openingPiCameraWindow: "Opening Pi camera window...",
        analyzingAge: "Analyzing age...",
        ageUnclearRetry: "Face seen, but age read was unclear. Try again.",
        ageCouldNotDetect: "Could not detect age. Please choose manually or retry.",
        ageScanFailed: "Age scan failed. Please choose manually or retry.",
        scanFailedStatus: "Scan failed ({status})",
        tapGreenButton: "Tap the green button to open the Raspberry Pi camera window.",
        placeFaceGuide: "Place your face inside the highlighted area.",
        moveFaceGuide: "Move your face into the highlighted area.",
        holdFaceBox: "Hold your face in the box...",
        holdStillAuto: "Face aligned. Hold still for auto scan...",
        capturingAuto: "Face aligned. Capturing automatically...",
        piWindowTitle: "Raspberry Pi Camera Window",
        piWindowDesc: "This opens the fullscreen Pi camera screen on the Raspberry Pi, scans there, and sends the age result back into this app.",
        openPiWindowButton: "Open Pi Camera Window",
        legacyPiNote: "This uses the legacy Raspberry Pi/OpenCV scan instead of the in-app preview.",
        cameraUnavailable: "Camera unavailable",
        usePiCameraWindow: "Use Pi Camera Window",
        retryCamera: "Retry Camera",
        faceInPosition: "Face in position",
        placeFaceInsideArea: "Place face inside area",
        photoAutoTip: "Photo captures automatically as soon as your face hits the green box.",
        previewAgeOnly: "Preview frames are temporary. This step saves only the age result, not a photo.",
        refresh: "Refresh",
        cardGuideReady: "Position your card inside the guide.",
        cameraRefreshHelp: "Refresh the page or reconnect the camera.",
        cardPreviewSent: "Preview frames are temporary. A card image is sent only when you tap Scan.",
        cameraNotReady: "Camera not ready yet",
        browserCameraBlocked: "Browser camera permission was blocked or unavailable.",
        startingAppCamera: "Starting app camera...",
        browserCameraModeNote: "This mode uses the browser camera on the current device.",
        cameraModeTitle: "Choose Camera Mode",
        cameraModeDesc: "Pick how you want to scan. Pi camera uses the Raspberry Pi fullscreen age scanner first, while app camera keeps everything on this device with manual age selection.",
        piCameraTitle: "Pi Camera",
        piCameraDesc: "Use the green Pi-camera button for age scanning in the fullscreen Raspberry Pi window. The health card step later still uses the Pi camera preview inside the app.",
        appCameraTitle: "App Camera",
        appCameraDesc: "Use this device browser camera for the health card step. Age will be chosen manually instead of auto-detected.",
        appManualAgeMode: "App camera mode uses manual age selection.",
        launchPiWindowPrompt: "Use the green button below to launch the Pi camera window",
        nextScreenAppCamera: "The next screen will use the app camera for health card scanning",
        appNoAutoAge: "App camera mode does not auto-detect age yet.",
        appChooseAgeDesc: "Choose the age group below, then the health card screen will use this device browser camera.",
        changeCameraMode: "Change Camera Mode",
        healthCardPiMode: "Health card scan is using the Raspberry Pi camera preview inside the app.",
        healthCardAppMode: "Health card scan is using this device browser camera.",
        backToCamera: "Back to camera",
        play: "Play",
        playQuestionTitle: "Hear question aloud",
        startNewCheckin: "Start New Check-in",
        ageDetected: "{age} detected",
        back: "Back",
        whereHurts: "Where does it hurt?",
        whereHurtsDesc: "Tap the area on the body that needs attention before the questions start.",
        chest: "Chest",
        head: "Head / Face",
        arm: "Arm / Shoulder",
        leg: "Leg / Knee / Hip",
        abdomen: "Abdomen",
        other: "Other / General",
        otherDesc: "(Vomiting, fainting, fever, rash...)",
        continueToQuestions: "Continue",
    },
    fr: {
        connectingPiCamera: "Connexion a la camera Pi...",
        openingPiCameraWindow: "Ouverture de la fenetre camera Pi...",
        analyzingAge: "Analyse de l'age...",
        ageUnclearRetry: "Un visage a ete detecte, mais l'age n'est pas clair. Reessayez.",
        ageCouldNotDetect: "Impossible de detecter l'age. Veuillez choisir manuellement ou reessayer.",
        ageScanFailed: "L'analyse de l'age a echoue. Veuillez choisir manuellement ou reessayer.",
        scanFailedStatus: "Echec de l'analyse ({status})",
        tapGreenButton: "Appuyez sur le bouton vert pour ouvrir la fenetre de la camera Raspberry Pi.",
        placeFaceGuide: "Placez votre visage dans la zone mise en evidence.",
        moveFaceGuide: "Deplacez votre visage dans la zone mise en evidence.",
        holdFaceBox: "Gardez votre visage dans le cadre...",
        holdStillAuto: "Visage bien aligne. Ne bougez pas pour le scan automatique...",
        capturingAuto: "Visage aligne. Capture automatique...",
        piWindowTitle: "Fenetre de camera Raspberry Pi",
        piWindowDesc: "Cette option ouvre l'ecran camera plein ecran sur le Raspberry Pi, effectue le scan et renvoie le resultat d'age dans cette application.",
        openPiWindowButton: "Ouvrir la camera Pi",
        legacyPiNote: "Cette option utilise l'ancien scan Raspberry Pi/OpenCV au lieu de l'apercu integre.",
        cameraUnavailable: "Camera indisponible",
        usePiCameraWindow: "Utiliser la fenetre camera Pi",
        retryCamera: "Reessayer la camera",
        faceInPosition: "Visage en position",
        placeFaceInsideArea: "Placez le visage dans la zone",
        photoAutoTip: "La photo se capture automatiquement des que votre visage entre dans la zone verte.",
        previewAgeOnly: "Les apercus sont temporaires. Cette etape n'enregistre que le resultat d'age, pas de photo.",
        refresh: "Actualiser",
        cardGuideReady: "Placez votre carte dans le guide.",
        cameraRefreshHelp: "Actualisez la page ou reconnectez la camera.",
        cardPreviewSent: "Les apercus sont temporaires. Une image de la carte n'est envoyee que lorsque vous appuyez sur Scanner.",
        cameraNotReady: "La camera n'est pas encore prete",
        browserCameraBlocked: "L'autorisation de la camera du navigateur a ete refusee ou la camera est indisponible.",
        startingAppCamera: "Demarrage de la camera de l'application...",
        browserCameraModeNote: "Ce mode utilise la camera du navigateur sur cet appareil.",
        cameraModeTitle: "Choisir le mode camera",
        cameraModeDesc: "Choisissez comment vous voulez scanner. La camera Pi utilise d'abord le scanner d'age plein ecran du Raspberry Pi, tandis que la camera de l'application garde tout sur cet appareil avec une selection manuelle de l'age.",
        piCameraTitle: "Camera Pi",
        piCameraDesc: "Utilisez le bouton vert de la camera Pi pour le scan d'age dans la fenetre plein ecran du Raspberry Pi. L'etape de la carte sante utilise ensuite l'apercu camera Pi dans l'application.",
        appCameraTitle: "Camera de l'application",
        appCameraDesc: "Utilisez la camera du navigateur de cet appareil pour la carte sante. L'age sera choisi manuellement au lieu d'etre detecte automatiquement.",
        appManualAgeMode: "Le mode camera de l'application utilise la selection manuelle de l'age.",
        launchPiWindowPrompt: "Utilisez le bouton vert ci-dessous pour lancer la fenetre camera Pi",
        nextScreenAppCamera: "L'ecran suivant utilisera la camera de l'application pour scanner la carte sante",
        appNoAutoAge: "Le mode camera de l'application ne detecte pas encore automatiquement l'age.",
        appChooseAgeDesc: "Choisissez le groupe d'age ci-dessous, puis l'ecran de la carte sante utilisera la camera du navigateur de cet appareil.",
        changeCameraMode: "Changer de mode camera",
        healthCardPiMode: "Le scan de la carte sante utilise l'apercu camera Raspberry Pi dans l'application.",
        healthCardAppMode: "Le scan de la carte sante utilise la camera du navigateur de cet appareil.",
        backToCamera: "Retour a la camera",
        play: "Lire",
        playQuestionTitle: "Lire la question",
        startNewCheckin: "Commencer un nouvel enregistrement",
        ageDetected: "{age} detecte",
        back: "Retour",
    },
    ar: {
        connectingPiCamera: "جار الاتصال بكاميرا Pi...",
        openingPiCameraWindow: "جار فتح نافذة كاميرا Pi...",
        analyzingAge: "جار تحليل العمر...",
        ageUnclearRetry: "تم اكتشاف وجه، لكن قراءة العمر غير واضحة. حاول مرة أخرى.",
        ageCouldNotDetect: "تعذر اكتشاف العمر. يرجى الاختيار يدويا أو المحاولة مرة أخرى.",
        ageScanFailed: "فشل فحص العمر. يرجى الاختيار يدويا أو المحاولة مرة أخرى.",
        scanFailedStatus: "فشل الفحص ({status})",
        tapGreenButton: "اضغط الزر الأخضر لفتح نافذة كاميرا Raspberry Pi.",
        placeFaceGuide: "ضع وجهك داخل المنطقة المظللة.",
        moveFaceGuide: "حرك وجهك إلى داخل المنطقة المظللة.",
        holdFaceBox: "أبق وجهك داخل الإطار...",
        holdStillAuto: "تمت محاذاة الوجه. ابق ثابتا للفحص التلقائي...",
        capturingAuto: "تمت محاذاة الوجه. جار الالتقاط تلقائيا...",
        piWindowTitle: "نافذة كاميرا Raspberry Pi",
        piWindowDesc: "سيؤدي هذا إلى فتح شاشة كاميرا Raspberry Pi بملء الشاشة، وإجراء الفحص هناك، ثم إعادة نتيجة العمر إلى هذا التطبيق.",
        openPiWindowButton: "افتح نافذة كاميرا Pi",
        legacyPiNote: "يستخدم هذا وضع فحص Raspberry Pi/OpenCV القديم بدلا من المعاينة داخل التطبيق.",
        cameraUnavailable: "الكاميرا غير متاحة",
        usePiCameraWindow: "استخدم نافذة كاميرا Pi",
        retryCamera: "إعادة محاولة الكاميرا",
        faceInPosition: "الوجه في الموضع الصحيح",
        placeFaceInsideArea: "ضع الوجه داخل المنطقة",
        photoAutoTip: "سيتم التقاط الصورة تلقائيا بمجرد دخول وجهك إلى الإطار الأخضر.",
        previewAgeOnly: "المعاينات مؤقتة. هذه الخطوة تحفظ نتيجة العمر فقط، وليس صورة.",
        refresh: "تحديث",
        cardGuideReady: "ضع بطاقتك داخل الإطار.",
        cameraRefreshHelp: "حدث الصفحة أو أعد توصيل الكاميرا.",
        cardPreviewSent: "المعاينات مؤقتة. لا يتم إرسال صورة البطاقة إلا عند الضغط على المسح.",
        cameraNotReady: "الكاميرا ليست جاهزة بعد",
        browserCameraBlocked: "تم حظر إذن كاميرا المتصفح أو أن الكاميرا غير متاحة.",
        startingAppCamera: "جار تشغيل كاميرا التطبيق...",
        browserCameraModeNote: "يستخدم هذا الوضع كاميرا المتصفح على هذا الجهاز.",
        cameraModeTitle: "اختر وضع الكاميرا",
        cameraModeDesc: "اختر الطريقة التي تريد المسح بها. تستخدم كاميرا Pi أولا ماسح العمر بملء الشاشة على Raspberry Pi، بينما يبقي وضع كاميرا التطبيق كل شيء على هذا الجهاز مع اختيار العمر يدويا.",
        piCameraTitle: "كاميرا Pi",
        piCameraDesc: "استخدم الزر الأخضر لكاميرا Pi لإجراء فحص العمر في نافذة Raspberry Pi بملء الشاشة. وبعد ذلك ستظل خطوة بطاقة الصحة تستخدم معاينة كاميرا Pi داخل التطبيق.",
        appCameraTitle: "كاميرا التطبيق",
        appCameraDesc: "استخدم كاميرا المتصفح على هذا الجهاز في خطوة بطاقة الصحة. سيتم اختيار العمر يدويا بدلا من اكتشافه تلقائيا.",
        appManualAgeMode: "يستخدم وضع كاميرا التطبيق اختيار العمر يدويا.",
        launchPiWindowPrompt: "استخدم الزر الأخضر أدناه لفتح نافذة كاميرا Pi",
        nextScreenAppCamera: "ستستخدم الشاشة التالية كاميرا التطبيق لمسح بطاقة الصحة",
        appNoAutoAge: "وضع كاميرا التطبيق لا يكتشف العمر تلقائيا بعد.",
        appChooseAgeDesc: "اختر الفئة العمرية أدناه، ثم ستستخدم شاشة بطاقة الصحة كاميرا المتصفح على هذا الجهاز.",
        changeCameraMode: "تغيير وضع الكاميرا",
        healthCardPiMode: "يستخدم مسح بطاقة الصحة معاينة كاميرا Raspberry Pi داخل التطبيق.",
        healthCardAppMode: "يستخدم مسح بطاقة الصحة كاميرا المتصفح على هذا الجهاز.",
        backToCamera: "العودة إلى الكاميرا",
        play: "تشغيل",
        playQuestionTitle: "استمع إلى السؤال",
        startNewCheckin: "ابدأ تسجيلا جديدا",
        ageDetected: "تم اكتشاف {age}",
        back: "رجوع",
    },
    pa: {
        connectingPiCamera: "Pi ਕੈਮਰੇ ਨਾਲ ਜੁੜਿਆ ਜਾ ਰਿਹਾ ਹੈ...",
        openingPiCameraWindow: "Pi ਕੈਮਰਾ ਵਿੰਡੋ ਖੋਲੀ ਜਾ ਰਹੀ ਹੈ...",
        analyzingAge: "ਉਮਰ ਦਾ ਵਿਸ਼ਲੇਸ਼ਣ ਕੀਤਾ ਜਾ ਰਿਹਾ ਹੈ...",
        ageUnclearRetry: "ਚਿਹਰਾ ਮਿਲਿਆ ਹੈ, ਪਰ ਉਮਰ ਸਪਸ਼ਟ ਨਹੀਂ ਆਈ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
        ageCouldNotDetect: "ਉਮਰ ਪਤਾ ਨਹੀਂ ਲੱਗੀ। ਕਿਰਪਾ ਕਰਕੇ ਹੱਥੋਂ ਚੁਣੋ ਜਾਂ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
        ageScanFailed: "ਉਮਰ ਸਕੈਨ ਅਸਫਲ ਰਹੀ। ਕਿਰਪਾ ਕਰਕੇ ਹੱਥੋਂ ਚੁਣੋ ਜਾਂ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
        scanFailedStatus: "ਸਕੈਨ ਅਸਫਲ ({status})",
        tapGreenButton: "Raspberry Pi ਕੈਮਰਾ ਵਿੰਡੋ ਖੋਲ੍ਹਣ ਲਈ ਹਰਾ ਬਟਨ ਦਬਾਓ।",
        placeFaceGuide: "ਆਪਣਾ ਚਿਹਰਾ ਹਾਈਲਾਈਟ ਕੀਤੇ ਖੇਤਰ ਦੇ ਅੰਦਰ ਰੱਖੋ।",
        moveFaceGuide: "ਆਪਣਾ ਚਿਹਰਾ ਹਾਈਲਾਈਟ ਕੀਤੇ ਖੇਤਰ ਵਿੱਚ ਲਿਆਓ।",
        holdFaceBox: "ਆਪਣਾ ਚਿਹਰਾ ਫਰੇਮ ਵਿੱਚ ਰੱਖੋ...",
        holdStillAuto: "ਚਿਹਰਾ ਠੀਕ ਜਗ੍ਹਾ 'ਤੇ ਹੈ। ਆਟੋ ਸਕੈਨ ਲਈ ਸ਼ਾਂਤ ਰਹੋ...",
        capturingAuto: "ਚਿਹਰਾ ਠੀਕ ਜਗ੍ਹਾ 'ਤੇ ਹੈ। ਆਪਣੇ ਆਪ ਕੈਪਚਰ ਹੋ ਰਿਹਾ ਹੈ...",
        piWindowTitle: "Raspberry Pi ਕੈਮਰਾ ਵਿੰਡੋ",
        piWindowDesc: "ਇਹ Raspberry Pi 'ਤੇ ਫੁੱਲ ਸਕ੍ਰੀਨ ਕੈਮਰਾ ਸਕ੍ਰੀਨ ਖੋਲ੍ਹਦਾ ਹੈ, ਓਥੇ ਸਕੈਨ ਕਰਦਾ ਹੈ ਅਤੇ ਉਮਰ ਦਾ ਨਤੀਜਾ ਇਸ ਐਪ ਵਿੱਚ ਵਾਪਸ ਭੇਜਦਾ ਹੈ।",
        openPiWindowButton: "Pi ਕੈਮਰਾ ਵਿੰਡੋ ਖੋਲ੍ਹੋ",
        legacyPiNote: "ਇਹ ਐਪ ਅੰਦਰਲੀ ਝਲਕ ਦੀ ਥਾਂ ਪੁਰਾਣਾ Raspberry Pi/OpenCV ਸਕੈਨ ਵਰਤਦਾ ਹੈ।",
        cameraUnavailable: "ਕੈਮਰਾ ਉਪਲਬਧ ਨਹੀਂ ਹੈ",
        usePiCameraWindow: "Pi ਕੈਮਰਾ ਵਿੰਡੋ ਵਰਤੋ",
        retryCamera: "ਕੈਮਰਾ ਦੁਬਾਰਾ ਚਲਾਓ",
        faceInPosition: "ਚਿਹਰਾ ਠੀਕ ਸਥਿਤੀ ਵਿੱਚ ਹੈ",
        placeFaceInsideArea: "ਚਿਹਰਾ ਖੇਤਰ ਵਿੱਚ ਰੱਖੋ",
        photoAutoTip: "ਜਿਵੇਂ ਹੀ ਤੁਹਾਡਾ ਚਿਹਰਾ ਹਰੇ ਬਾਕਸ ਵਿੱਚ ਆਉਂਦਾ ਹੈ, ਫੋਟੋ ਆਪਣੇ ਆਪ ਕੈਪਚਰ ਹੋ ਜਾਂਦੀ ਹੈ।",
        previewAgeOnly: "ਝਲਕ ਅਸਥਾਈ ਹੈ। ਇਸ ਕਦਮ ਵਿੱਚ ਸਿਰਫ਼ ਉਮਰ ਦਾ ਨਤੀਜਾ ਸੇਵ ਹੁੰਦਾ ਹੈ, ਫੋਟੋ ਨਹੀਂ।",
        refresh: "ਤਾਜ਼ਾ ਕਰੋ",
        cardGuideReady: "ਆਪਣਾ ਕਾਰਡ ਗਾਈਡ ਦੇ ਅੰਦਰ ਰੱਖੋ।",
        cameraRefreshHelp: "ਪੇਜ ਤਾਜ਼ਾ ਕਰੋ ਜਾਂ ਕੈਮਰਾ ਮੁੜ ਜੋੜੋ।",
        cardPreviewSent: "ਝਲਕ ਅਸਥਾਈ ਹੈ। ਕਾਰਡ ਦੀ ਤਸਵੀਰ ਸਿਰਫ਼ ਉਸ ਵੇਲੇ ਭੇਜੀ ਜਾਂਦੀ ਹੈ ਜਦੋਂ ਤੁਸੀਂ ਸਕੈਨ ਦਬਾਉਂਦੇ ਹੋ।",
        cameraNotReady: "ਕੈਮਰਾ ਹਾਲੇ ਤਿਆਰ ਨਹੀਂ ਹੈ",
        browserCameraBlocked: "ਬਰਾਊਜ਼ਰ ਕੈਮਰੇ ਦੀ ਇਜਾਜ਼ਤ ਰੋਕ ਦਿੱਤੀ ਗਈ ਸੀ ਜਾਂ ਕੈਮਰਾ ਉਪਲਬਧ ਨਹੀਂ ਹੈ।",
        startingAppCamera: "ਐਪ ਕੈਮਰਾ ਸ਼ੁਰੂ ਕੀਤਾ ਜਾ ਰਿਹਾ ਹੈ...",
        browserCameraModeNote: "ਇਹ ਮੋਡ ਇਸ ਡਿਵਾਈਸ ਦੇ ਬਰਾਊਜ਼ਰ ਕੈਮਰੇ ਨੂੰ ਵਰਤਦਾ ਹੈ।",
        cameraModeTitle: "ਕੈਮਰਾ ਮੋਡ ਚੁਣੋ",
        cameraModeDesc: "ਤੁਸੀਂ ਕਿਵੇਂ ਸਕੈਨ ਕਰਨਾ ਚਾਹੁੰਦੇ ਹੋ, ਉਹ ਚੁਣੋ। Pi ਕੈਮਰਾ ਪਹਿਲਾਂ Raspberry Pi ਦਾ ਫੁੱਲ ਸਕ੍ਰੀਨ ਉਮਰ ਸਕੈਨਰ ਵਰਤਦਾ ਹੈ, ਜਦਕਿ ਐਪ ਕੈਮਰਾ ਇਸ ਡਿਵਾਈਸ 'ਤੇ ਸਭ ਕੁਝ ਰੱਖਦਾ ਹੈ ਅਤੇ ਉਮਰ ਹੱਥੋਂ ਚੁਣੀ ਜਾਂਦੀ ਹੈ।",
        piCameraTitle: "Pi ਕੈਮਰਾ",
        piCameraDesc: "ਉਮਰ ਸਕੈਨ ਲਈ ਹਰਾ Pi ਕੈਮਰਾ ਬਟਨ ਵਰਤੋ ਜੋ Raspberry Pi ਦੀ ਫੁੱਲ ਸਕ੍ਰੀਨ ਵਿੰਡੋ ਵਿੱਚ ਖੁੱਲੇਗਾ। ਬਾਅਦ ਵਿੱਚ ਹੈਲਥ ਕਾਰਡ ਕਦਮ ਐਪ ਅੰਦਰ Pi ਕੈਮਰਾ ਝਲਕ ਹੀ ਵਰਤੇਗਾ।",
        appCameraTitle: "ਐਪ ਕੈਮਰਾ",
        appCameraDesc: "ਹੈਲਥ ਕਾਰਡ ਕਦਮ ਲਈ ਇਸ ਡਿਵਾਈਸ ਦਾ ਬਰਾਊਜ਼ਰ ਕੈਮਰਾ ਵਰਤੋ। ਉਮਰ ਆਟੋਮੈਟਿਕ ਨਹੀਂ, ਹੱਥੋਂ ਚੁਣੀ ਜਾਵੇਗੀ।",
        appManualAgeMode: "ਐਪ ਕੈਮਰਾ ਮੋਡ ਹੱਥੋਂ ਉਮਰ ਚੋਣ ਵਰਤਦਾ ਹੈ।",
        launchPiWindowPrompt: "ਹੇਠਾਂ ਦਿੱਤੇ ਹਰੇ ਬਟਨ ਨਾਲ Pi ਕੈਮਰਾ ਵਿੰਡੋ ਖੋਲ੍ਹੋ",
        nextScreenAppCamera: "ਅਗਲੀ ਸਕ੍ਰੀਨ ਹੈਲਥ ਕਾਰਡ ਸਕੈਨ ਕਰਨ ਲਈ ਐਪ ਕੈਮਰਾ ਵਰਤੇਗੀ",
        appNoAutoAge: "ਐਪ ਕੈਮਰਾ ਮੋਡ ਹਾਲੇ ਉਮਰ ਆਪਣੇ ਆਪ ਨਹੀਂ ਪਛਾਣਦਾ।",
        appChooseAgeDesc: "ਹੇਠਾਂ ਉਮਰ ਸਮੂਹ ਚੁਣੋ, ਫਿਰ ਹੈਲਥ ਕਾਰਡ ਸਕ੍ਰੀਨ ਇਸ ਡਿਵਾਈਸ ਦਾ ਬਰਾਊਜ਼ਰ ਕੈਮਰਾ ਵਰਤੇਗੀ।",
        changeCameraMode: "ਕੈਮਰਾ ਮੋਡ ਬਦਲੋ",
        healthCardPiMode: "ਹੈਲਥ ਕਾਰਡ ਸਕੈਨ ਐਪ ਅੰਦਰ Raspberry Pi ਕੈਮਰਾ ਝਲਕ ਵਰਤ ਰਿਹਾ ਹੈ।",
        healthCardAppMode: "ਹੈਲਥ ਕਾਰਡ ਸਕੈਨ ਇਸ ਡਿਵਾਈਸ ਦਾ ਬਰਾਊਜ਼ਰ ਕੈਮਰਾ ਵਰਤ ਰਿਹਾ ਹੈ।",
        backToCamera: "ਕੈਮਰੇ ਵੱਲ ਵਾਪਸ ਜਾਓ",
        play: "ਚਲਾਓ",
        playQuestionTitle: "ਸਵਾਲ ਸੁਣੋ",
        startNewCheckin: "ਨਵਾਂ ਚੈੱਕ-ਇਨ ਸ਼ੁਰੂ ਕਰੋ",
        ageDetected: "{age} ਮਿਲਿਆ",
        back: "ਵਾਪਸ",
    },
    zh: {
        connectingPiCamera: "正在连接 Pi 摄像头...",
        openingPiCameraWindow: "正在打开 Pi 摄像头窗口...",
        analyzingAge: "正在分析年龄...",
        ageUnclearRetry: "检测到了人脸，但年龄识别不清楚。请重试。",
        ageCouldNotDetect: "无法检测年龄。请选择手动或重试。",
        ageScanFailed: "年龄扫描失败。请选择手动或重试。",
        scanFailedStatus: "扫描失败（{status}）",
        tapGreenButton: "点击绿色按钮以打开 Raspberry Pi 摄像头窗口。",
        placeFaceGuide: "请将脸放在高亮区域内。",
        moveFaceGuide: "请把脸移动到高亮区域内。",
        holdFaceBox: "请把脸保持在框内...",
        holdStillAuto: "人脸已对齐。请保持不动以进行自动扫描...",
        capturingAuto: "人脸已对齐。正在自动拍摄...",
        piWindowTitle: "Raspberry Pi 摄像头窗口",
        piWindowDesc: "这会在 Raspberry Pi 上打开全屏摄像头界面，在那里完成扫描，并将年龄结果返回到此应用中。",
        openPiWindowButton: "打开 Pi 摄像头窗口",
        legacyPiNote: "这会使用旧版 Raspberry Pi/OpenCV 扫描，而不是应用内预览。",
        cameraUnavailable: "摄像头不可用",
        usePiCameraWindow: "使用 Pi 摄像头窗口",
        retryCamera: "重试摄像头",
        faceInPosition: "人脸已就位",
        placeFaceInsideArea: "请将脸放入区域内",
        photoAutoTip: "当您的脸进入绿色框后，系统会自动拍摄。",
        previewAgeOnly: "预览画面只是临时的。此步骤只保存年龄结果，不保存照片。",
        refresh: "刷新",
        cardGuideReady: "请将您的卡片放在引导框内。",
        cameraRefreshHelp: "请刷新页面或重新连接摄像头。",
        cardPreviewSent: "预览画面只是临时的。只有在您点击扫描时，才会发送卡片图像。",
        cameraNotReady: "摄像头尚未就绪",
        browserCameraBlocked: "浏览器摄像头权限被阻止或摄像头不可用。",
        startingAppCamera: "正在启动应用摄像头...",
        browserCameraModeNote: "此模式使用当前设备上的浏览器摄像头。",
        cameraModeTitle: "选择摄像头模式",
        cameraModeDesc: "请选择扫描方式。Pi 摄像头会先使用 Raspberry Pi 的全屏年龄扫描器，而应用摄像头会将所有步骤保留在当前设备上，并手动选择年龄。",
        piCameraTitle: "Pi 摄像头",
        piCameraDesc: "使用绿色 Pi 摄像头按钮，在 Raspberry Pi 全屏窗口中进行年龄扫描。之后，健康卡步骤仍会在应用内使用 Pi 摄像头预览。",
        appCameraTitle: "应用摄像头",
        appCameraDesc: "在健康卡步骤中使用当前设备的浏览器摄像头。年龄将手动选择，而不是自动检测。",
        appManualAgeMode: "应用摄像头模式使用手动年龄选择。",
        launchPiWindowPrompt: "使用下面的绿色按钮打开 Pi 摄像头窗口",
        nextScreenAppCamera: "下一步将使用应用摄像头扫描健康卡",
        appNoAutoAge: "应用摄像头模式暂时还不能自动检测年龄。",
        appChooseAgeDesc: "请先在下面选择年龄组，然后健康卡页面会使用当前设备的浏览器摄像头。",
        changeCameraMode: "更改摄像头模式",
        healthCardPiMode: "健康卡扫描正在使用应用内的 Raspberry Pi 摄像头预览。",
        healthCardAppMode: "健康卡扫描正在使用当前设备的浏览器摄像头。",
        backToCamera: "返回摄像头",
        play: "播放",
        playQuestionTitle: "朗读问题",
        startNewCheckin: "开始新的登记",
        ageDetected: "已检测到 {age}",
        back: "返回",
    },
    es: {
        connectingPiCamera: "Conectando a la camara Pi...",
        openingPiCameraWindow: "Abriendo ventana de la camara Pi...",
        analyzingAge: "Analizando edad...",
        ageUnclearRetry: "Se detecto un rostro, pero la lectura de edad no fue clara. Intentelo de nuevo.",
        ageCouldNotDetect: "No se pudo detectar la edad. Elija manualmente o intentelo de nuevo.",
        ageScanFailed: "La deteccion de edad fallo. Elija manualmente o intentelo de nuevo.",
        scanFailedStatus: "Deteccion fallida ({status})",
        tapGreenButton: "Toque el boton verde para abrir la ventana de la camara Raspberry Pi.",
        placeFaceGuide: "Coloque su rostro dentro del area resaltada.",
        moveFaceGuide: "Mueva su rostro hacia el area resaltada.",
        holdFaceBox: "Mantenga su rostro dentro del recuadro...",
        holdStillAuto: "Rostro alineado. Quedese quieto para el escaneo automatico...",
        capturingAuto: "Rostro alineado. Capturando automaticamente...",
        piWindowTitle: "Ventana de camara Raspberry Pi",
        piWindowDesc: "Esto abre la pantalla de camara en pantalla completa del Raspberry Pi, realiza el escaneo alli y devuelve el resultado de edad a esta aplicacion.",
        openPiWindowButton: "Abrir camara Pi",
        legacyPiNote: "Esto usa el escaneo heredado de Raspberry Pi/OpenCV en lugar de la vista previa dentro de la aplicacion.",
        cameraUnavailable: "Camara no disponible",
        usePiCameraWindow: "Usar ventana de camara Pi",
        retryCamera: "Reintentar camara",
        faceInPosition: "Rostro en posicion",
        placeFaceInsideArea: "Coloque el rostro dentro del area",
        photoAutoTip: "La foto se captura automaticamente tan pronto como su rostro entra en el cuadro verde.",
        previewAgeOnly: "Las vistas previas son temporales. Este paso solo guarda el resultado de edad, no una foto.",
        refresh: "Actualizar",
        cardGuideReady: "Coloque su tarjeta dentro de la guia.",
        cameraRefreshHelp: "Actualice la pagina o vuelva a conectar la camara.",
        cardPreviewSent: "Las vistas previas son temporales. La imagen de la tarjeta solo se envia cuando toca Escanear.",
        cameraNotReady: "La camara aun no esta lista",
        browserCameraBlocked: "El permiso de la camara del navegador fue bloqueado o la camara no esta disponible.",
        startingAppCamera: "Iniciando camara de la aplicacion...",
        browserCameraModeNote: "Este modo usa la camara del navegador en este dispositivo.",
        cameraModeTitle: "Elegir modo de camara",
        cameraModeDesc: "Elija como desea escanear. La camara Pi usa primero el escaner de edad en pantalla completa del Raspberry Pi, mientras que la camara de la aplicacion mantiene todo en este dispositivo con seleccion manual de edad.",
        piCameraTitle: "Camara Pi",
        piCameraDesc: "Use el boton verde de la camara Pi para escanear la edad en la ventana de pantalla completa del Raspberry Pi. Luego, el paso de la tarjeta de salud sigue usando la vista previa de la camara Pi dentro de la aplicacion.",
        appCameraTitle: "Camara de la aplicacion",
        appCameraDesc: "Use la camara del navegador de este dispositivo para el paso de la tarjeta de salud. La edad se elegira manualmente en lugar de detectarse automaticamente.",
        appManualAgeMode: "El modo de camara de la aplicacion usa seleccion manual de edad.",
        launchPiWindowPrompt: "Use el boton verde de abajo para abrir la ventana de la camara Pi",
        nextScreenAppCamera: "La siguiente pantalla usara la camara de la aplicacion para escanear la tarjeta de salud",
        appNoAutoAge: "El modo de camara de la aplicacion todavia no detecta la edad automaticamente.",
        appChooseAgeDesc: "Elija el grupo de edad abajo y luego la pantalla de la tarjeta de salud usara la camara del navegador de este dispositivo.",
        changeCameraMode: "Cambiar modo de camara",
        healthCardPiMode: "El escaneo de la tarjeta de salud esta usando la vista previa de la camara Raspberry Pi dentro de la aplicacion.",
        healthCardAppMode: "El escaneo de la tarjeta de salud esta usando la camara del navegador de este dispositivo.",
        backToCamera: "Volver a la camara",
        play: "Reproducir",
        playQuestionTitle: "Escuchar la pregunta",
        startNewCheckin: "Comenzar nuevo registro",
        ageDetected: "Se detecto {age}",
        back: "Atras",
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

const BODY_QUESTIONS: Record<string, Record<string, Record<string, string>>> = {
    chest: {
        en: {
            chest_pain: "Do you have chest pain or pressure?",
            radiating_pain: "Does the pain spread to your arm, jaw, or back?",
            difficulty_breathing: "Are you having difficulty breathing?",
            sweating: "Are you sweating or feeling clammy?",
        },
        fr: {
            chest_pain: "Avez-vous des douleurs ou une pression dans la poitrine ?",
            radiating_pain: "La douleur irradie-t-elle vers le bras, la machoire ou le dos ?",
            difficulty_breathing: "Avez-vous du mal a respirer ?",
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
            severe_headache: "Avez-vous un mal de tete soudain ou tres severe ?",
            vision_change: "Avez-vous une vision floue ou double ?",
            dizziness: "Vous sentez-vous etourdi ou instable ?",
            confusion: "Vous sentez-vous confus ou desoriente ?",
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
            arm_pain: "Avez-vous de la douleur ou un gonflement dans le bras ou l'epaule ?",
            numbness: "Avez-vous un engourdissement ou des picotements dans le bras ou la main ?",
            injury: "Vous etes-vous blesse ou avez-vous fait une chute sur le bras recemment ?",
            weakness: "Avez-vous une faiblesse ou une incapacite a bouger le bras ?",
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
            leg_injury: "Vous etes-vous blesse a la jambe, au genou ou a la cheville recemment ?",
            leg_numbness: "Avez-vous un engourdissement ou une faiblesse dans la jambe ou le pied ?",
            cannot_walk: "Etes-vous incapable de marcher ou de mettre du poids sur la jambe ?",
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
            fever: "Avez-vous de la fievre ?",
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
            allergic_reaction: "Do you have a rash, hives, or a swollen face?",
            fever_other: "Do you have a high fever (above 38.5°C / 101°F)?",
            general_weakness: "Are you feeling very weak or unusually tired?",
        },
        fr: {
            fainting: "Avez-vous perdu connaissance ou failli vous evanouir ?",
            allergic_reaction: "Avez-vous une eruption cutanee, de l'urticaire ou un visage gonfle ?",
            fever_other: "Avez-vous une forte fievre (au-dessus de 38,5°C) ?",
            general_weakness: "Vous sentez-vous tres faible ou inhabituellement fatigue ?",
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

function translateText(
    t: Record<string, string>,
    key: string,
    values: Record<string, string | number> = {},
) {
    const template = t[key] || EXTRA_T.en[key] || T.en[key] || key
    return Object.entries(values).reduce(
        (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
        template,
    )
}

function ageGroupLabel(ageGroup: AgeGroup, t: Record<string, string>) {
    const key = ageGroup.toLowerCase()
    return translateText(t, key)
}

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
        <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
            <span style={{ fontSize: size * 0.75, fontWeight: 800, letterSpacing: -0.5 }}>
                <span style={{ color: C.blue }}>Fast</span>
                <span style={{ color: "#EF4444" }}>ER</span>
            </span>
        </div>
    )
}

// ── Progress Bar ───────────────────────────────────────────────
function ProgressBar({
    step,
    total,
    kidMode = false,
}: {
    step: number
    total: number
    kidMode?: boolean
}) {
    return (
        <div style={{ marginBottom: 8 }}>
            <div style={{
                display: "flex",
                justifyContent: "flex-end",
                marginBottom: 6,
                fontSize: 13,
                color: kidMode ? C.pinkDark : C.gray,
            }}>
                <span style={{ fontWeight: 500 }}>{step} / {total}</span>
            </div>
            <div style={{
                height: 6,
                background: kidMode ? C.pinkLight : C.border,
                borderRadius: 99,
                overflow: "hidden",
            }}>
                <div style={{
                    height: "100%", width: `${(step / total) * 100}%`,
                    background: kidMode
                        ? `linear-gradient(90deg, ${C.pink} 0%, ${C.sky} 100%)`
                        : `linear-gradient(90deg, ${C.blue} 0%, #60A5FA 100%)`,
                    borderRadius: 99, transition: "width 0.4s ease",
                }} />
            </div>
        </div>
    )
}

function BodySilhouette({
    selected,
    onSelect,
    t,
}: {
    selected: string | null
    onSelect: (part: string) => void
    t: Record<string, string>
}) {
    const regions: Array<{ id: string; x: number; y: number; w: number; h: number }> = [
        { id: "head", x: 148, y: 12, w: 64, h: 68 },
        { id: "chest", x: 120, y: 90, w: 120, h: 90 },
        { id: "abdomen", x: 120, y: 185, w: 120, h: 80 },
        { id: "arm", x: 58, y: 88, w: 54, h: 160 },
        { id: "arm", x: 248, y: 88, w: 54, h: 160 },
        { id: "leg", x: 110, y: 270, w: 60, h: 160 },
        { id: "leg", x: 190, y: 270, w: 60, h: 160 },
    ]

    const labels: Record<string, [number, number]> = {
        head: [180, 46],
        chest: [180, 140],
        abdomen: [180, 225],
        arm: [88, 170],
        leg: [150, 345],
    }

    return (
        <div style={{ position: "relative", display: "inline-block" }}>
            <svg viewBox="0 0 360 450" width={280} height={350} style={{ display: "block", margin: "0 auto" }}>
                <g fill="#E2E8F0" stroke="none">
                    <ellipse cx={180} cy={46} rx={34} ry={38} />
                    <rect x={165} y={80} width={30} height={20} rx={6} />
                    <rect x={122} y={96} width={116} height={168} rx={16} />
                    <rect x={60} y={96} width={56} height={150} rx={14} />
                    <rect x={244} y={96} width={56} height={150} rx={14} />
                    <rect x={118} y={258} width={58} height={172} rx={14} />
                    <rect x={184} y={258} width={58} height={172} rx={14} />
                </g>

                {regions.map((region, idx) => {
                    const isSelected = selected === region.id
                    return (
                        <rect
                            key={`${region.id}-${idx}`}
                            x={region.x}
                            y={region.y}
                            width={region.w}
                            height={region.h}
                            rx={12}
                            fill={isSelected ? "rgba(37,99,235,0.35)" : "rgba(37,99,235,0)"}
                            stroke={isSelected ? C.blue : "transparent"}
                            strokeWidth={2}
                            style={{ cursor: "pointer", transition: "fill 0.15s" }}
                            onClick={() => onSelect(region.id)}
                            onMouseEnter={e => {
                                if (!isSelected) (e.currentTarget as SVGRectElement).style.fill = "rgba(37,99,235,0.15)"
                            }}
                            onMouseLeave={e => {
                                if (!isSelected) (e.currentTarget as SVGRectElement).style.fill = "rgba(37,99,235,0)"
                            }}
                        />
                    )
                })}

                {Object.entries(labels).map(([id, [x, y]]) => {
                    const isSelected = selected === id
                    const label = t[id] ? t[id].split(" ")[0] : id
                    return (
                        <text
                            key={id}
                            x={x}
                            y={y + 4}
                            textAnchor="middle"
                            fontSize={10}
                            fontWeight={isSelected ? 700 : 500}
                            fill={isSelected ? C.blue : "#64748B"}
                            style={{ pointerEvents: "none", userSelect: "none" }}
                        >
                            {label}
                        </text>
                    )
                })}
            </svg>

            <div style={{ marginTop: 10, textAlign: "center" }}>
                <button
                    onClick={() => onSelect("other")}
                    style={{
                        ...btn(
                            selected === "other" ? C.blue : C.lightGray,
                            selected === "other" ? "#fff" : C.slate,
                            `1px solid ${selected === "other" ? C.blue : C.border}`,
                        ),
                        width: 240,
                        fontSize: 14,
                        padding: "10px 16px",
                        display: "inline-flex",
                    }}
                >
                    {t.other}
                </button>
                <div style={{ fontSize: 11, color: C.gray, marginTop: 6 }}>{t.otherDesc}</div>
            </div>
        </div>
    )
}

function KidGraphicBanner({
    title,
    subtitle,
    badge,
    step,
    total,
    variant = 0,
}: {
    title?: string
    subtitle?: string
    badge?: string
    step?: number
    total?: number
    variant?: number
}) {
    const tilt = ["8deg", "-10deg", "6deg"][variant % 3]
    const offset = [0, 6, -4][variant % 3]

    return (
        <div style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 24,
            padding: "20px 22px",
            marginBottom: 16,
            background: `linear-gradient(135deg, ${C.pinkLight} 0%, ${C.white} 52%, ${C.skyLight} 100%)`,
            border: `1.5px solid ${C.kidBorder}`,
            boxShadow: "0 10px 28px rgba(236,72,153,0.12), 0 8px 20px rgba(56,189,248,0.10)",
        }}>
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                <div style={{
                    position: "absolute",
                    top: 16,
                    left: 16,
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: C.pink,
                    opacity: 0.85,
                }} />
                <div style={{
                    position: "absolute",
                    top: 18,
                    right: 24,
                    width: 46,
                    height: 12,
                    borderRadius: 999,
                    background: C.sky,
                    transform: `rotate(${tilt})`,
                    opacity: 0.95,
                }} />
                <div style={{
                    position: "absolute",
                    bottom: 14,
                    left: 28 + offset,
                    width: 52,
                    height: 18,
                    borderRadius: 999,
                    background: C.skyLight,
                    border: `2px solid ${C.sky}`,
                }} />
                <div style={{
                    position: "absolute",
                    right: 22,
                    bottom: 14,
                    width: 34,
                    height: 34,
                    borderRadius: 12,
                    background: C.white,
                    border: `4px solid ${C.pink}`,
                    transform: `rotate(${-8 - offset}deg)`,
                }} />
                <div style={{
                    position: "absolute",
                    right: 68,
                    bottom: 28,
                    width: 18,
                    height: 18,
                    background: C.pinkDark,
                    clipPath: "polygon(50% 0%, 61% 35%, 98% 35%, 67% 57%, 79% 91%, 50% 70%, 21% 91%, 33% 57%, 2% 35%, 39% 35%)",
                    opacity: 0.9,
                }} />
            </div>
            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18 }}>
                <div style={{ maxWidth: "72%" }}>
                    {badge && (
                        <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "6px 12px",
                            borderRadius: 999,
                            marginBottom: 10,
                            background: C.white,
                            border: `1px solid ${C.kidBorder}`,
                            color: C.pinkDark,
                            fontSize: 12,
                            fontWeight: 800,
                            letterSpacing: 0.3,
                            textTransform: "uppercase",
                        }}>
                            {badge}
                        </span>
                    )}
                    {title && (
                        <div style={{ fontSize: 22, fontWeight: 700, color: C.slate, lineHeight: 1.25 }}>
                            {title}
                        </div>
                    )}
                    {subtitle && (
                        <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.5, color: C.gray }}>
                            {subtitle}
                        </div>
                    )}
                </div>
                <div style={{ position: "relative", width: 84, height: 72, flexShrink: 0 }}>
                    <div style={{
                        position: "absolute",
                        top: 4,
                        left: 10,
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: C.sky,
                    }} />
                    <div style={{
                        position: "absolute",
                        top: 18,
                        left: 30,
                        width: 34,
                        height: 34,
                        borderRadius: 14,
                        background: C.white,
                        border: `4px solid ${C.sky}`,
                        transform: `rotate(${6 + offset}deg)`,
                    }} />
                    <div style={{
                        position: "absolute",
                        right: 4,
                        top: 10,
                        width: 18,
                        height: 18,
                        background: C.pinkDark,
                        clipPath: "polygon(50% 0%, 61% 35%, 98% 35%, 67% 57%, 79% 91%, 50% 70%, 21% 91%, 33% 57%, 2% 35%, 39% 35%)",
                    }} />
                    <div style={{
                        position: "absolute",
                        right: 10,
                        bottom: 0,
                        width: 44,
                        height: 14,
                        borderRadius: 999,
                        background: C.pink,
                        transform: `rotate(${tilt})`,
                    }} />
                </div>
            </div>
            {(step && total) ? (
                <div style={{
                    position: "relative",
                    marginTop: 14,
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "7px 12px",
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.92)",
                    border: `1px solid ${C.kidBorder}`,
                    color: C.skyDark,
                    fontSize: 13,
                    fontWeight: 700,
                }}>
                    {step} / {total}
                </div>
            ) : null}
        </div>
    )
}

// ── Live Camera Preview (Age Detection) ───────────────────────
function AgeCamera({
    onDetected,
    mode = "preview",
    t,
}: {
    onDetected: (group: AgeGroup) => void
    mode?: AgeCameraMode
    t: Record<string, string>
}) {
    const AUTO_SCAN_STEPS = 1
    const frameUrlRef = useRef<string | null>(null)
    const autoTriggeredRef = useRef(false)
    const alignedStepsRef = useRef(0)
    const cooldownUntilRef = useRef(0)
    const readyRef = useRef(false)
    const analyzingRef = useRef(false)
    const tr = (key: string, values: Record<string, string | number> = {}) => translateText(t, key, values)

    const [ready, setReady] = useState(false)
    const [camErr, setCamErr] = useState<string | null>(null)
    const [analyzing, setAnalyzing] = useState(false)
    const [message, setMessage] = useState(tr("connectingPiCamera"))
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
        setMessage(force ? tr("openingPiCameraWindow") : tr("analyzingAge"))

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

            if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : tr("scanFailedStatus", { status: res.status }))

            if (data.success && !data.fallback && data.age_group) {
                onDetected(data.age_group as AgeGroup)
                return true
            }

            setMessage(
                typeof data.message === "string"
                    ? data.message
                    : data.fallback
                        ? tr("ageUnclearRetry")
                        : tr("ageCouldNotDetect")
            )
            cooldownUntilRef.current = Date.now() + 600
            autoTriggeredRef.current = false
            alignedStepsRef.current = 0
            setAutoScanProgress(0)
            return false
        } catch (err) {
            const msg = err instanceof Error ? err.message : tr("ageScanFailed")
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
            setMessage(tr("tapGreenButton"))
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
        setMessage(tr("connectingPiCamera"))

        const loop = async () => {
            while (!cancelled) {
                try {
                    const res = await fetch(`${PI_SERVER}/camera-frame?ts=${Date.now()}`, { cache: "no-store" })
                    if (!res.ok) {
                        throw new Error(res.headers.get("X-Camera-Error") || `${tr("cameraUnavailable")} (${res.status})`)
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
                    setMessage(tr("placeFaceGuide"))

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
                                ? tr("moveFaceGuide")
                                : tr("placeFaceGuide")
                        )
                    } else {
                        if (Date.now() < cooldownUntilRef.current) {
                            setAutoScanProgress(0)
                            setMessage(tr("holdFaceBox"))
                            await sleep(150)
                            continue
                        }

                        const nextSteps = Math.min(alignedStepsRef.current + 1, AUTO_SCAN_STEPS)
                        alignedStepsRef.current = nextSteps
                        setAutoScanProgress(nextSteps)

                        if (nextSteps < AUTO_SCAN_STEPS) {
                            setMessage(tr("holdStillAuto"))
                        } else if (!autoTriggeredRef.current) {
                            autoTriggeredRef.current = true
                            setMessage(tr("capturingAuto"))
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
                    const msg = err instanceof Error ? err.message : tr("cameraUnavailable")
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
                    <div style={{ color: "#F8FAFC", fontSize: 18, fontWeight: 700 }}>
                        {tr("piWindowTitle")}
                    </div>
                    <p style={{ color: "#94A3B8", fontSize: 14, lineHeight: 1.6, margin: 0, maxWidth: 420 }}>
                        {tr("piWindowDesc")}
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
                        {analyzing ? tr("analyzingAge") : tr("openPiWindowButton")}
                    </button>
                </div>

                <p style={{ fontSize: 12, color: C.gray, textAlign: "center", margin: "12px 0 0" }}>
                    {tr("legacyPiNote")}
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
                        <span style={{ color: "#CBD5E1", fontSize: 16, fontWeight: 700, textAlign: "center" }}>{tr("cameraUnavailable")}</span>
                        <span style={{ color: "#94A3B8", fontSize: 12, textAlign: "center" }}>{camErr}</span>
                        <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap", justifyContent: "center" }}>
                            <button
                                onClick={() => { void startScan({ force: true }) }}
                                disabled={analyzing}
                                style={{ ...btn(C.green), width: "auto", padding: "10px 20px", fontSize: 14 }}
                            >
                                {tr("usePiCameraWindow")}
                            </button>
                            <button
                                onClick={() => setAttempt(a => a + 1)}
                                disabled={analyzing}
                                style={{ ...btn(C.blue), width: "auto", padding: "10px 20px", fontSize: 14 }}
                            >
                                {tr("retryCamera")}
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {frameUrl && (
                            <img
                                src={frameUrl}
                                alt=""
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
                                {guideState === "aligned" ? tr("faceInPosition") : tr("placeFaceInsideArea")}
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
                                    {tr("analyzingAge")}
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
                    {tr("photoAutoTip")}
                </p>
            </div>

            <p style={{ fontSize: 12, color: C.gray, textAlign: "center", margin: "0 0 12px" }}>
                {tr("previewAgeOnly")}
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
                    {tr("refresh")}
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
    const tr = (key: string, values: Record<string, string | number> = {}) => translateText(t, key, values)
    const [status, setStatus] = useState(tr("connectingPiCamera"))

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
                    setStatus(tr("connectingPiCamera"))
                    const res = await fetch(`${PI_SERVER}/camera-frame?ts=${Date.now()}`, { cache: "no-store" })
                    if (!res.ok) {
                        throw new Error(res.headers.get("X-Camera-Error") || `${tr("cameraUnavailable")} (${res.status})`)
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
                    setStatus(tr("cardGuideReady"))
                } catch (err) {
                    const msg = err instanceof Error ? err.message : tr("cameraUnavailable")
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
            setStatus(tr("cameraNotReady"))
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
                        <span style={{ color: "#CBD5E1", fontSize: 18, fontWeight: 700 }}>{tr("cameraUnavailable")}</span>
                        <span style={{ color: "#64748B", fontSize: 13 }}>{tr("cameraRefreshHelp")}</span>
                    </div>
                ) : (
                    <>
                        {frameUrl && (
                            <img
                                src={frameUrl}
                                alt=""
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
                {tr("cardPreviewSent")}
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
                    {tr("refresh")}
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
    const tr = (key: string, values: Record<string, string | number> = {}) => translateText(t, key, values)

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
                setCamErr(tr("browserCameraBlocked"))
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
                        <span style={{ color: "#CBD5E1", fontSize: 18, fontWeight: 700 }}>{tr("cameraUnavailable")}</span>
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
                                <span style={{ color: "#94A3B8", fontSize: 14 }}>{tr("startingAppCamera")}</span>
                            </div>
                        )}
                    </>
                )}
            </div>

            <p style={{ fontSize: 12, color: C.gray, textAlign: "center", margin: "0 0 12px" }}>
                {tr("browserCameraModeNote")}
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

function BackButton({
    label,
    onClick,
    rtl,
    disabled = false,
    fontScale = 1,
}: {
    label: string
    onClick: () => void
    rtl?: boolean
    disabled?: boolean
    fontScale?: number
}) {
    return (
        <div style={{ display: "flex", justifyContent: rtl ? "flex-end" : "flex-start", marginBottom: 16 }}>
            <button
                onClick={onClick}
                disabled={disabled}
                style={{
                    ...btn("transparent", disabled ? "#94A3B8" : C.slate, `1px solid ${C.border}`),
                    width: "auto",
                    padding: `${Math.round(10 * fontScale)}px ${Math.round(18 * fontScale)}px`,
                    fontSize: Math.round(17 * fontScale),
                    opacity: disabled ? 0.65 : 1,
                }}
            >
                {label}
            </button>
        </div>
    )
}

// ── Main App ───────────────────────────────────────────────────
type Step = "language" | "camera" | "age" | "card" | "body" | "questions" | "complete"

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
    const [patientId, setPatientId] = useState<number | null>(null)
    const [bodyPart, setBodyPart] = useState<string | null>(null)
    const [questions, setQuestions] = useState<Array<{ id: string; text: string }>>([])
    const [qIndex, setQIndex] = useState(0)
    const [answers, setAnswers] = useState<Record<string, boolean>>({})
    const [submitting, setSubmitting] = useState(false)
    const historyReadyRef = useRef(false)
    const popNavigationRef = useRef(false)
    const lastHistoryViewRef = useRef("")

    const t = {
        ...(T.en || {}),
        ...(EXTRA_T.en || {}),
        ...(T[lang] || {}),
        ...(EXTRA_T[lang] || {}),
    }
    const isRTL = LANGUAGES.find(l => l.code === lang)?.dir === "rtl"
    const fs = ageGroup === "Senior" ? 1.28 : 1
    const isKidMode = ageGroup === "Child"
    const scale = (size: number) => Math.round(size * fs)
    const primaryAction = isKidMode ? C.pink : C.blue
    const secondaryAction = isKidMode ? C.sky : "#334155"
    const subtleAction = isKidMode ? C.skyDark : C.gray
    const outlineBorder = `1.5px solid ${isKidMode ? C.kidBorder : C.border}`
    const kidCardStyle: React.CSSProperties = isKidMode ? {
        border: `1.5px solid ${C.kidBorder}`,
        boxShadow: "0 10px 26px rgba(236,72,153,0.10), 0 10px 22px rgba(56,189,248,0.10)",
        background: "linear-gradient(180deg, #FFFFFF 0%, #FFF8FC 100%)",
    } : {}
    const themedCard = (extra: React.CSSProperties = {}): React.CSSProperties => ({
        ...card,
        ...kidCardStyle,
        ...extra,
    })
    const actionBtn = (bg: string, color = "#fff", border = "none"): React.CSSProperties => ({
        ...btn(bg, color, border),
        fontSize: scale(17),
        padding: `${Math.round(16 * fs)}px ${Math.round(24 * fs)}px`,
    })
    const outlineBtn = (color = subtleAction): React.CSSProperties =>
        actionBtn(isKidMode ? C.white : "transparent", color, outlineBorder)
    const backDisabled = step === "card" && scanningCard

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

    const discardDraftPatient = async () => {
        if (patientId == null) return

        const draftId = patientId
        setPatientId(null)

        try {
            await fetch(`${AI_SERVER}/queue/${draftId}`, { method: "DELETE" })
        } catch { }
    }

    const handleCardCapture = async (b64: string) => {
        setScanningCard(true)
        try {
            const res = await fetch(`${AI_SERVER}/scan-card`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    image: b64,
                    patient_id: patientId,
                    lang,
                    age_group: ageGroup || "Adult",
                }),
            })
            const d = await res.json()
            if (typeof d.patient_id === "number") setPatientId(d.patient_id)
            setPatientName(d.name !== "Unknown" ? d.name : "")
            setHealthId(d.health_id !== "N/A" ? d.health_id : "")
        } catch { }
        setScanningCard(false)
        setBodyPart(null)
        setQuestions([])
        setAnswers({})
        setQIndex(0)
        setStep("body")
    }

    const handleBodySelect = (part: string) => {
        const qMap =
            BODY_QUESTIONS[part]?.[lang] ||
            BODY_QUESTIONS[part]?.en ||
            BODY_QUESTIONS.other.en
        const nextQuestions = Object.entries(qMap).map(([id, text]) => ({ id, text }))
        setBodyPart(part)
        setQuestions(nextQuestions)
        setAnswers({})
        setQIndex(0)
        setStep("questions")
        if (nextQuestions.length > 0) void speak(nextQuestions[0].text)
    }

    const handleAnswer = async (id: string, val: boolean) => {
        const newAnswers = { ...answers, [id]: val }
        setAnswers(newAnswers)

        if (qIndex < questions.length - 1) {
            const nextQuestion = questions[qIndex + 1]
            setTimeout(() => {
                setQIndex(i => i + 1)
                void speak(nextQuestion.text)
            }, 250)
        } else {
            setSubmitting(true)
            try {
                await fetch(`${AI_SERVER}/queue`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        patient_id: patientId,
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

    const reset = () => {
        if (step !== "complete") {
            void discardDraftPatient()
        } else {
            setPatientId(null)
        }
        setStep("language"); setLang("en"); setCameraMode(null); setAgeGroup(null)
        setManualName(""); setManualId(""); setPatientName(""); setHealthId("")
        setBodyPart(null); setQuestions([]); setQIndex(0); setAnswers({})
        setCardMode("scan"); setScanningCard(false)
    }

    const getHistoryView = () => {
        if (step === "card") return cardMode === "manual" ? "card-manual" : "card-scan"
        if (step === "questions" || step === "complete") return "locked"
        return step
    }

    const goBack = () => {
        if (backDisabled) return false

        if (step === "card" && cardMode === "manual") {
            setCardMode("scan")
            return true
        }

        if (step === "card") {
            void discardDraftPatient()
            setPatientName("")
            setHealthId("")
            setCardMode("scan")
            setAgeGroup(null)
            setStep("age")
            return true
        }

        if (step === "body") {
            setBodyPart(null)
            setQuestions([])
            setQIndex(0)
            setAnswers({})
            setStep("card")
            return true
        }

        if (step === "age") {
            setAgeGroup(null)
            setStep("camera")
            return true
        }

        if (step === "camera") {
            setCameraMode(null)
            setAgeGroup(null)
            setCardMode("scan")
            setStep("language")
            return true
        }

        return false
    }

    useEffect(() => {
        if (typeof window === "undefined") return

        const view = getHistoryView()

        if (!historyReadyRef.current) {
            window.history.replaceState({ kioskView: view }, "")
            historyReadyRef.current = true
            lastHistoryViewRef.current = view
            return
        }

        if (popNavigationRef.current) {
            popNavigationRef.current = false
            lastHistoryViewRef.current = view
            return
        }

        if (view === lastHistoryViewRef.current) return

        window.history.pushState({ kioskView: view }, "")
        lastHistoryViewRef.current = view
    }, [step, cardMode])

    useEffect(() => {
        if (typeof window === "undefined") return

        const onPopState = () => {
            if (step === "questions" || step === "complete") {
                const lockedView = getHistoryView()
                window.history.pushState({ kioskView: lockedView }, "")
                lastHistoryViewRef.current = lockedView
                return
            }

            popNavigationRef.current = true

            if (!goBack()) {
                popNavigationRef.current = false
            }
        }

        window.addEventListener("popstate", onPopState)
        return () => window.removeEventListener("popstate", onPopState)
    }, [step, cardMode, backDisabled])

    if (step === "language") return (
        <Screen rtl={isRTL}>
            <div style={{ textAlign: "center", marginBottom: 36 }}>
                <h1 style={{ fontSize: 26, fontWeight: 700, margin: "20px 0 8px", color: C.slate }}>
                    {t.welcome}
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
            <BackButton label={t.back} onClick={goBack} rtl={isRTL} fontScale={fs} />
            <div style={{ ...card, textAlign: "center", marginBottom: 16 }}>
                <h2 style={{ fontSize: scale(22), fontWeight: 700, color: C.slate, margin: "0 0 10px" }}>
                    {t.cameraModeTitle}
                </h2>
                <p style={{ color: C.gray, fontSize: scale(15), lineHeight: 1.5, margin: 0 }}>
                    {t.cameraModeDesc}
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
                    <div style={{ fontSize: scale(18), fontWeight: 700, color: C.slate, marginBottom: 6 }}>{t.piCameraTitle}</div>
                    <div style={{ fontSize: scale(14), color: C.gray, lineHeight: 1.5 }}>
                        {t.piCameraDesc}
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
                    <div style={{ fontSize: scale(18), fontWeight: 700, color: C.slate, marginBottom: 6 }}>{t.appCameraTitle}</div>
                    <div style={{ fontSize: scale(14), color: C.gray, lineHeight: 1.5 }}>
                        {t.appCameraDesc}
                    </div>
                </button>
            </div>
        </Screen>
    )

    if (step === "age") return (
        <Screen rtl={isRTL} kidMode={isKidMode}>
            <BackButton label={t.back} onClick={goBack} rtl={isRTL} fontScale={fs} />
            <div style={themedCard({ textAlign: "center", marginBottom: 16 })}>
                <p style={{ color: C.gray, fontSize: scale(16), marginBottom: 8 }}>
                    {cameraMode === "pi" ? t.detecting : t.appManualAgeMode}
                </p>
                {ageGroup
                    ? <div style={{ fontSize: scale(32), fontWeight: 700, color: isKidMode ? C.pinkDark : C.green }}>{translateText(t, "ageDetected", { age: ageGroupLabel(ageGroup, t) })}</div>
                    : <div style={{ fontSize: scale(16), fontWeight: 600, color: isKidMode ? C.pinkDark : C.blue, lineHeight: 1.4 }}>
                        {cameraMode === "pi"
                            ? t.launchPiWindowPrompt
                            : t.nextScreenAppCamera}
                    </div>
                }
            </div>
            {!ageGroup && cameraMode === "pi" && (
                <div style={themedCard({ marginBottom: 16 })}>
                    <AgeCamera onDetected={setAgeGroup} mode="legacy" t={t} />
                </div>
            )}
            {!ageGroup && cameraMode === "app" && (
                <div style={themedCard({ marginBottom: 16, textAlign: "center" })}>
                    <p style={{ color: C.slate, fontSize: scale(16), fontWeight: 600, margin: "0 0 8px" }}>
                        {t.appNoAutoAge}
                    </p>
                    <p style={{ color: C.gray, fontSize: scale(14), lineHeight: 1.5, margin: 0 }}>
                        {t.appChooseAgeDesc}
                    </p>
                </div>
            )}
            <div style={themedCard()}>
                <p style={{ textAlign: "center", color: C.gray, marginBottom: 16, fontSize: scale(14) }}>{t.orManual}</p>
                <div style={{ display: "flex", gap: 10 }}>
                    {(["Child", "Adult", "Senior"] as const).map(g => {
                        const kidSelected = isKidMode && g === "Child" && ageGroup === g
                        return (
                        <button key={g} onClick={() => setAgeGroup(g)} style={{
                            flex: 1,
                            background: ageGroup === g
                                ? (kidSelected ? `linear-gradient(135deg, ${C.pinkLight} 0%, ${C.skyLight} 100%)` : C.blueLight)
                                : C.lightGray,
                            border: `2px solid ${ageGroup === g ? (kidSelected ? C.pink : C.blue) : (isKidMode ? C.kidBorder : C.border)}`,
                            borderRadius: 12, padding: `${Math.round(14 * fs)}px 8px`, cursor: "pointer",
                            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                        }}>
                            <span style={{
                                minWidth: 42, padding: "4px 10px", borderRadius: 999,
                                background: C.white,
                                color: kidSelected ? C.pinkDark : C.blue,
                                fontSize: scale(12),
                                fontWeight: 800,
                                letterSpacing: 0.3,
                            }}>
                                {g === "Child" ? "0-17" : g === "Adult" ? "18-54" : "55+"}
                            </span>
                            <span style={{ fontSize: scale(13), fontWeight: 600, color: C.slate }}>
                                {t[g.toLowerCase() as keyof typeof t]}
                            </span>
                        </button>
                        )
                    })}
                </div>
                <button
                    onClick={() => setStep("camera")}
                    style={{ ...outlineBtn(), marginTop: 14 }}
                >
                    {t.changeCameraMode}
                </button>
            </div>
        </Screen>
    )

    if (step === "card") return (
        <Screen rtl={isRTL} kidMode={isKidMode}>
            <BackButton label={t.back} onClick={goBack} rtl={isRTL} disabled={backDisabled} fontScale={fs} />
            {isKidMode ? (
                <KidGraphicBanner
                    badge={t.child}
                    title={t.scanCard}
                    subtitle={cameraMode === "pi" ? t.healthCardPiMode : t.healthCardAppMode}
                    variant={1}
                />
            ) : (
                <>
                    <h2 style={{ fontSize: scale(20), fontWeight: 700, color: C.slate, marginBottom: 20, textAlign: "center" }}>
                        {t.scanCard}
                    </h2>
                    <p style={{ textAlign: "center", color: C.gray, margin: "0 0 14px", fontSize: scale(14) }}>
                        {cameraMode === "pi"
                            ? t.healthCardPiMode
                            : t.healthCardAppMode}
                    </p>
                </>
            )}
            {cardMode === "scan" ? (
                <div style={themedCard({ marginBottom: 12 })}>
                    {cameraMode === "app"
                        ? <BrowserCardCamera onCapture={handleCardCapture} scanning={scanningCard} t={t} />
                        : <LiveCamera onCapture={handleCardCapture} scanning={scanningCard} t={t} />}
                    <button
                        onClick={() => setCardMode("manual")}
                        style={{ ...outlineBtn(), marginTop: 4 }}
                    >
                        {t.enterManual}
                    </button>
                    <button
                        onClick={() => setStep("camera")}
                        style={{ ...outlineBtn(), marginTop: 10 }}
                    >
                        {t.changeCameraMode}
                    </button>
                </div>
            ) : (
                <div style={themedCard({ display: "flex", flexDirection: "column", gap: 16 })}>
                    <div>
                        <label style={{ fontSize: scale(14), fontWeight: 600, color: C.slate, display: "block", marginBottom: 6 }}>
                            {t.name}
                        </label>
                        <input
                            value={manualName}
                            onChange={e => setManualName(e.target.value)}
                            style={{
                                width: "100%", padding: "14px 16px", borderRadius: 10,
                                border: outlineBorder, fontSize: scale(16),
                                boxSizing: "border-box", outline: "none",
                            }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: scale(14), fontWeight: 600, color: C.slate, display: "block", marginBottom: 6 }}>
                            {t.healthId}
                        </label>
                        <input
                            value={manualId}
                            onChange={e => setManualId(e.target.value)}
                            style={{
                                width: "100%", padding: "14px 16px", borderRadius: 10,
                                border: outlineBorder, fontSize: scale(16),
                                boxSizing: "border-box", outline: "none",
                            }}
                        />
                    </div>
                    <button
                        onClick={() => {
                            setBodyPart(null)
                            setQuestions([])
                            setAnswers({})
                            setQIndex(0)
                            setStep("body")
                        }}
                        disabled={!manualName || !manualId}
                        style={actionBtn(manualName && manualId ? primaryAction : C.border)}
                    >
                        {t.submit}
                    </button>
                    <button onClick={() => setCardMode("scan")} style={{ ...outlineBtn() }}>
                        {t.backToCamera}
                    </button>
                </div>
            )}
        </Screen>
    )

    if (step === "body") {
        return (
            <Screen rtl={isRTL} kidMode={isKidMode}>
                <BackButton label={t.back} onClick={goBack} rtl={isRTL} fontScale={fs} />
                <div style={themedCard({ marginTop: isKidMode ? 12 : 16 })}>
                    <h2 style={{ fontSize: scale(22), fontWeight: 700, color: C.slate, textAlign: "center", margin: "0 0 8px" }}>
                        {t.whereHurts}
                    </h2>
                    <p style={{ color: C.gray, fontSize: scale(14), textAlign: "center", margin: "0 0 22px", lineHeight: 1.5 }}>
                        {t.whereHurtsDesc}
                    </p>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                        <BodySilhouette selected={bodyPart} onSelect={setBodyPart} t={t} />
                    </div>
                    {bodyPart && (
                        <button
                            onClick={() => handleBodySelect(bodyPart)}
                            style={{ ...actionBtn(primaryAction), marginTop: 22 }}
                        >
                            {t.continueToQuestions}
                        </button>
                    )}
                </div>
            </Screen>
        )
    }

    if (step === "questions" && questions.length > 0) {
        const q = questions[qIndex]
        const qText = q.text
        return (
            <Screen rtl={isRTL} kidMode={isKidMode}>
                <ProgressBar step={qIndex + 1} total={questions.length} kidMode={isKidMode} />
                {isKidMode && (
                    <KidGraphicBanner
                        badge={t.child}
                        title={qText}
                        step={qIndex + 1}
                        total={questions.length}
                        variant={qIndex}
                    />
                )}
                <div style={themedCard({ marginTop: isKidMode ? 12 : 16 })}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 32 }}>
                        <button
                            onClick={() => speak(qText)}
                            style={{
                                background: isKidMode
                                    ? `linear-gradient(135deg, ${C.pink} 0%, ${C.sky} 100%)`
                                    : C.blue,
                                border: "none", borderRadius: 50,
                                minWidth: scale(72), height: scale(46), cursor: "pointer", flexShrink: 0,
                                display: "flex", alignItems: "center", justifyContent: "center", fontSize: scale(20),
                                boxShadow: isKidMode ? "0 8px 18px rgba(236,72,153,0.22)" : undefined,
                            }}
                            title={t.playQuestionTitle}
                        >
                            <span style={{ color: "#fff", fontSize: scale(14), fontWeight: 700 }}>{t.play}</span>
                        </button>
                        {isKidMode ? (
                            <div style={{ flex: 1, display: "grid", gap: 10 }}>
                                <div style={{ fontSize: scale(14), fontWeight: 700, color: C.pinkDark }}>
                                    {t.playQuestionTitle}
                                </div>
                                <div style={{
                                    height: 12,
                                    borderRadius: 999,
                                    background: `linear-gradient(90deg, ${C.pinkLight} 0%, ${C.skyLight} 100%)`,
                                }} />
                            </div>
                        ) : (
                            <p style={{ fontSize: scale(22), fontWeight: 600, color: C.slate, lineHeight: 1.4, margin: 0 }}>
                                {qText}
                            </p>
                        )}
                    </div>
                    <div style={{ display: "flex", gap: 16 }}>
                        <button
                            onClick={() => handleAnswer(q.id, true)}
                            disabled={submitting}
                            style={{ ...actionBtn(primaryAction), flex: 1, fontSize: scale(20), padding: `${Math.round(20 * fs)}px`, opacity: submitting ? 0.6 : 1 }}
                        >
                            {t.yes}
                        </button>
                        <button
                            onClick={() => handleAnswer(q.id, false)}
                            disabled={submitting}
                            style={{ ...actionBtn(secondaryAction), flex: 1, fontSize: scale(20), padding: `${Math.round(20 * fs)}px`, opacity: submitting ? 0.6 : 1 }}
                        >
                            {t.no}
                        </button>
                    </div>
                </div>
            </Screen>
        )
    }

    if (step === "complete") return (
        <Screen rtl={isRTL} kidMode={isKidMode}>
            <div style={themedCard({ textAlign: "center", padding: 52 })}>
                <div style={{
                    width: 72, height: 72, margin: "0 auto 20px", borderRadius: "50%",
                    background: isKidMode
                        ? `linear-gradient(135deg, ${C.pinkLight} 0%, ${C.skyLight} 100%)`
                        : "#DCFCE7",
                    color: isKidMode ? C.pinkDark : "#166534",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, fontWeight: 800,
                }} />
                {isKidMode ? (
                    <KidGraphicBanner
                        badge={t.child}
                        title={t.complete}
                        subtitle={t.seated}
                        variant={2}
                    />
                ) : (
                    <>
                        <h2 style={{ fontSize: scale(26), fontWeight: 700, color: C.slate, margin: "0 0 14px" }}>
                            {t.complete}
                        </h2>
                        <p style={{ fontSize: scale(18), color: C.gray, lineHeight: 1.6, maxWidth: 300, margin: "0 auto 36px" }}>
                            {t.seated}
                        </p>
                    </>
                )}
                <button onClick={reset} style={outlineBtn(isKidMode ? C.pinkDark : C.slate)}>
                    {t.startNewCheckin}
                </button>
            </div>
        </Screen>
    )

    return null
}

function Screen({
    children,
    rtl,
    kidMode = false,
}: {
    children: React.ReactNode
    rtl?: boolean
    kidMode?: boolean
}) {
    return (
        <div style={{
            minHeight: "100vh",
            background: kidMode
                ? "radial-gradient(circle at top left, #FFF0F8 0%, #FDFBFF 42%, #EFF8FF 100%)"
                : "#F8FAFC",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            padding: 24, direction: rtl ? "rtl" : "ltr",
            fontFamily: "'Segoe UI', system-ui, sans-serif",
        }}>
            <div style={{ width: "100%", maxWidth: 480 }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
                    <Logo size={36} />
                </div>
                {children}
            </div>
        </div>
    )
}


