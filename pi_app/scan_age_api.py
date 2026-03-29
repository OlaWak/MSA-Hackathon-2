import base64
import os
from collections import deque
from pathlib import Path
from threading import Event, Lock, Thread
import time
from typing import Optional
from uuid import uuid4

import cv2
import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from supabase import create_client

from detect_age_pi import AgeScanner, CAMERA_INDEX

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


class AgeScanRequest(BaseModel):
    images: list[str] = Field(default_factory=list)


class FaceGuideRequest(BaseModel):
    image: str


class CameraDebugRequest(BaseModel):
    event: str
    details: dict = Field(default_factory=dict)


camera_debug_events: list[dict] = []


def record_camera_debug(event: str, details: Optional[dict] = None):
    entry = {
        "event": event,
        "details": details or {},
    }
    camera_debug_events.append(entry)
    if len(camera_debug_events) > 200:
        del camera_debug_events[:-100]
    print(f"[camera-debug] {entry['event']} {entry['details']}")
    return entry


def decode_frame(image_b64: str):
    try:
        image_bytes = base64.b64decode(image_b64)
        np_buffer = np.frombuffer(image_bytes, dtype=np.uint8)
        return cv2.imdecode(np_buffer, cv2.IMREAD_COLOR)
    except Exception:
        return None


def open_camera_capture():
    preferred_indices = [CAMERA_INDEX, 1, 2, 3]
    seen = set()
    api_preferences = [cv2.CAP_ANY]
    if hasattr(cv2, "CAP_V4L2"):
        api_preferences.insert(0, cv2.CAP_V4L2)

    for camera_index in preferred_indices:
        if camera_index in seen:
            continue
        seen.add(camera_index)

        for api_preference in api_preferences:
            cap = cv2.VideoCapture(camera_index, api_preference)
            try:
                if hasattr(cv2, "CAP_PROP_BUFFERSIZE"):
                    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

                if not cap.isOpened():
                    cap.release()
                    continue

                frame = None
                for _ in range(15):
                    ret, candidate = cap.read()
                    if ret and candidate is not None and getattr(candidate, "size", 0) > 0:
                        frame = candidate
                    time.sleep(0.04)

                if frame is not None:
                    return cap, frame, camera_index
            except Exception:
                cap.release()
                raise

            cap.release()

    return None, None, None


class CameraFeed:
    def __init__(self):
        self._lock = Lock()
        self._stop_event = Event()
        self._thread: Optional[Thread] = None
        self._last_frame = None
        self._last_frame_at = 0.0
        self._recent_frames = deque(maxlen=30)
        self._camera_index: Optional[int] = None
        self._error = "Camera not started"

    def start(self):
        if self._thread and self._thread.is_alive():
            return

        self._stop_event.clear()
        self._thread = Thread(target=self._reader_loop, name="camera-feed", daemon=True)
        self._thread.start()

    def stop(self):
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=1.0)
        self._thread = None

    def restart(self):
        self.stop()
        with self._lock:
            self._last_frame = None
            self._last_frame_at = 0.0
            self._recent_frames.clear()
            self._camera_index = None
            self._error = "Restarting camera feed"
        self.start()

    def _reader_loop(self):
        cap = None
        camera_index = None

        try:
            while not self._stop_event.is_set():
                if cap is None:
                    cap, first_frame, camera_index = open_camera_capture()
                    if cap is None or first_frame is None:
                        with self._lock:
                            self._error = "Could not open USB camera"
                            self._camera_index = None
                        time.sleep(0.35)
                        continue

                    self._store_frame(first_frame, camera_index)

                ret, frame = cap.read()
                if not ret or frame is None or getattr(frame, "size", 0) == 0:
                    cap.release()
                    cap = None
                    camera_index = None
                    with self._lock:
                        self._error = "Camera stream stalled"
                        self._camera_index = None
                    time.sleep(0.15)
                    continue

                self._store_frame(frame, camera_index)
                time.sleep(0.03)
        finally:
            if cap is not None:
                cap.release()

    def _store_frame(self, frame, camera_index):
        frame_copy = frame.copy()
        timestamp = time.time()
        with self._lock:
            self._last_frame = frame_copy
            self._last_frame_at = timestamp
            self._recent_frames.append((timestamp, frame_copy))
            self._camera_index = camera_index
            self._error = ""

    def get_latest_frame(self, wait_timeout=1.0):
        self.start()
        deadline = time.time() + wait_timeout

        while time.time() < deadline:
            with self._lock:
                frame = None if self._last_frame is None else self._last_frame.copy()
                camera_index = self._camera_index
                error = self._error
                frame_age = time.time() - self._last_frame_at if self._last_frame_at else None

            if frame is not None and (frame_age is None or frame_age < 1.5):
                return frame, camera_index, None

            time.sleep(0.05)

        return None, None, error or "Could not open USB camera"

    def get_recent_frames(self, frame_count=5, max_wait=1.0, max_age=2.0):
        self.start()
        deadline = time.time() + max_wait
        frames = []
        camera_index = None
        error = self._error

        while time.time() < deadline:
            now = time.time()
            with self._lock:
                frames = [
                    frame.copy()
                    for ts, frame in self._recent_frames
                    if now - ts <= max_age
                ]
                camera_index = self._camera_index
                error = self._error

            if len(frames) >= frame_count:
                return frames[-frame_count:], camera_index, None

            time.sleep(0.05)

        if frames:
            return frames[-frame_count:], camera_index, None

        return [], None, error or "Could not open USB camera"


camera_feed = CameraFeed()
legacy_scan_lock = Lock()
legacy_scan_active = Event()


def encode_camera_frame(frame, camera_index):
    ok, encoded = cv2.imencode(".jpg", frame)
    if not ok:
        return None, None, None, "Could not encode camera frame"

    metadata = {
        "camera_index": camera_index,
        "width": int(frame.shape[1]),
        "height": int(frame.shape[0]),
    }
    face_state = inspect_face_state(frame)
    return encoded.tobytes(), metadata, face_state, None


def capture_camera_jpeg_once():
    cap, frame, camera_index = open_camera_capture()
    if cap is None or frame is None:
        return None, None, None, "Could not open USB camera"

    try:
        for _ in range(3):
            ret, candidate = cap.read()
            if ret and candidate is not None and getattr(candidate, "size", 0) > 0:
                frame = candidate
            time.sleep(0.03)
    finally:
        cap.release()

    return encode_camera_frame(frame, camera_index)


def capture_camera_jpeg():
    frame, camera_index, error = camera_feed.get_latest_frame(wait_timeout=2.0)
    if frame is not None:
        return encode_camera_frame(frame, camera_index)

    record_camera_debug("camera_feed_retry", {"error": error or "Could not open USB camera"})
    camera_feed.restart()

    frame, camera_index, retry_error = camera_feed.get_latest_frame(wait_timeout=2.4)
    if frame is not None:
        return encode_camera_frame(frame, camera_index)

    jpeg_bytes, metadata, face_state, direct_error = capture_camera_jpeg_once()
    if jpeg_bytes is not None:
        record_camera_debug(
            "camera_frame_direct_capture",
            {"camera_index": metadata.get("camera_index")},
        )
        return jpeg_bytes, metadata, face_state, None

    final_error = direct_error or retry_error or error or "Could not open USB camera"
    return None, None, None, final_error


def capture_camera_frames(frame_count=5, frame_delay=0.08):
    max_wait = max(frame_count * frame_delay * 2, 1.0)
    return camera_feed.get_recent_frames(
        frame_count=frame_count,
        max_wait=max_wait,
        max_age=max(frame_count * frame_delay * 4, 2.0),
    )


def run_legacy_window_scan():
    if not legacy_scan_lock.acquire(blocking=False):
        return {
            "success": False,
            "error": "Age scan already in progress",
        }

    legacy_scan_active.set()
    camera_feed.stop()
    record_camera_debug("legacy_scan_window_open")

    try:
        return scanner.scan_age_group(show_ui=True)
    except Exception as exc:
        return {
            "success": False,
            "error": f"Legacy Pi camera scan failed: {exc}",
        }
    finally:
        legacy_scan_active.clear()
        legacy_scan_lock.release()
        time.sleep(0.25)
        camera_feed.restart()


def inspect_face_state(frame):
    try:
        faces = scanner._detect_faces(frame)
    except Exception:
        return {"face_detected": False, "face_centered": False, "box": None}

    if not faces:
        return {"face_detected": False, "face_centered": False, "box": None}

    chosen_face = faces[0]
    centered = scanner._is_face_centered(chosen_face, frame.shape)
    x, y, w, h = [int(v) for v in chosen_face]
    frame_h, frame_w = frame.shape[:2]
    return {
        "face_detected": True,
        "face_centered": centered,
        "box": {
            "x": round(x / frame_w, 4) if frame_w else 0,
            "y": round(y / frame_h, 4) if frame_h else 0,
            "w": round(w / frame_w, 4) if frame_w else 0,
            "h": round(h / frame_h, 4) if frame_h else 0,
        },
    }


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


@app.on_event("startup")
def startup_camera_feed():
    camera_feed.start()


@app.on_event("shutdown")
def shutdown_camera_feed():
    camera_feed.stop()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/camera-frame")
def camera_frame():
    if legacy_scan_active.is_set():
        deadline = time.time() + 0.8
        while legacy_scan_active.is_set() and time.time() < deadline:
            time.sleep(0.05)

    if legacy_scan_active.is_set():
        message = "Age scan is running on the Pi display"
        return Response(
            content=message,
            status_code=503,
            media_type="text/plain",
            headers={
                "Cache-Control": "no-store",
                "X-Camera-Error": message,
            },
        )

    jpeg_bytes, metadata, face_state, error = capture_camera_jpeg()
    if jpeg_bytes is None:
        record_camera_debug("camera_frame_error", {"error": error or "Camera unavailable"})
        return Response(
            content=error or "Camera unavailable",
            status_code=503,
            media_type="text/plain",
            headers={
                "Cache-Control": "no-store",
                "X-Camera-Error": error or "Camera unavailable",
            },
        )

    face_box = face_state["box"] if face_state else None

    return Response(
        content=jpeg_bytes,
        media_type="image/jpeg",
        headers={
            "Cache-Control": "no-store",
            "X-Camera-Index": str(metadata["camera_index"]),
            "X-Frame-Width": str(metadata["width"]),
            "X-Frame-Height": str(metadata["height"]),
            "X-Face-Detected": "1" if face_state["face_detected"] else "0",
            "X-Face-Centered": "1" if face_state["face_centered"] else "0",
            "X-Face-Box-X": str(face_box["x"]) if face_box else "",
            "X-Face-Box-Y": str(face_box["y"]) if face_box else "",
            "X-Face-Box-W": str(face_box["w"]) if face_box else "",
            "X-Face-Box-H": str(face_box["h"]) if face_box else "",
        },
    )


@app.get("/camera-debug")
def camera_debug_get():
    return {"events": camera_debug_events[-100:]}


@app.post("/face-guide")
def face_guide(payload: FaceGuideRequest):
    frame = decode_frame(payload.image)
    if frame is None or getattr(frame, "size", 0) == 0:
        return {
            "success": False,
            "error": "Invalid frame",
            "face_detected": False,
            "face_centered": False,
            "box": None,
        }

    face_state = inspect_face_state(frame)
    return {
        "success": True,
        **face_state,
    }


@app.post("/camera-debug")
def camera_debug_post(payload: CameraDebugRequest):
    record_camera_debug(payload.event, payload.details)
    return {"ok": True, "count": len(camera_debug_events)}


@app.post("/scan-age")
def scan_age(payload: Optional[AgeScanRequest] = None):
    record_camera_debug(
        "scan_age_start",
        {
            "mode": "frames" if payload and payload.images else "legacy_window",
            "payload_images": len(payload.images) if payload and payload.images else 0,
        },
    )

    if payload and payload.images:
        frames = [decode_frame(image) for image in payload.images if image]
        result = scanner.scan_age_frames(frames, confidence_threshold=0.24)
    else:
        result = run_legacy_window_scan()

    if not result.get("success"):
        record_camera_debug("scan_age_error", result)
        return result

    db_id = save_scan_result(result)

    response_payload = {
        "success": True,
        "db_id": db_id,
        "age_bucket": result.get("age_bucket"),
        "age_group": result.get("age_group"),
        "confidence": result.get("confidence"),
        "next_step": result.get("next_step"),
        "samples_used": result.get("samples_used"),
        "fallback": result.get("fallback", False),
        "message": result.get("message"),
        "camera_index": result.get("camera_index"),
    }
    record_camera_debug(
        "scan_age_result",
        {
            "age_group": response_payload["age_group"],
            "age_bucket": response_payload["age_bucket"],
            "fallback": response_payload["fallback"],
            "samples_used": response_payload["samples_used"],
            "camera_index": result.get("camera_index"),
        },
    )

    return response_payload
