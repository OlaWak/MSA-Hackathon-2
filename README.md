# FastER — AI-Powered Patient Check-In Kiosk

> Smart ER check-in: multilingual · age-adaptive · CTAS triage · nurse verification → receptionist queue

---

## System Architecture

```
[Raspberry Pi]
  pi_app/scan_age_api.py  (FastAPI, port 8000)
  pi_app/detect_age_pi.py (TFLite age model)
        ↓ POST /scan-age → { age_group, confidence, next_step }
        ↓
[Kiosk Browser]                    [Flask AI Server] (port 5001)
  frontend/kiosk/app.tsx  ──────→  server/app.py
    1. Language select                  /scan-card   (Gemini Vision OCR)
    2. Age detection (Pi camera)        /speak       (gTTS → speaker)
    3. Health card scan (webcam)        /queue POST  (add patient)
    4. 7 yes/no CTAS questions          /triage-ai   (Gemini CTAS scoring)
    5. "Please take a seat"                  ↓
                                      [Supabase DB]
                                             ↓
                              ┌──────────────┴──────────────┐
                    [Nurse Dashboard]             [Receptionist Dashboard]
                    dashboard/nurse/page.tsx      dashboard/receptionist/page.tsx
                    - Reviews AI priority          - Sorted by CTAS priority
                    - Adjusts if needed            - "Call Patient" button
                    - Verifies → receptionist      - Auto-refresh every 4s
```

---

## Port Map

| Service | File | Port | Env var |
|---------|------|------|---------|
| Pi age API | `pi_app/scan_age_api.py` | **8000** | `NEXT_PUBLIC_PI_SERVER` |
| Flask AI server | `server/app.py` | **5001** | `NEXT_PUBLIC_AI_SERVER` |

The kiosk uses BOTH. The dashboards use only `AI_SERVER`.

---

## Known Bug in pi_app (do not modify pi_app files)

`pi_app/scan_age_api.py` tries to read `result["age_bucket"]` and `result["samples_used"]`
but `detect_age_pi.py` does not return those keys — the Pi API will throw a KeyError.

The kiosk catches this and falls back to Adult automatically. Patients can always select age manually. No fix needed on your side.

---

## Setup

### 1. Supabase
Create a project at supabase.com, run `server/schema.sql` in the SQL editor, copy Project URL + anon key.

### 2. server/.env
```
GEMINI_API_KEY=your_key
SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_KEY=your_anon_key
```

### 3. Flask AI Server
```bash
cd server && pip install -r requirements.txt && python app.py
```

### 4. Raspberry Pi (unchanged)
```bash
cd pi_app
uvicorn scan_age_api:app --host 0.0.0.0 --port 8000
```

### 5. frontend/.env.local and dashboard/.env.local
```
NEXT_PUBLIC_PI_SERVER=http://<pi-ip>:8000
NEXT_PUBLIC_AI_SERVER=http://<server-ip>:5001
```

### 6. Run frontends
```bash
cd frontend && npm install && npm run dev   # kiosk
cd dashboard && npm install && npm run dev  # /nurse and /receptionist routes
```

---

## CTAS Priority

| Level | Name | Target | Triggers |
|-------|------|--------|----------|
| 5 | Resuscitation | Immediate | Chest pain + breathing |
| 4 | Emergent | 15 min | Chest pain OR breathing |
| 3 | Urgent | 30 min | Dizziness + severe pain |
| 2 | Less Urgent | 60 min | Fever + vomiting |
| 1 | Non-Urgent | 120 min | Headache only |

Child and Senior patients get +1 urgency automatically.

---

## Supported Languages

EN · FR · AR (RTL) · PA · ZH · ES — all questions translated, TTS in all 6.