"""
FastER AI Server — Complete Backend
Routes:
  GET  /ping                         → health check
  POST /scan-card                    → health card OCR via Gemini Vision
  POST /speak                        → text-to-speech (any language)
  POST /score-priority               → yes/no answers → CTAS priority 1-5
  POST /triage-ai                    → AI-powered triage via Gemini
  GET  /questions/<body_part>        → triage questions by body part
  POST /queue                        → add patient to queue
  GET  /queue                        → get queue (filter by ?status=)
  PATCH /queue/<id>/nurse-verify     → nurse verifies + adjusts priority
  PATCH /queue/<id>/verify           → receptionist calls patient
  DELETE /queue/<id>                 → remove patient
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
from gtts import gTTS
import pygame
import base64
import os
import json
import tempfile
import time
from pathlib import Path
from datetime import datetime
from uuid import uuid4
from dotenv import load_dotenv

# ── Try Supabase (optional) ───────────────────────────────────
try:
    from supabase import create_client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / ".env")

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# ── Gemini Setup ──────────────────────────────────────────────
GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
if GEMINI_KEY:
    genai.configure(api_key=GEMINI_KEY)
    model = genai.GenerativeModel("gemini-1.5-flash")
else:
    model = None
    print("[WARN] No GEMINI_API_KEY — AI routes will return fallbacks")

# ── Audio Setup ───────────────────────────────────────────────
try:
    pygame.mixer.init()
    AUDIO_OK = True
except Exception as e:
    AUDIO_OK = False
    print(f"[WARN] pygame audio not available: {e}")

# ── Supabase Setup ────────────────────────────────────────────
supabase = None
if SUPABASE_AVAILABLE:
    SUPABASE_URL = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
    if SUPABASE_URL and SUPABASE_KEY:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("[OK] Supabase connected")
    else:
        print("[WARN] SUPABASE_URL/KEY not set — using in-memory queue")
else:
    print("[WARN] supabase-py not installed — using in-memory queue")

# ── In-memory fallback queue ──────────────────────────────────
_local_queue: list[dict] = []
_next_id: int = 1

# ── CTAS Prompting System ─────────────────────────────────────
CTAS_SYSTEM = """
You are a LHSC (London Health Sciences Centre) Triage Nurse AI using CTAS (Canadian Triage and Acuity Scale).

CTAS Levels:
5 - Resuscitation (immediate life threat — chest pain, breathing failure, unconscious)
4 - Emergent (seen within 15 min — severe pain, high fever, head injury)
3 - Urgent (seen within 30 min — moderate pain, vomiting with dehydration)
2 - Less Urgent (seen within 60 min — minor injuries, mild symptoms)
1 - Non-Urgent (seen within 120 min — routine complaints)

Rules:
- Chest pain OR breathing difficulty → ALWAYS Level 4 or 5
- Children and elderly → increase urgency by 1 level
- Multiple serious symptoms → highest urgency wins
- DO NOT diagnose, ONLY assign CTAS level

Return STRICT JSON only, no markdown:
{"ctas_level": 1-5, "reason": "short explanation under 20 words", "action": "what patient should do next"}
"""

# ── Triage Questions (CTAS-aligned) ──────────────────────────
TRIAGE_QUESTIONS = {
    "chest": [
        {"id": "chest_pain", "text": "Do you have chest pain?"},
        {"id": "radiating_pain", "text": "Does the pain go to your arm or jaw?"},
        {"id": "difficulty_breathing", "text": "Are you having difficulty breathing?"},
    ],
    "head": [
        {"id": "headache", "text": "Do you have a severe headache?"},
        {"id": "vision", "text": "Are you having vision problems?"},
        {"id": "dizziness", "text": "Do you feel dizzy or lightheaded?"},
    ],
    "neck": [
        {"id": "neck_pain", "text": "Do you have neck pain?"},
        {"id": "stiffness", "text": "Is your neck stiff?"},
        {"id": "fever", "text": "Do you have a fever?"},
    ],
    "stomach": [
        {"id": "abdominal_pain", "text": "Do you have stomach pain?"},
        {"id": "vomiting", "text": "Are you vomiting?"},
        {"id": "duration", "text": "Has it lasted more than 3 hours?"},
    ],
}

# ── Helper: Priority Scoring ──────────────────────────────────
def score_answers(answers: dict, age_group: str = "Adult") -> dict:
    """Deterministic CTAS scoring from yes/no answers."""
    score = 1

    if answers.get("chest_pain"):           score += 3
    if answers.get("difficulty_breathing"): score += 3
    if answers.get("radiating_pain"):       score += 2
    if answers.get("dizziness"):            score += 2
    if answers.get("severe_pain"):          score += 2
    if answers.get("fever"):                score += 1
    if answers.get("vomiting"):             score += 1
    if answers.get("headache"):             score += 1

    # Age adjustment
    if age_group in ("Child", "Senior"):
        score += 1

    priority = min(score, 5)

    level_map = {5: "critical", 4: "urgent", 3: "moderate", 2: "low", 1: "minor"}
    color_map = {5: "red", 4: "orange", 3: "yellow", 2: "green", 1: "green"}

    return {
        "priority": priority,
        "level": level_map.get(priority, "minor"),
        "color": color_map.get(priority, "green"),
    }

# ── Helper: Supabase or local queue ──────────────────────────
def queue_add(row: dict) -> dict:
    if supabase:
        result = supabase.table("patients").insert(row).execute()
        return result.data[0] if result.data else row
    else:
        global _next_id
        row["id"] = _next_id
        _next_id += 1
        _local_queue.append(row)
        return row

def queue_get(statuses: list[str] = None) -> list[dict]:
    if supabase:
        q = supabase.table("patients").select("*").order("ai_priority", desc=True).order("timestamp")
        if statuses:
            q = q.in_("status", statuses)
        result = q.execute()
        return result.data or []
    else:
        data = _local_queue[:]
        if statuses:
            data = [p for p in data if p.get("status") in statuses]
        return sorted(data, key=lambda p: (-p.get("ai_priority", 1), p.get("timestamp", "")))

def queue_patch(patient_id: int, updates: dict) -> bool:
    if supabase:
        supabase.table("patients").update(updates).eq("id", patient_id).execute()
        return True
    else:
        for p in _local_queue:
            if p.get("id") == patient_id:
                p.update(updates)
                return True
        return False


def finalize_patient_row(patient_id: int | None, row: dict) -> tuple[dict, bool]:
    """Update an existing draft patient row when possible, otherwise create a new row."""
    if patient_id and queue_patch(patient_id, row):
        return {"id": patient_id, **row}, False
    saved = queue_add(row)
    return saved, True

# ─────────────────────────────────────────────────────────────
# ROUTES
# ─────────────────────────────────────────────────────────────

@app.route("/ping", methods=["GET"])
def ping():
    return jsonify({
        "status": "ok",
        "message": "FastER AI server running",
        "gemini": bool(model),
        "supabase": bool(supabase),
        "audio": AUDIO_OK,
    })


@app.route("/scan-card", methods=["POST"])
def scan_card():
    """Extract patient name + health ID from health card image."""
    try:
        data = request.get_json() or {}
        b64_image = data.get("image", "")
        patient_id = data.get("patient_id")

        if not b64_image:
            return jsonify({"name": "Unknown", "health_id": "N/A", "patient_id": patient_id})

        result = {"name": "Unknown", "health_id": "N/A"}

        if model:
            image_bytes = base64.b64decode(b64_image)
            image_part = {"mime_type": "image/jpeg", "data": image_bytes}

            prompt = (
                "This is a health card or government ID. "
                "Extract the full name and the health card number or ID number. "
                "Reply ONLY with valid JSON, no markdown or backticks:\n"
                '{"name": "Full Name", "health_id": "1234567890"}\n'
                'If not found, use "Unknown" for name and "N/A" for health_id.'
            )

            response = model.generate_content([prompt, image_part])
            raw = response.text.strip().replace("```json", "").replace("```", "")
            result = json.loads(raw)

        saved, created = finalize_patient_row(
            int(patient_id) if patient_id else None,
            {
                "name": result.get("name", "Unknown") or "Unknown",
                "health_id": result.get("health_id", "N/A") or "N/A",
                "lang": data.get("lang", "en"),
                "age_group": data.get("age_group", "Adult"),
                "status": "draft",
                "timestamp": datetime.utcnow().isoformat() + "Z",
            },
        )
        result["patient_id"] = saved.get("id")

        print(f"[/scan-card] {'Created' if created else 'Updated'} draft {saved.get('id')}: {result}")
        return jsonify(result)

    except Exception as e:
        print(f"[/scan-card] Error: {e}")
        return jsonify({"name": "Unknown", "health_id": "N/A"})


@app.route("/speak", methods=["POST"])
def speak():
    """Convert text to speech and play it through the kiosk speaker."""
    try:
        data = request.get_json()
        text = data.get("text", "")
        lang = data.get("lang", "en")

        if not text:
            return jsonify({"status": "skipped"})

        lang_map = {"en": "en", "ar": "ar", "fr": "fr", "pa": "pa", "zh": "zh", "es": "es"}
        gtts_lang = lang_map.get(lang, "en")

        tts = gTTS(text=text, lang=gtts_lang, slow=False)

        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as f:
            temp_path = f.name

        tts.save(temp_path)

        if AUDIO_OK:
            pygame.mixer.music.load(temp_path)
            pygame.mixer.music.play()
            while pygame.mixer.music.get_busy():
                pygame.time.wait(100)

        os.unlink(temp_path)

        print(f"[/speak] Spoke in {lang}: {text[:60]}")
        return jsonify({"status": "spoken"})

    except Exception as e:
        print(f"[/speak] Error: {e}")
        return jsonify({"status": "error", "message": str(e)})


@app.route("/score-priority", methods=["POST"])
def score_priority():
    """Deterministic CTAS scoring from yes/no symptom answers."""
    try:
        data = request.get_json() or {}
        answers = data.get("answers", {})
        age_group = data.get("age_group", "Adult")
        result = score_answers(answers, age_group)
        print(f"[/score-priority] → Priority {result['priority']} ({result['level']})")
        return jsonify(result)

    except Exception as e:
        print(f"[/score-priority] Error: {e}")
        return jsonify({"priority": 1, "level": "minor", "color": "green"})


@app.route("/triage-ai", methods=["POST"])
def triage_ai():
    """AI-powered CTAS triage using Gemini. Falls back to deterministic scoring."""
    try:
        data = request.get_json() or {}
        answers = data.get("answers", {})
        age_group = data.get("age_group", "Adult")
        body_part = data.get("body_part", "")

        # Deterministic fallback always computed
        fallback = score_answers(answers, age_group)

        if not model:
            return jsonify({
                "ctas_level": fallback["priority"],
                "reason": "Scored by rule engine (AI unavailable)",
                "action": "Please wait to be called",
                "source": "rule_engine",
            })

        # Build symptom summary for AI
        positive = [k for k, v in answers.items() if v]
        negative = [k for k, v in answers.items() if not v]
        symptom_text = (
            f"Patient age group: {age_group}. "
            f"Area of concern: {body_part or 'general'}. "
            f"Symptoms present: {', '.join(positive) or 'none'}. "
            f"Symptoms absent: {', '.join(negative) or 'none'}."
        )

        response = model.generate_content(
            [CTAS_SYSTEM, f"Triage this patient:\n{symptom_text}"]
        )
        raw = response.text.strip().replace("```json", "").replace("```", "")
        result = json.loads(raw)

        print(f"[/triage-ai] Gemini → CTAS {result.get('ctas_level')}: {result.get('reason')}")
        return jsonify({**result, "source": "gemini"})

    except Exception as e:
        print(f"[/triage-ai] Error: {e} — using rule fallback")
        fb = score_answers(data.get("answers", {}), data.get("age_group", "Adult"))
        return jsonify({
            "ctas_level": fb["priority"],
            "reason": "Scored by rule engine (AI error)",
            "action": "Please wait to be called",
            "source": "rule_engine",
        })


@app.route("/questions/<body_part>", methods=["GET"])
def get_questions(body_part):
    questions = TRIAGE_QUESTIONS.get(body_part, [])
    return jsonify({"questions": questions})


# ── Queue Management ──────────────────────────────────────────

@app.route("/queue", methods=["POST"])
def queue_post():
    """Add a new patient to the queue after kiosk check-in."""
    try:
        data = request.get_json() or {}
        answers = data.get("answers", {})
        age_group = data.get("age_group", "Adult")
        patient_id = data.get("patient_id")

        # Score priority
        scoring = score_answers(answers, age_group)

        # Try AI upgrade if Gemini available
        ai_reason = "Scored by rule engine"
        if model:
            try:
                positive = [k for k, v in answers.items() if v]
                symptom_text = f"Patient age group: {age_group}. Symptoms present: {', '.join(positive) or 'none'}."
                ai_resp = model.generate_content([CTAS_SYSTEM, f"Triage:\n{symptom_text}"])
                raw = ai_resp.text.strip().replace("```json", "").replace("```", "")
                ai_data = json.loads(raw)
                if "ctas_level" in ai_data:
                    scoring["priority"] = ai_data["ctas_level"]
                    ai_reason = ai_data.get("reason", "AI triage")
            except Exception as e:
                print(f"[/queue POST] AI failed, using rule engine: {e}")

        row = {
            "name": data.get("name", "Unknown"),
            "health_id": data.get("health_id", "N/A"),
            "lang": data.get("lang", "en"),
            "age_group": age_group,
            "answers": answers,
            "ai_priority": scoring["priority"],
            "nurse_priority": None,
            "ai_reason": ai_reason,
            "status": "pending_nurse",
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }

        saved, created = finalize_patient_row(int(patient_id) if patient_id else None, row)
        print(f"[/queue POST] {'Added' if created else 'Updated'}: {row['name']} → Priority {scoring['priority']}")
        return jsonify({"success": True, "id": saved.get("id"), "ai_priority": scoring["priority"]}), 201

    except Exception as e:
        print(f"[/queue POST] Error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/queue", methods=["GET"])
def queue_get_route():
    """Get queue. Optional ?status=pending_nurse,nurse_verified,receptionist_verified"""
    try:
        status_param = request.args.get("status", "")
        statuses = [s.strip() for s in status_param.split(",") if s.strip()] if status_param else None
        data = queue_get(statuses)
        return jsonify(data)
    except Exception as e:
        print(f"[/queue GET] Error: {e}")
        return jsonify([])


@app.route("/queue/<int:patient_id>/nurse-verify", methods=["PATCH"])
def nurse_verify(patient_id):
    """Nurse reviews and verifies patient priority, sends to receptionist."""
    try:
        data = request.get_json()
        nurse_priority = data.get("nurse_priority")
        updates = {
            "status": "nurse_verified",
            "nurse_priority": nurse_priority,
            "nurse_verified_at": datetime.utcnow().isoformat() + "Z",
        }
        queue_patch(patient_id, updates)
        print(f"[/nurse-verify] Patient {patient_id} → nurse_priority={nurse_priority}")
        return jsonify({"success": True})
    except Exception as e:
        print(f"[/nurse-verify] Error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/queue/<int:patient_id>/verify", methods=["PATCH"])
def receptionist_verify(patient_id):
    """Receptionist calls/sees the patient."""
    try:
        updates = {
            "status": "receptionist_verified",
            "called_at": datetime.utcnow().isoformat() + "Z",
        }
        queue_patch(patient_id, updates)
        print(f"[/verify] Patient {patient_id} called by receptionist")
        return jsonify({"success": True})
    except Exception as e:
        print(f"[/verify] Error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/queue/<int:patient_id>", methods=["DELETE"])
def queue_delete(patient_id):
    """Remove a patient from the queue."""
    try:
        if supabase:
            supabase.table("patients").delete().eq("id", patient_id).execute()
        else:
            global _local_queue
            _local_queue = [p for p in _local_queue if p.get("id") != patient_id]
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Start ─────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 55)
    print("  FastER AI Server")
    print(f"  Port:    5001")
    print(f"  Gemini:  {'✓ Connected' if model else '✗ No API key'}")
    print(f"  Supabase:{'✓ Connected' if supabase else '✗ Using in-memory queue'}")
    print(f"  Audio:   {'✓ pygame ready' if AUDIO_OK else '✗ No audio'}")
    print("=" * 55)
    app.run(host="0.0.0.0", port=5001, debug=True)
