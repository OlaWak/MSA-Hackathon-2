import os
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from collections import Counter
import time
from pathlib import Path

try:
    import tflite_runtime.interpreter as tflite
except ImportError:
    # LiteRT is Google's current replacement for tflite-runtime and has
    # newer ARM wheels, including Python 3.13 aarch64 builds.
    from ai_edge_litert.interpreter import Interpreter as LiteRTInterpreter

    class _LiteRTModule:
        Interpreter = LiteRTInterpreter

    tflite = _LiteRTModule()

# --- Configuration ---
BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = str(BASE_DIR / "age_model.tflite")
LABELS_PATH = str(BASE_DIR / "labels.txt")
CAMERA_INDEX = 0
IMG_SIZE = 128

# Try these fonts in order
FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
    str(BASE_DIR / "DMSans-Bold.ttf"),
]

BOX_COLOR_READY = (0, 255, 0)
BOX_COLOR_WAIT = (0, 0, 255)

DEFAULT_FALLBACK = {
    "success": True,
    "age_group": "Adult",
    "confidence": 0.0,
    "next_step": "adult_center",
    "fallback": True,
}


def open_scan_camera():
    preferred_indices = [CAMERA_INDEX, 1, 2, 3]
    seen = set()
    api_preference = cv2.CAP_V4L2 if hasattr(cv2, "CAP_V4L2") else cv2.CAP_ANY

    for camera_index in preferred_indices:
        if camera_index in seen:
            continue
        seen.add(camera_index)

        cap = cv2.VideoCapture(camera_index, api_preference)
        try:
            if hasattr(cv2, "CAP_PROP_BUFFERSIZE"):
                cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

            if not cap.isOpened():
                cap.release()
                continue

            frame = None
            for _ in range(8):
                ret, candidate = cap.read()
                if ret and candidate is not None and getattr(candidate, "size", 0) > 0:
                    frame = candidate

            if frame is not None:
                return cap, camera_index
        except Exception:
            cap.release()
            raise

        cap.release()

    return None, None

def load_labels(path):
    try:
        with open(path, "r") as f:
            return [line.strip() for line in f if line.strip()]
    except FileNotFoundError:
        return []

def map_bucket_to_group(bucket_label):
    child_buckets = {"0-2", "3-7", "8-12", "13-17"}
    adult_buckets = {"18-24", "25-34", "35-44", "45-54"}
    senior_buckets = {"55-64", "65+"}

    if bucket_label in child_buckets:
        return "Child"
    elif bucket_label in adult_buckets:
        return "Adult"
    elif bucket_label in senior_buckets:
        return "Senior"
    return "Unknown"

def map_group_to_next_step(age_group):
    mapping = {
        "Child": "child_center",
        "Adult": "adult_center",
        "Senior": "senior_center"
    }
    return mapping.get(age_group, "manual_review")

def preprocess_face(face_bgr):
    face_rgb = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2RGB)
    img = Image.fromarray(face_rgb).resize((IMG_SIZE, IMG_SIZE))
    img = np.array(img, dtype=np.float32) / 255.0
    return np.expand_dims(img, axis=0)

class AgeScanner:
    def __init__(self):
        self.labels = load_labels(LABELS_PATH)
        self.interpreter = tflite.Interpreter(model_path=MODEL_PATH)
        self.interpreter.allocate_tensors()
        self.input_details = self.interpreter.get_input_details()
        self.output_details = self.interpreter.get_output_details()
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )

        font_path = None
        for candidate in FONT_CANDIDATES:
            if os.path.exists(candidate):
                font_path = candidate
                break

        try:
            if font_path is None:
                raise FileNotFoundError("No usable font file found")

            self.font_main = ImageFont.truetype(font_path, 48)
            self.font_sub = ImageFont.truetype(font_path, 30)
            print(f"Using font: {font_path}")

        except Exception as e:
            print(f"Font not found. Using default. Error: {e}")
            self.font_main = ImageFont.load_default()
            self.font_sub = ImageFont.load_default()

    def _draw_ui(self, frame, status, instruction, color):
        img_pil = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        draw = ImageDraw.Draw(img_pil)

        main_pos = (28, 16)
        sub_pos = (30, 72)

        draw.text(
            main_pos,
            status,
            font=self.font_main,
            fill=(color[2], color[1], color[0])
        )
        draw.text(
            sub_pos,
            instruction,
            font=self.font_sub,
            fill=(255, 255, 255)
        )

        return cv2.cvtColor(np.array(img_pil), cv2.COLOR_RGB2BGR)

    def predict_face_bucket(self, face_bgr):
        input_data = preprocess_face(face_bgr)
        self.interpreter.set_tensor(self.input_details[0]["index"], input_data)
        self.interpreter.invoke()
        output_data = self.interpreter.get_tensor(self.output_details[0]["index"])[0]
        pred_index = int(np.argmax(output_data))
        confidence = float(np.max(output_data))

        bucket_label = (
            self.labels[pred_index]
            if self.labels and pred_index < len(self.labels)
            else str(pred_index)
        )
        return bucket_label, confidence

    def _detect_faces(self, frame_bgr):
        gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
        normalized = cv2.equalizeHist(gray)

        detection_passes = (
            (normalized, 1.08, 5, (48, 48)),
            (normalized, 1.1, 4, (36, 36)),
            (gray, 1.1, 3, (28, 28)),
        )

        for source, scale_factor, min_neighbors, min_size in detection_passes:
            faces = self.face_cascade.detectMultiScale(
                source,
                scaleFactor=scale_factor,
                minNeighbors=min_neighbors,
                minSize=min_size
            )
            if len(faces) > 0:
                return sorted(faces, key=lambda f: f[2] * f[3], reverse=True)

        return []

    def _crop_face(self, frame_bgr, face_box):
        x, y, w, h = [int(v) for v in face_box]
        fh, fw = frame_bgr.shape[:2]
        pad_x = int(w * 0.18)
        pad_top = int(h * 0.22)
        pad_bottom = int(h * 0.12)
        y1, y2 = max(0, y - pad_top), min(fh, y + h + pad_bottom)
        x1, x2 = max(0, x - pad_x), min(fw, x + w + pad_x)
        return frame_bgr[y1:y2, x1:x2]

    def _finalize_predictions(self, predictions):
        if not predictions:
            return dict(DEFAULT_FALLBACK)

        most_common = Counter([p[0] for p in predictions]).most_common(1)[0][0]
        age_grp = map_bucket_to_group(most_common)
        avg_conf = sum(p[1] for p in predictions) / len(predictions)

        return {
            "success": True,
            "age_bucket": most_common,
            "age_group": age_grp,
            "confidence": round(avg_conf, 4),
            "next_step": map_group_to_next_step(age_grp),
            "samples_used": len(predictions),
            "fallback": False,
        }

    def _is_face_centered(self, face_box, frame_shape):
        x, y, w, h = face_box
        fh, fw = frame_shape[:2]

        if fw == 0 or fh == 0:
            return False

        dx_ratio = abs((x + w / 2) - fw / 2) / fw
        dy_ratio = abs((y + h / 2) - fh / 2) / fh
        face_area_ratio = (w * h) / (fw * fh)

        return dx_ratio < 0.24 and dy_ratio < 0.24 and 0.03 < face_area_ratio < 0.72

    def scan_age_frames(self, frames_bgr, confidence_threshold=0.35):
        centered_predictions = []
        near_center_predictions = []
        saw_face = False

        for frame in frames_bgr:
            if frame is None or getattr(frame, "size", 0) == 0:
                continue

            faces = self._detect_faces(frame)
            if not faces:
                continue

            chosen_face = faces[0]
            saw_face = True

            face_img = self._crop_face(frame, chosen_face)
            if face_img.size == 0:
                continue

            try:
                bucket, conf = self.predict_face_bucket(face_img)
                if conf < confidence_threshold:
                    continue

                if self._is_face_centered(chosen_face, frame.shape):
                    centered_predictions.append((bucket, conf))
                else:
                    near_center_predictions.append((bucket, conf))
            except Exception:
                pass

        if centered_predictions:
            return self._finalize_predictions(centered_predictions)

        if near_center_predictions:
            result = self._finalize_predictions(near_center_predictions)
            result["used_offcenter_face"] = True
            result["message"] = "Captured from a slightly off-center face"
            return result

        fallback = dict(DEFAULT_FALLBACK)
        fallback["message"] = (
            "Face found, but move a little closer to the middle"
            if saw_face else
            "No face detected"
        )
        return fallback

    def scan_age_group(
        self,
        frames_to_sample=8,
        confidence_threshold=0.35,
        show_ui=True,
        timeout_seconds=20
    ):
        cap, camera_index = open_scan_camera()

        if cap is None:
            print("Camera error — defaulting to Adult.")
            return DEFAULT_FALLBACK

        predictions = []
        ready_streak = 0
        start_time = time.time()

        if show_ui:
            cv2.namedWindow("Age Scan", cv2.WINDOW_NORMAL)
            cv2.setWindowProperty("Age Scan", cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_FULLSCREEN)

        try:
            print(f"Using camera index {camera_index} for age scan.")
            while True:
                ret, frame = cap.read()
                if not ret or frame is None:
                    continue

                fh, fw = frame.shape[:2]
                faces = self._detect_faces(frame)

                status_text = "SCANNING"
                instruction_text = "Please look at the camera"
                box_color = BOX_COLOR_WAIT

                if len(faces) > 0:
                    faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
                    chosen_face = faces[0]
                    x, y, w, h = chosen_face

                    if self._is_face_centered(chosen_face, frame.shape):
                        ready_streak += 1
                        status_text = "HOLD STILL"
                        instruction_text = "Analyzing your age..."
                        box_color = BOX_COLOR_READY

                        face_img = self._crop_face(frame, chosen_face)

                        if face_img.size > 0:
                            try:
                                bucket, conf = self.predict_face_bucket(face_img)
                                if conf >= confidence_threshold:
                                    predictions.append((bucket, conf))
                            except Exception:
                                pass
                    else:
                        ready_streak = 0
                        status_text = "POSITION"
                        instruction_text = "Center your face in the frame"
                        box_color = BOX_COLOR_WAIT

                    cv2.rectangle(frame, (x, y), (x + w, y + h), box_color, 3)
                else:
                    ready_streak = 0

                frame = self._draw_ui(frame, status_text, instruction_text, box_color)

                if show_ui:
                    cv2.imshow("Age Scan", frame)
                    if cv2.waitKey(1) & 0xFF == ord("q"):
                        print("Cancelled — defaulting to Adult.")
                        return DEFAULT_FALLBACK

                if len(predictions) >= frames_to_sample and ready_streak >= 3:
                    break

                if time.time() - start_time > timeout_seconds:
                    print("Timeout — defaulting to Adult.")
                    if predictions:
                        break
                    return DEFAULT_FALLBACK

        finally:
            cap.release()
            cv2.destroyAllWindows()

        if not predictions:
            print("No face data collected — defaulting to Adult.")
            return DEFAULT_FALLBACK

        return self._finalize_predictions(predictions)

if __name__ == "__main__":
    scanner = AgeScanner()
    print(scanner.scan_age_group())
