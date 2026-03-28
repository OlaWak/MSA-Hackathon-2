"""
ai-server/app.py — Person 3's AI Server
Person 1: fill in .env file and run this.

Routes:
  GET  /ping             → health check
  POST /scan-card        → health card OCR via Gemini Vision
  POST /speak            → text-to-speech in any language
  POST /score-priority   → yes/no answers → priority 1-5
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
from dotenv import load_dotenv
from triage_data import TRIAGE_QUESTIONS  # <-- your question file

load_dotenv()

app = Flask(__name__)
CORS(app)

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-1.5-flash")

pygame.mixer.init()


SYSTEM_INSTRUCTION = """
You are an LHSC (London Health Sciences Centre) Triage Nurse AI.

Use CTAS (Canadian Triage and Acuity Scale).

CTAS Levels:
1 - Resuscitation (immediate life threat)
2 - Emergent (seen within 15 min)
3 - Urgent (30 min)
4 - Less Urgent (60 min)
5 - Non-Urgent (120 min)

Rules:
- Chest pain OR breathing problems → Level 1 or 2
- Severe symptoms → increase urgency
- Children/elderly → increase urgency
- DO NOT diagnose
- ONLY assign CTAS level

Return STRICT JSON:

{
  "ctas_level": 1-5,
  "reason": "short explanation",
  "action": "what patient should do"
}
"""


def image_to_part(b64_string):
    return {"mime_type": "image/jpeg", "data": base64.b64decode(b64_string)}


# ── ROUTE 1: Health Check ─────────────────────────────────────
@app.route("/ping", methods=["GET"])
def ping():
    return jsonify({"status": "ok", "message": "Tawfiq AI server running"})


# ── ROUTE 2: Health Card OCR ──────────────────────────────────
# Person 2's kiosk sends a photo of the health card as base64.
# Gemini reads it and returns the patient's name + health number.
@app.route("/scan-card", methods=["POST"])
def scan_card():
    try:
        data      = request.get_json()
        b64_image = data.get("image")

        if not b64_image:
            return jsonify({"name": "Unknown", "health_id": "N/A"})

        image_part = image_to_part(b64_image)

        prompt = """This is a health card or government ID card.
Extract the full name and the health card number or ID number.
Reply ONLY as valid JSON with no extra text, no markdown, no backticks:
{"name": "Full Name Here", "health_id": "1234567890"}
If you cannot find a value, use "Unknown" for name and "N/A" for health_id."""

        response = model.generate_content([prompt, image_part])
        result   = json.loads(response.text.strip())

        print(f"[/scan-card] Extracted: {result}")
        return jsonify(result)

    except Exception as e:
        print(f"[/scan-card] Error: {e}")
        return jsonify({"name": "Unknown", "health_id": "N/A"})


# ── ROUTE 3: Text to Speech ───────────────────────────────────
# Person 2's kiosk sends question text + language code.
# gTTS converts it to audio and plays it through the speaker.
# Supports: en, ar, fr, pa, zh, es
@app.route("/speak", methods=["POST"])
def speak():
    try:
        data = request.get_json()
        text = data.get("text", "")
        lang = data.get("lang", "en")

        lang_map = {
            "en": "en",
            "ar": "ar",
            "fr": "fr",
            "pa": "pa",
            "zh": "zh",
            "es": "es"
        }
        gtts_lang = lang_map.get(lang, "en")

        tts = gTTS(text=text, lang=gtts_lang, slow=False)

        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as f:
            temp_path = f.name

        tts.save(temp_path)
        pygame.mixer.music.load(temp_path)
        pygame.mixer.music.play()

        while pygame.mixer.music.get_busy():
            pygame.time.wait(100)

        os.unlink(temp_path)

        print(f"[/speak] Spoke in {lang}: {text[:50]}")
        return jsonify({"status": "spoken"})

    except Exception as e:
        print(f"[/speak] Error: {e}")
        return jsonify({"status": "error", "message": str(e)})


# ── ROUTE 4: Priority Scoring ─────────────────────────────────
# This is pure logic — no AI needed.
# Patient answers 7 yes/no questions.
# Each symptom adds points. Total capped at 5.
#
# Scoring breakdown:
#   chest_pain           → +3 points (very serious)
#   difficulty_breathing → +3 points (very serious)
#   dizziness            → +2 points (serious)
#   severe_pain          → +2 points (serious)
#   fever                → +1 point  (moderate)
#   vomiting             → +1 point  (moderate)
#   headache             → +1 point  (mild)
#
# Examples:
#   chest_pain + dizziness         = 1+3+2 = 6 → capped at 5 = CRITICAL
#   fever + headache               = 1+1+1 = 3 → MODERATE
#   headache only                  = 1+1   = 2 → LOW
#   nothing                        = 1     = 1 → MINOR
@app.route("/score-priority", methods=["POST"])
def score_priority():
    try:
        data    = request.get_json()
        answers = data.get("answers", {})

        score = 1  # everyone starts at 1 minimum

        if answers.get("chest_pain"):           score += 3
        if answers.get("difficulty_breathing"): score += 3
        if answers.get("dizziness"):            score += 2
        if answers.get("severe_pain"):          score += 2
        if answers.get("fever"):                score += 1
        if answers.get("vomiting"):             score += 1
        if answers.get("headache"):             score += 1

        priority = min(score, 5)  # cap at 5

        if priority >= 4:
            level, color = "critical", "red"
        elif priority == 3:
            level, color = "moderate", "yellow"
        else:
            level, color = "low", "green"

        print(f"[/score-priority] Answers: {answers} → Priority: {priority} ({level})")
        return jsonify({"priority": priority, "level": level, "color": color})

    except Exception as e:
        print(f"[/score-priority] Error: {e}")
        return jsonify({"priority": 1, "level": "low", "color": "green"})

@app.route("/questions/<body_part>", methods=["GET"])
def get_questions(body_part):
    questions = TRIAGE_QUESTIONS.get(body_part, [])
    return jsonify({"questions": questions})


# ── START ─────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 50)
    print("FastER")
    print("Port: 5001")
    print(f"Gemini key loaded: {'YES' if os.getenv('GEMINI_API_KEY') else 'NO — check .env'}")
    print("=" * 50)
    app.run(host="0.0.0.0", port=5001, debug=True)