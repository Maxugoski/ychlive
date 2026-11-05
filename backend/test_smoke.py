"""Ad-hoc smoke test: uvicorn not required; uses fastapi TestClient.

Seeds a real face photo (OpenCV bundled sample if available), searches with
a re-encoded copy, and verifies the no-face guardrail.
Run from backend/: venv\Scripts\python test_smoke.py
"""
import os
import sys

import cv2
import numpy as np
from fastapi.testclient import TestClient

import main

client = TestClient(main.app)


def bundled_face_bytes():
    """OpenCV wheel ships samples/data/lena.jpg which Haar detects reliably."""
    root = os.path.dirname(os.path.abspath(cv2.data.haarcascades.rstrip("\\/")))
    for cand in (
        os.path.join(root, "samples", "data", "lena.jpg"),
        os.path.join(root, "samples", "data", "messi5.jpg"),
    ):
        if os.path.exists(cand):
            with open(cand, "rb") as f:
                return f.read()
    return None


def make_face(seed: int) -> bytes:
    """A stylised portrait that the Haar cascade reliably detects."""
    img = np.full((300, 300, 3), 235, np.uint8)
    cv2.ellipse(img, (150, 150), (85, 115), 0, 0, 360, (200, 180, 170), -1)   # face
    cv2.ellipse(img, (150, 120), (80, 60), 0, 0, 360, (215, 195, 185), -1)     # forehead
    for ex in (115, 185):                                                     # eyes
        cv2.circle(img, (ex, 135), 16, (70, 60, 60), -1)
        cv2.circle(img, (ex, 135), 7, (30, 30, 30), -1)
    cv2.ellipse(img, (150, 138), (52, 14), 0, 0, 360, (120, 100, 95), -1)      # brow band
    cv2.line(img, (150, 150), (145, 185), (150, 130, 120), 6)                 # nose
    cv2.ellipse(img, (150, 205), (28, 10), 0, 0, 360, (90, 60, 70), -1)        # mouth
    cv2.circle(img, (110, 175), 18, (225, 205, 195), -1)                       # cheeks
    cv2.circle(img, (190, 175), 18, (225, 205, 195), -1)
    rng = np.random.default_rng(seed)
    img = cv2.subtract(img, rng.integers(0, 6, img.shape, dtype=np.uint8))
    ok, buf = cv2.imencode(".png", img)
    return buf.tobytes()


def make_no_face() -> bytes:
    img = np.zeros((200, 200, 3), np.uint8)
    cv2.rectangle(img, (30, 30), (170, 170), (0, 0, 255), -1)
    ok, buf = cv2.imencode(".png", img)
    return buf.tobytes()


failures = []

# 1. health
h = client.get("/api/health").json()
print("health:", h)
assert h["status"] == "ok", "health endpoint broken"

# 2. seed (prefer a real bundled photo; cartoon faces may defeat Haar)
img_a = bundled_face_bytes() or make_face(seed=1)
r = client.post(
    "/api/seed",
    files={"file": ("a.png", img_a, "image/png")},
    data={"name": "Test Person", "social_handle": "@testp", "profile_url": "https://example.com/test"},
)
print("seed:", r.status_code, r.json() if r.status_code == 200 else r.text)
if r.status_code != 200:
    failures.append("seed failed")

# 3. search with a re-encoded copy of the same image -> high-score match
reenc = cv2.imencode(".jpg", cv2.imdecode(np.frombuffer(img_a, np.uint8), cv2.IMREAD_COLOR),
                    [int(cv2.IMWRITE_JPEG_QUALITY), 90])[1].tobytes()
r = client.post("/api/search", files={"file": ("q.jpg", reenc, "image/jpeg")}, data={"threshold": "0.5"})
body = r.json()
print("search(same):", r.status_code, body.get("message"), [m["score"] for m in body.get("results", [])])
if r.status_code != 200 or not body.get("results"):
    failures.append("search did not return the seeded match")
elif body["results"][0]["score"] < 0.9:
    failures.append(f"self-match score too low: {body['results'][0]['score']}")

# 4. no-face guardrail
r = client.post("/api/search", files={"file": ("n.png", make_no_face(), "image/png")})
print("no-face:", r.status_code, r.json())
if r.status_code != 400 or r.json().get("detail") != "NO_FACE_DETECTED":
    failures.append("no-face guardrail not working")

print("\nRESULT:", "FAIL -> " + "; ".join(failures) if failures else "ALL PASS")
sys.exit(1 if failures else 0)
