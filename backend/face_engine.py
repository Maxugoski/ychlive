"""
Face extraction engine for the YCH Live reverse face-search PoC.

Pipeline (per prompt.md §2):
  1. Decode an uploaded image (in-memory only; never written to disk).
  2. Detect faces; if multiple, isolate the LARGEST face box.
  3. Generate a face embedding vector (128-d via face_recognition/dlib when
     installed, otherwise a perceptual OpenCV fallback descriptor).

The engine reports which backend is active so /api/health can surface it.
"""

from __future__ import annotations

import io
import os
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Tuple

import cv2
import numpy as np

# ---------------------------------------------------------------------------
# Backend detection (import-time, cheap)
# ---------------------------------------------------------------------------
try:  # pragma: no cover - optional heavy dependency
    import face_recognition  # dlib-based, 128-d encodings

    HAS_FACE_RECOGNITION = True
except ImportError:
    face_recognition = None
    HAS_FACE_RECOGNITION = False

EMBEDDING_SIZE = 128  # spec §Step2: Qdrant collection vector size


@dataclass
class FaceResult:
    encoding: np.ndarray  # L2-normalised float32 vector, shape (EMBEDDING_SIZE,)
    box: Tuple[int, int, int, int]  # (top, right, bottom, left) in pixels
    area: int


def _decode_image(image_bytes: bytes) -> Optional[np.ndarray]:
    """Decode raw upload bytes into an RGB numpy array, fully in-memory."""
    buf = np.frombuffer(image_bytes, dtype=np.uint8)
    bgr = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    if bgr is None:
        return None
    return cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)


def _box_area(box: Tuple[int, int, int, int]) -> int:
    top, right, bottom, left = box
    return max(0, bottom - top) * max(0, right - left)


# ---------------------------------------------------------------------------
# Primary backend: face_recognition (dlib)
# ---------------------------------------------------------------------------
def _detect_dlib(rgb: np.ndarray) -> List[FaceResult]:
    boxes = face_recognition.face_locations(rgb, model="hog")  # (t,r,b,l)
    encodings = face_recognition.face_encodings(rgb, known_face_locations=boxes)
    results = []
    for box, enc in zip(boxes, encodings):
        vec = np.asarray(enc, dtype=np.float32)
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        results.append(FaceResult(vec, box, _box_area(box)))
    return results


# ---------------------------------------------------------------------------
# Fallback backend: OpenCV detection + perceptual descriptor (LBPH-style)
# Produces a deterministic 128-d vector so both backends share one schema.
#
# Detector preference:
#   1. YuNet DNN (cv2.FaceDetectorYN) when its ONNX model is present under
#      backend/models/ (works on OpenCV 4.x AND 5.x, best accuracy).
#   2. Haar cascade (cv2.CascadeClassifier) - bundled with OpenCV 4.x only.
# ---------------------------------------------------------------------------
_MODEL_DIR = Path(__file__).resolve().parent / "models"
_YUNET_MODEL = _MODEL_DIR / "face_detection_yunet_2023mar.onnx"
_YUNET_SCORE_MIN = float(os.environ.get("YUNET_SCORE_MIN", "0.7"))

_detector_state: dict = {"kind": None, "obj": None, "resolved": False}


def _resolve_detector() -> dict:
    if _detector_state["resolved"]:
        return _detector_state
    # 1) YuNet if model file available (no external download performed here).
    if hasattr(cv2, "FaceDetectorYN") and _YUNET_MODEL.exists():
        try:
            det = cv2.FaceDetectorYN.create(
                str(_YUNET_MODEL), "", (320, 320), _YUNET_SCORE_MIN, 0.3, 5000
            )
            _detector_state.update(kind="yunet", obj=det, resolved=True)
            return _detector_state
        except Exception:
            pass
    # 2) Haar cascade (removed in OpenCV 5.x).
    if hasattr(cv2, "CascadeClassifier"):
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        cc = cv2.CascadeClassifier(cascade_path)
        if not cc.empty():
            _detector_state.update(kind="haar", obj=cc, resolved=True)
            return _detector_state
    _detector_state.update(kind="none", obj=None, resolved=True)
    return _detector_state


def _fallback_detector_name() -> str:
    return _resolve_detector()["kind"] or "none"



def _fallback_encoding(rgb: np.ndarray, box: Tuple[int, int, int, int]) -> np.ndarray:
    """
    128-d perceptual face descriptor:
      - resize face crop to 96x96 grayscale, histogram-equalised
      - 4x4 spatial cells x 8-bin local binary-pattern-histogram = 128 floats
    Weak but functional stand-in for dlib when it isn't installed.
    """
    top, right, bottom, left = box
    crop = rgb[top:bottom, left:right]
    if crop.size == 0:
        crop = rgb  # degenerate box; use whole image
    gray = cv2.cvtColor(crop, cv2.COLOR_RGB2GRAY)
    gray = cv2.resize(gray, (96, 96), interpolation=cv2.INTER_AREA)
    gray = cv2.equalizeHist(gray)

    # Quantised local gradient orientation histogram over 4x4 cells, 8 bins.
    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    mag = cv2.magnitude(gx, gy)
    ang = np.arctan2(gy, gx) % np.pi  # fold to [0, pi)
    bin_idx = (ang / (np.pi / 8)).astype(np.int32) % 8

    feats = []
    cell = 96 // 4
    for cy in range(4):
        for cx in range(4):
            m = mag[cy * cell:(cy + 1) * cell, cx * cell:(cx + 1) * cell]
            b = bin_idx[cy * cell:(cy + 1) * cell, cx * cell:(cx + 1) * cell]
            hist = np.bincount(b.ravel(), weights=m.ravel(), minlength=8)
            feats.extend(hist.tolist())
    vec = np.asarray(feats, dtype=np.float32)  # 4*4*8 = 128
    norm = np.linalg.norm(vec)
    return vec / norm if norm > 0 else vec


def _detect_fallback(rgb: np.ndarray) -> List[FaceResult]:
    st = _resolve_detector()
    kind = st["kind"]
    if kind == "none":
        raise RuntimeError(
            "No usable OpenCV face detector. Install face_recognition (dlib), "
            "or opencv-python 4.x (Haar), or drop the YuNet ONNX model into backend/models/."
        )

    boxes: List[Tuple[int, int, int, int]] = []
    if kind == "yunet":
        bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
        h, w = bgr.shape[:2]
        st["obj"].setInputSize((w, h))
        _, faces = st["obj"].detect(bgr)
        if faces is not None:
            for f in faces:
                x, y, fw, fh = f[:4]
                boxes.append((int(y), int(x + fw), int(y + fh), int(x)))
    else:  # haar
        gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
        gray = cv2.equalizeHist(gray)  # standard preprocessing for Haar detectors
        rects = st["obj"].detectMultiScale(gray, 1.1, 5, minSize=(60, 60))
        # (x, y, w, h) -> (top, right, bottom, left)
        boxes = [(int(y), int(x + w), int(y + h), int(x)) for (x, y, w, h) in rects]

    return [
        FaceResult(_fallback_encoding(rgb, box), box, _box_area(box))
        for box in boxes
    ]



# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def active_backend() -> str:
    if HAS_FACE_RECOGNITION:
        return "face_recognition (dlib, 128-d)"
    return "opencv-" + _fallback_detector_name()


def extract_faces(image_bytes: bytes) -> List[FaceResult]:
    """All faces in an image, sorted largest-first."""
    rgb = _decode_image(image_bytes)
    if rgb is None:
        raise ValueError("UNREADABLE_IMAGE")
    faces = _detect_dlib(rgb) if HAS_FACE_RECOGNITION else _detect_fallback(rgb)
    faces.sort(key=lambda f: f.area, reverse=True)
    return faces


def extract_primary_face(image_bytes: bytes) -> Optional[FaceResult]:
    """Largest detected face, or None if no face found (spec §4)."""
    faces = extract_faces(image_bytes)
    return faces[0] if faces else None


def encode_from_bytes(image_bytes: bytes) -> bytes:
    """Serialise the primary face embedding for storage."""
    face = extract_primary_face(image_bytes)
    if face is None:
        raise ValueError("NO_FACE_DETECTED")
    return face.encoding.astype(np.float32).tobytes()


def thumbnail_b64(image_bytes: bytes, max_side: int = 160) -> str:
    """Base64 JPEG thumbnail of the seeded face crop (for result cards)."""
    import base64

    rgb = _decode_image(image_bytes)
    if rgb is None:
        return ""
    face = extract_primary_face(image_bytes)
    crop = rgb
    if face is not None:
        top, right, bottom, left = face.box
        crop = rgb[top:bottom, left:right]
    h, w = crop.shape[:2]
    scale = max_side / max(h, w) if max(h, w) > max_side else 1.0
    crop = cv2.resize(crop, (int(w * scale), int(h * scale)))
    ok, encoded = cv2.imencode(".jpg", cv2.cvtColor(crop, cv2.COLOR_RGB2BGR),
                               [int(cv2.IMWRITE_JPEG_QUALITY), 80])
    return base64.b64encode(encoded.tobytes()).decode("ascii") if ok else ""


def bytes_from_upload(upload_file_bytes: bytes) -> bytes:
    """Normalise uploaded bytes (kept strictly in-memory per spec §4)."""
    return bytes(io.BytesIO(upload_file_bytes).read())
