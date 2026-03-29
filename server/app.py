"""
FastER AI Server — server/app.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT THIS FILE DOES
  This is the brain of the FastER system. It runs on any
  machine (Pi, laptop, server) and is called by:
    • The kiosk frontend  (scan-card, speak, queue POST)
    • The nurse dashboard (queue GET, nurse-verify)
    • The receptionist dashboard (queue GET, verify)

  It uses:
    • Google Gemini  — health-card OCR + CTAS triage scoring
    • gTTS + pygame  — text-to-speech through the kiosk speaker
    • Supabase       — persistent patient queue (falls back to RAM)

WHERE THE CTAS QUESTIONS COME FROM
  Questions are sourced from the Canadian Triage and Acuity Scale
  (CTAS) guidelines used by LHSC (London Health Sciences Centre).
  The patient first picks a body region on a human silhouette
  (chest / head / arm / leg / abdomen / other).  The server then
  returns 3-4 targeted yes/no questions for that region.
  After the patient answers, Gemini acts as an LHSC triage nurse
  (In-Context Learning / few-shot prompting) and returns a CTAS
  level 1-5 with reasoning.

HOW GEMINI ACTS AS A NURSE  (ICL / few-shot)
  We don't fine-tune a model.  Instead we:
    1. Feed it CTAS rules as a system prompt
    2. Give it a persona ("You are an LHSC triage nurse")
    3. Give it 3 worked examples (few-shot)
  → Gemini "becomes" a triage nurse instantly for each call.

ROUTES
  GET  /ping                         health check
  POST /scan-card                    OCR health card image (Gemini Vision)
  POST /speak                        TTS → speaker (gTTS)
  GET  /questions/<body_part>        CTAS questions for a body region
  POST /triage-ai                    Full Gemini CTAS triage
  POST /queue                        Add patient (scores + stores)
  GET  /queue?status=...             Get queue
  PATCH /queue/<id>/nurse-verify     Nurse verifies priority
  PATCH /queue/<id>/verify           Receptionist calls patient
  DELETE /queue/<id>                 Remove patient
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
from gtts import gTTS
import pygame
import base64, os, json, tempfile
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

try:
    from supabase import create_client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False

# ── Env ───────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / ".env")

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# ── Gemini ────────────────────────────────────────────────────
GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
if GEMINI_KEY:
    genai.configure(api_key=GEMINI_KEY)
    model = genai.GenerativeModel("gemini-1.5-flash")
else:
    model = None
    print("[WARN] No GEMINI_API_KEY — AI routes will use rule-engine fallback")

# ── Audio ─────────────────────────────────────────────────────
try:
    pygame.mixer.init()
    AUDIO_OK = True
except Exception as e:
    AUDIO_OK = False
    print(f"[WARN] pygame audio not available: {e}")

# ── Supabase ──────────────────────────────────────────────────
supabase = None
if SUPABASE_AVAILABLE:
    SB_URL = os.getenv("SUPABASE_URL", "")
    SB_KEY = os.getenv("SUPABASE_KEY", "")
    if SB_URL and SB_KEY:
        supabase = create_client(SB_URL, SB_KEY)
        print("[OK] Supabase connected")
    else:
        print("[WARN] SUPABASE_URL/KEY not set — using in-memory queue")

_local_queue: list[dict] = []
_next_id: int = 1

# ══════════════════════════════════════════════════════════════
# CTAS / LHSC TRIAGE DATA
#
# Source: Canadian Triage and Acuity Scale (CTAS) National
# Guidelines 2022 / LHSC Emergency Department protocol.
# Questions are Yes/No only, designed to be spoken aloud.
#
# Body parts shown on the human silhouette:
#   chest, head, arm, leg, abdomen, other
# ══════════════════════════════════════════════════════════════

TRIAGE_QUESTIONS = {
    # CTAS: Chest complaints — highest risk of Level 4-5
    "chest": [
        {"id": "chest_pain",        "text": "Do you have chest pain or pressure?"},
        {"id": "radiating_pain",    "text": "Does the pain spread to your arm, jaw, or back?"},
        {"id": "difficulty_breathing", "text": "Are you having difficulty breathing?"},
        {"id": "sweating",          "text": "Are you sweating or feeling clammy?"},
    ],
    # CTAS: Head / neurological complaints
    "head": [
        {"id": "severe_headache",   "text": "Do you have a sudden or very severe headache?"},
        {"id": "vision_change",     "text": "Do you have blurred or double vision?"},
        {"id": "dizziness",         "text": "Do you feel dizzy or unsteady?"},
        {"id": "confusion",         "text": "Are you feeling confused or disoriented?"},
    ],
    # CTAS: Upper extremity — arm, shoulder, hand
    "arm": [
        {"id": "arm_pain",          "text": "Do you have pain or swelling in your arm or shoulder?"},
        {"id": "numbness",          "text": "Do you have numbness or tingling in your arm or hand?"},
        {"id": "injury",            "text": "Did you injure or fall on your arm recently?"},
        {"id": "weakness",          "text": "Do you have weakness or inability to move your arm?"},
    ],
    # CTAS: Lower extremity — leg, knee, hip, foot
    "leg": [
        {"id": "leg_pain",          "text": "Do you have pain or swelling in your leg, knee, or hip?"},
        {"id": "leg_injury",        "text": "Did you injure your leg, knee, or ankle recently?"},
        {"id": "leg_numbness",      "text": "Do you have numbness or weakness in your leg or foot?"},
        {"id": "cannot_walk",       "text": "Are you unable to walk or bear weight on your leg?"},
    ],
    # CTAS: Abdominal complaints
    "abdomen": [
        {"id": "abdominal_pain",    "text": "Do you have stomach or abdominal pain?"},
        {"id": "vomiting",          "text": "Have you been vomiting?"},
        {"id": "pain_duration",     "text": "Has the pain lasted more than 6 hours?"},
        {"id": "fever",             "text": "Do you have a fever?"},
    ],
    # Other / systemic — covers vomiting, fainting, allergic, etc.
    "other": [
        {"id": "fainting",          "text": "Did you faint, pass out, or nearly pass out?"},
        {"id": "allergic_reaction", "text": "Do you have a rash, hives, or swollen face?"},
        {"id": "fever_other",       "text": "Do you have a high fever (above 38.5°C / 101°F)?"},
        {"id": "general_weakness",  "text": "Are you feeling very weak or unusually tired?"},
    ],
}

# ══════════════════════════════════════════════════════════════
# GEMINI  IN-CONTEXT LEARNING  PROMPT
#
# This is NOT model training.
# We give Gemini:
#   • The CTAS rules as a system persona
#   • 3 worked examples (few-shot) so it learns the output format
#   • The actual patient data
# Gemini then "acts like an LHSC triage nurse" for that one call.
# ══════════════════════════════════════════════════════════════

CTAS_ICL_PROMPT = """
You are an LHSC (London Health Sciences Centre) Emergency Department Triage Nurse.
You use the Canadian Triage and Acuity Scale (CTAS) to assign urgency.

━━━━ CTAS LEVELS ━━━━
1 - Resuscitation   → Immediate (cardiac arrest, unconscious, severe breathing failure)
2 - Emergent        → Within 15 min (chest pain + radiation, stroke signs, severe allergic)
3 - Urgent          → Within 30 min (moderate chest pain, high fever with stiff neck)
4 - Less Urgent     → Within 60 min (minor injuries, mild pain, low-grade fever)
5 - Non-Urgent      → Within 120 min (minor complaints, stable chronic issues)

━━━━ RULES ━━━━
- Chest pain OR difficulty breathing → MINIMUM Level 2
- Chest pain + radiation + sweating → Level 1
- Fainting/loss of consciousness → Level 2
- Severe headache (sudden onset) → Level 2 (possible subarachnoid hemorrhage)
- Children (age < 18) and Seniors (age 55+): increase urgency 1 level
- Multiple serious symptoms: use the highest urgency
- DO NOT diagnose. ONLY assign CTAS level + brief reason.

━━━━ OUTPUT FORMAT ━━━━
Return STRICT valid JSON only. No markdown, no backticks, no extra text:
{"ctas_level": <1-5>, "reason": "<max 25 words>", "action": "<what patient should do>"}

━━━━ FEW-SHOT EXAMPLES ━━━━

Example 1:
Patient: Adult. Area: chest.
Symptoms YES: chest_pain, radiating_pain, difficulty_breathing, sweating
Symptoms NO: (none)
Output: {"ctas_level": 1, "reason": "Chest pain with radiation and breathing difficulty — possible MI", "action": "Immediate assessment required"}

Example 2:
Patient: Senior (55+). Area: head.
Symptoms YES: severe_headache, dizziness
Symptoms NO: vision_change, confusion
Output: {"ctas_level": 2, "reason": "Sudden severe headache in senior — rule out subarachnoid bleed", "action": "Seen within 15 minutes"}

Example 3:
Patient: Adult. Area: leg.
Symptoms YES: leg_pain, leg_injury
Symptoms NO: leg_numbness, cannot_walk
Output: {"ctas_level": 4, "reason": "Leg injury with pain, ambulatory — minor orthopaedic complaint", "action": "Seen within 60 minutes"}

Example 4:
Patient: Child. Area: other.
Symptoms YES: fever_other
Symptoms NO: fainting, allergic_reaction, general_weakness
Output: {"ctas_level": 3, "reason": "High fever in child — increase urgency per paediatric protocol", "action": "Seen within 30 minutes"}

━━━━ NOW TRIAGE THIS PATIENT ━━━━
"""

# ══════════════════════════════════════════════════════════════
# DETERMINISTIC FALLBACK SCORING
# Used when Gemini is unavailable or fails
# ══════════════════════════════════════════════════════════════

SYMPTOM_WEIGHTS = {
    # Chest
    "chest_pain": 3, "radiating_pain": 2, "difficulty_breathing": 3, "sweating": 1,
    # Head
    "severe_headache": 2, "vision_change": 2, "dizziness": 1, "confusion": 3,
    # Arm
    "arm_pain": 1, "numbness": 1, "injury": 1, "weakness": 2,
    # Leg
    "leg_pain": 1, "leg_injury": 1, "leg_numbness": 1, "cannot_walk": 2,
    # Abdomen
    "abdominal_pain": 1, "vomiting": 1, "pain_duration": 1, "fever": 1,
    # Other
    "fainting": 3, "allergic_reaction": 2, "fever_other": 1, "general_weakness": 1,
}

def score_answers(answers: dict, age_group: str = "Adult") -> dict:
    score = 1
    for sym_id, weight in SYMPTOM_WEIGHTS.items():
        if answers.get(sym_id):
            score += weight
    if age_group in ("Child", "Senior"):
        score += 1
    priority = min(score, 5)
    level_map = {5: "critical", 4: "urgent", 3: "moderate", 2: "low", 1: "minor"}
    return {"priority": priority, "level": level_map.get(priority, "minor")}

# ══════════════════════════════════════════════════════════════
# SUPABASE / LOCAL QUEUE HELPERS
# ══════════════════════════════════════════════════════════════

def queue_add(row: dict) -> dict:
    if supabase:
        result = supabase.table("patients").insert(row).execute()
        return result.data[0] if result.data else row
    global _next_id
    row["id"] = _next_id
    _next_id += 1
    _local_queue.append(row)
    return row

def queue_get(statuses: list[str] | None = None) -> list[dict]:
    if supabase:
        q = supabase.table("patients").select("*") \
            .order("ai_priority", desc=True) \
            .order("timestamp", desc=False)
        if statuses:
            q = q.in_("status", statuses)
        return q.execute().data or []
    data = _local_queue[:]
    if statuses:
        data = [p for p in data if p.get("status") in statuses]
    return sorted(data, key=lambda p: (-p.get("ai_priority", 1), p.get("timestamp", "")))

def queue_patch(patient_id: int, updates: dict) -> bool:
    if supabase:
        supabase.table("patients").update(updates).eq("id", patient_id).execute()
        return True
    for p in _local_queue:
        if p.get("id") == patient_id:
            p.update(updates)
            return True
    return False

# ══════════════════════════════════════════════════════════════
# ROUTES
# ══════════════════════════════════════════════════════════════

@app.route("/ping", methods=["GET"])
def ping():
    return jsonify({
        "status": "ok", "server": "FastER AI",
        "gemini": bool(model), "supabase": bool(supabase), "audio": AUDIO_OK,
    })


# ── Health Card OCR ───────────────────────────────────────────
# Receives a base64 JPEG captured by the kiosk webcam.
# Gemini Vision reads the card and extracts name + health number.
@app.route("/scan-card", methods=["POST"])
def scan_card():
    try:
        data = request.get_json()
        b64_image = data.get("image", "")
        if not b64_image or not model:
            return jsonify({"name": "Unknown", "health_id": "N/A"})

        image_bytes = base64.b64decode(b64_image)
        image_part = {"mime_type": "image/jpeg", "data": image_bytes}

        prompt = (
            "This is an Ontario health card or Canadian government ID.\n"
            "Extract the full name and the health card number (10-digit Ontario number, or equivalent).\n"
            "Return ONLY valid JSON with no markdown or backticks:\n"
            "{\"name\": \"Full Name\", \"health_id\": \"1234567890\"}\n"
            "If you cannot read a value, use \"Unknown\" for name and \"N/A\" for health_id."
        )

        response = model.generate_content([prompt, image_part])
        raw = response.text.strip().replace("```json", "").replace("```", "").strip()
        result = json.loads(raw)
        print(f"[/scan-card] Extracted: {result}")
        return jsonify(result)

    except Exception as e:
        print(f"[/scan-card] Error: {e}")
        return jsonify({"name": "Unknown", "health_id": "N/A"})


# ── Text-to-Speech ────────────────────────────────────────────
# gTTS converts the question text to audio in the patient's
# language and plays it through the Pi speaker via pygame.
@app.route("/speak", methods=["POST"])
def speak():
    try:
        data = request.get_json()
        text = data.get("text", "")
        lang = data.get("lang", "en")
        if not text:
            return jsonify({"status": "skipped"})

        lang_map = {"en": "en", "ar": "ar", "fr": "fr", "pa": "pa", "zh": "zh", "es": "es"}
        tts = gTTS(text=text, lang=lang_map.get(lang, "en"), slow=False)

        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as f:
            temp_path = f.name
        tts.save(temp_path)

        if AUDIO_OK:
            pygame.mixer.music.load(temp_path)
            pygame.mixer.music.play()
            while pygame.mixer.music.get_busy():
                pygame.time.wait(100)

        os.unlink(temp_path)
        print(f"[/speak] {lang}: {text[:60]}")
        return jsonify({"status": "spoken"})

    except Exception as e:
        print(f"[/speak] Error: {e}")
        return jsonify({"status": "error", "message": str(e)})


# ── CTAS Questions by Body Part ───────────────────────────────
# Called by the kiosk after patient selects a body region
# on the human silhouette.
@app.route("/questions/<body_part>", methods=["GET"])
def get_questions(body_part: str):
    questions = TRIAGE_QUESTIONS.get(body_part.lower(), [])
    return jsonify({"body_part": body_part, "questions": questions})


# ── AI Triage (Gemini ICL) ────────────────────────────────────
# Called internally by /queue POST (and can be called directly
# for testing).  Uses the CTAS_ICL_PROMPT above.
@app.route("/triage-ai", methods=["POST"])
def triage_ai():
    try:
        data = request.get_json()
        answers   = data.get("answers", {})
        age_group = data.get("age_group", "Adult")
        body_part = data.get("body_part", "other")

        fallback = score_answers(answers, age_group)

        if not model:
            return jsonify({
                "ctas_level": fallback["priority"],
                "reason": "Rule-engine (Gemini unavailable)",
                "action": "Please wait to be called",
                "source": "rule_engine",
            })

        positive = [k for k, v in answers.items() if v]
        negative = [k for k, v in answers.items() if not v]
        patient_desc = (
            f"Patient: {age_group}. Area: {body_part}.\n"
            f"Symptoms YES: {', '.join(positive) or 'none'}\n"
            f"Symptoms NO: {', '.join(negative) or 'none'}"
        )

        response = model.generate_content(CTAS_ICL_PROMPT + patient_desc)
        raw = response.text.strip().replace("```json", "").replace("```", "").strip()
        result = json.loads(raw)
        print(f"[/triage-ai] Gemini CTAS {result.get('ctas_level')}: {result.get('reason')}")
        return jsonify({**result, "source": "gemini"})

    except Exception as e:
        print(f"[/triage-ai] Error: {e} — rule fallback")
        fb = score_answers(data.get("answers", {}), data.get("age_group", "Adult"))
        return jsonify({
            "ctas_level": fb["priority"],
            "reason": "Rule-engine (Gemini error)",
            "action": "Please wait to be called",
            "source": "rule_engine",
        })


# ── Add Patient to Queue ──────────────────────────────────────
@app.route("/queue", methods=["POST"])
def queue_post():
    try:
        data      = request.get_json()
        answers   = data.get("answers", {})
        age_group = data.get("age_group", "Adult")
        body_part = data.get("body_part", "other")

        # Start with deterministic score
        scoring   = score_answers(answers, age_group)
        ai_reason = "Scored by rule engine"

        # Try Gemini upgrade
        if model:
            try:
                positive = [k for k, v in answers.items() if v]
                negative = [k for k, v in answers.items() if not v]
                patient_desc = (
                    f"Patient: {age_group}. Area: {body_part}.\n"
                    f"Symptoms YES: {', '.join(positive) or 'none'}\n"
                    f"Symptoms NO: {', '.join(negative) or 'none'}"
                )
                resp = model.generate_content(CTAS_ICL_PROMPT + patient_desc)
                raw  = resp.text.strip().replace("```json", "").replace("```", "").strip()
                ai   = json.loads(raw)
                if "ctas_level" in ai:
                    scoring["priority"] = int(ai["ctas_level"])
                    ai_reason = ai.get("reason", "Gemini CTAS")
            except Exception as e:
                print(f"[/queue] Gemini failed: {e}")

        row = {
            "name":             data.get("name", "Unknown"),
            "health_id":        data.get("health_id", "N/A"),
            "lang":             data.get("lang", "en"),
            "age_group":        age_group,
            "body_part":        body_part,
            "answers":          answers,
            "ai_priority":      scoring["priority"],
            "nurse_priority":   None,
            "ai_reason":        ai_reason,
            "status":           "pending_nurse",
            "timestamp":        datetime.utcnow().isoformat() + "Z",
        }

        saved = queue_add(row)
        print(f"[/queue] Added: {row['name']} | {body_part} | CTAS {scoring['priority']}")
        return jsonify({"success": True, "id": saved.get("id"), "ai_priority": scoring["priority"]}), 201

    except Exception as e:
        print(f"[/queue POST] Error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/queue", methods=["GET"])
def queue_get_route():
    try:
        status_param = request.args.get("status", "")
        statuses = [s.strip() for s in status_param.split(",") if s.strip()] if status_param else None
        return jsonify(queue_get(statuses))
    except Exception as e:
        print(f"[/queue GET] Error: {e}")
        return jsonify([])


@app.route("/queue/<int:patient_id>/nurse-verify", methods=["PATCH"])
def nurse_verify(patient_id: int):
    try:
        data = request.get_json()
        updates = {
            "status":           "nurse_verified",
            "nurse_priority":   data.get("nurse_priority"),
            "nurse_verified_at": datetime.utcnow().isoformat() + "Z",
        }
        queue_patch(patient_id, updates)
        print(f"[/nurse-verify] Patient {patient_id} → {updates['nurse_priority']}")
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/queue/<int:patient_id>/verify", methods=["PATCH"])
def receptionist_verify(patient_id: int):
    try:
        queue_patch(patient_id, {
            "status":    "receptionist_verified",
            "called_at": datetime.utcnow().isoformat() + "Z",
        })
        print(f"[/verify] Patient {patient_id} called")
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/queue/<int:patient_id>", methods=["DELETE"])
def queue_delete(patient_id: int):
    try:
        if supabase:
            supabase.table("patients").delete().eq("id", patient_id).execute()
        else:
            global _local_queue
            _local_queue = [p for p in _local_queue if p.get("id") != patient_id]
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

        


if __name__ == "__main__":
    print("=" * 55)
    print("  FastER AI Server — server/app.py")
    print(f"  Port    : 5001")
    print(f"  Gemini  : {'✓ Connected' if model else '✗ No key (rule-engine fallback)'}")
    print(f"  Supabase: {'✓ Connected' if supabase else '✗ In-memory queue'}")
    print(f"  Audio   : {'✓ pygame' if AUDIO_OK else '✗ No audio'}")
    print("=" * 55)
    app.run(host="0.0.0.0", port=5001, debug=True)