# YCH Live — Reverse Face-Search PoC (backend)

Proof-of-concept backend for the `search.html` page, implementing the pipeline
in `prompt.md`: face detection → embedding extraction → cosine-similarity
nearest-neighbour search → metadata join → JSON results.

## Endpoints

| Route | Method | Purpose |
|---|---|---|
| `/api/seed` | POST (multipart) | Index a face: `file` + `name`, `social_handle`, `profile_url` |
| `/api/search` | POST (multipart) | Query: `file` (+ optional `limit`, `threshold`) → ranked matches |
| `/api/profiles` | GET | List seeded records (for the Seed Mode tab) |
| `/api/health` | GET | Engine backend, vector index kind, indexed count |

Guardrails implemented per spec §4: no face → `400 NO_FACE_DETECTED`;
multiple faces → largest box wins; matches below 0.80 are dropped and a
top-score under 0.75 reports *"No matching profile found in index"*;
query images are processed strictly in memory and never written to disk.

## Setup

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Notes:

* **`face_recognition` (dlib)** is the preferred engine (128-d encodings). On
  Windows it needs a C++ toolchain or a prebuilt wheel, so it is left
  commented-out in `requirements.txt`. If it's missing, the app automatically
  falls back to an OpenCV engine — a **Haar cascade** (bundled with the pinned
  OpenCV 4.x) plus a deterministic gradient-histogram descriptor — so the PoC
  runs with zero extra setup. The active engine is shown in the UI status strip.
* **Better fallback accuracy (optional):** drop OpenCV's YuNet model
  `face_detection_yunet_2023mar.onnx` into `backend/models/`. The engine
  prefers YuNet over Haar when that file is present (works on OpenCV 4.x & 5.x).
  No model is downloaded or bundled automatically.
* **Qdrant (optional):** `docker run -p 6333:6333 qdrant/qdrant`, then start
  the app with `$env:QDRANT_URL = "http://localhost:6333"`. Without it, an
  in-process numpy cosine index is used and persisted to `vectors.npz`
  (same search semantics). `faces.db` (SQLite) always holds the metadata.

## Run

```powershell
cd backend
.\venv\Scripts\Activate.ps1
uvicorn main:app --reload --port 8400
```

Then open `../search.html` (or serve the site root with any static server).
Click **API** in the status strip if the backend isn't on
`http://127.0.0.1:8400`.

## Try it

```powershell
# Health
curl http://127.0.0.1:8400/api/health

# Seed a profile
curl -F "file=@portrait.jpg" -F "name=Jane Doe" -F "social_handle=@janedoe" `
     -F "profile_url=https://example.com/janedoe" http://127.0.0.1:8400/api/seed

# Reverse search
curl -F "file=@query.jpg" http://127.0.0.1:8400/api/search
```

## Files

* `main.py` — FastAPI app, endpoints, thresholds, CORS for the static page.
* `face_engine.py` — image decode, detection, embedding; dlib → OpenCV fallback.
* `store.py` — SQLite metadata + Qdrant-or-local vector index.
