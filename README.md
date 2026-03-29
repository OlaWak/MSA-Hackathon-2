# FastER - AI-Powered Patient Check-In Kiosk

Smart ER check-in with:

- multilingual kiosk intake
- Raspberry Pi age detection
- health card OCR
- CTAS-style queue scoring
- nurse review
- receptionist call queue
- Supabase storage

## What Actually Runs

The runtime app is made of 4 pieces:

1. `pi_app/`
   This is the Raspberry Pi camera service. It must run on the Pi because it uses OpenCV and the local camera.

2. `server/`
   This is the Flask backend. It handles queue state, Gemini OCR, text-to-speech, and Supabase writes.

3. `frontend/`
   This is the patient kiosk web app.

4. `dashboard/`
   This is the nurse and receptionist web app.

The `training/` folder is not needed to run the app.

## Best Deployment Split

If you want the cleanest demo:

- Raspberry Pi:
  - `pi_app` on port `8000`
  - `server` on port `5001`
  - `frontend` on port `3000`
- Laptop or second machine:
  - `dashboard` on port `3001`

You can run the whole stack on the Pi, but the dashboards do not need to be there.

## Request Flow

```text
Kiosk browser
  -> POST http://PI_SERVER:8000/scan-age
  -> POST http://AI_SERVER:5001/scan-card
  -> POST http://AI_SERVER:5001/speak
  -> POST http://AI_SERVER:5001/queue

Nurse dashboard
  -> GET/PATCH http://AI_SERVER:5001/queue

Receptionist dashboard
  -> GET/PATCH http://AI_SERVER:5001/queue

Pi API + Flask server
  -> Supabase
```

## Environment Variables

Create a root `.env` file in the repo:

```env
GEMINI_API_KEY=your_gemini_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_secret_or_service_role_key
```

Notes:

- The Flask server and Pi API both load env vars from either their own folder or the repo root.
- `SUPABASE_KEY` should stay server-side only.
- Do not put Supabase secrets in `frontend/.env.local` or `dashboard/.env.local`.

## Supabase Setup

1. Create a Supabase project.
2. Open the SQL editor.
3. Run [server/schema.sql](/c:/Users/owake/Desktop/MSA-Hackathon-2/server/schema.sql).
4. Put the project URL and secret key in the root `.env`.

Tables used by the app:

- `patients`
- `age_scans`

## Raspberry Pi Setup

Pull the full repo onto the Pi so it includes:

- `pi_app/`
- `server/`
- `frontend/`
- `dashboard/`
- root `.env`

### 1. Test the Pi camera

```bash
cd pi_app
python test_camera.py
```

If it saves `camera_test.jpg`, the camera path is working.

### 2. Install Pi dependencies

```bash
cd pi_app
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Start the Pi age API

```bash
cd pi_app
source .venv/bin/activate
uvicorn scan_age_api:app --host 0.0.0.0 --port 8000
```

Useful check:

```bash
curl http://127.0.0.1:8000/health
```

## Flask Server Setup

### 1. Install backend dependencies

```bash
cd server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Start Flask

```bash
cd server
source .venv/bin/activate
python app.py
```

Useful check:

```bash
curl http://127.0.0.1:5001/ping
```

Expected response fields:

- `status`
- `gemini`
- `supabase`
- `audio`

## Kiosk Frontend Setup

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_PI_SERVER=http://<pi-ip>:8000
NEXT_PUBLIC_AI_SERVER=http://<pi-ip-or-server-ip>:5001
```

Install and run:

```bash
cd frontend
npm install
npm run dev
```

Open:

- `http://<host>:3000`

If the kiosk screen is on the Pi itself, open that URL in the Pi browser.

## Dashboard Setup

Create `dashboard/.env.local`:

```env
NEXT_PUBLIC_AI_SERVER=http://<pi-ip-or-server-ip>:5001
```

Install and run:

```bash
cd dashboard
npm install
npm run dev -- --port 3001
```

Open:

- `http://<host>:3001/nurse`
- `http://<host>:3001/receptionist`

## Exact Run Order For Your Demo

If your goal is "I just want to see the full app visually and connect Supabase", do this exact order:

1. Fill in the root `.env`.
2. Run [server/schema.sql](/c:/Users/owake/Desktop/MSA-Hackathon-2/server/schema.sql) in Supabase.
3. On the Pi, run `python test_camera.py` inside `pi_app/`.
4. On the Pi, start `uvicorn scan_age_api:app --host 0.0.0.0 --port 8000`.
5. On the Pi, start `python app.py` inside `server/`.
6. On the Pi, start `npm run dev` inside `frontend/`.
7. On your laptop or another terminal, start `npm run dev -- --port 3001` inside `dashboard/`.
8. Open the kiosk at `/`.
9. Open `/nurse` and `/receptionist` for the staff views.

## Important Runtime Notes

- The age scan uses the Pi camera through OpenCV.
- The health card scan uses the browser camera through `getUserMedia()`.
- If you use one physical camera for both, the flow is sequential, so the Pi scan releases the camera before the browser scan should need it.
- If Gemini is unavailable, the queue still works with fallback logic.
- If Supabase is unavailable, the Flask server falls back to in-memory queue storage, which is fine for a quick demo but not persistent.

## Troubleshooting

If `/scan-age` fails:

- Make sure `pi_app/age_model.tflite` exists.
- Make sure `pi_app/labels.txt` exists.
- Run `python test_camera.py`.

If Flask says Supabase is disabled:

- Check the root `.env`.
- Check `SUPABASE_URL`.
- Check `SUPABASE_KEY`.
- Restart the Flask process after changing env vars.

If the kiosk loads but API calls fail:

- Check `frontend/.env.local`.
- Use the Pi IP address instead of `localhost` unless the browser is on that same machine.
- Make sure ports `8000` and `5001` are reachable.

If the dashboards stay empty:

- Check `http://<ai-server>:5001/queue`.
- Make sure the kiosk successfully posted to `/queue`.
- Make sure nurse view is using `pending_nurse`.
- Make sure receptionist view is using `nurse_verified,receptionist_verified`.
