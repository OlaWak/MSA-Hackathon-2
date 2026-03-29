import os
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from supabase import create_client

from detect_age_pi import AgeScanner

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / ".env")

app = FastAPI()
scanner = AgeScanner()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

supabase = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def save_scan_result(result, session_id=None, device_name="raspberry-pi"):
    if supabase is None:
        return None

    row = {
        "id": str(uuid4()),
        "age_bucket": result.get("age_bucket"),
        "age_group": result.get("age_group"),
        "confidence": result.get("confidence"),
        "next_step": result.get("next_step"),
        "device_name": device_name,
        "session_id": session_id,
    }

    supabase.table("age_scans").insert(row).execute()
    return row["id"]

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/scan-age")
def scan_age():
    result = scanner.scan_age_group()

    if not result.get("success"):
        return result

    db_id = save_scan_result(result)

    return {
        "success": True,
        "db_id": db_id,
        "age_bucket": result.get("age_bucket"),
        "age_group": result.get("age_group"),
        "confidence": result.get("confidence"),
        "next_step": result.get("next_step"),
        "samples_used": result.get("samples_used"),
        "fallback": result.get("fallback", False),
    }
