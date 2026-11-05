"""
YCH Live - Reverse Face-Search PoC backend (FastAPI).

Endpoints (per prompt.md §Step 2):
  POST /api/seed    -> ingest image + metadata, index face vector
  POST /api/search  -> query image -> top-N matched profiles with confidence
  GET  /api/health  -> index status + indexed profile count

Run:  uvicorn main:app --reload --port 8400
"""

from __future__ import annotations

from typing import List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import face_engine
import store

# Confidence thresholds from spec §2 Pipeline B and §4 guardrails.
DEFAULT_MATCH_THRESHOLD = 0.80  # drop per-result matches below this
MIN_REPORT_THRESHOLD = 0.75     # below this overall -> "no matching profile"
MAX_RESULTS = 5

app = FastAPI(title="YCH Live Reverse Face-Search", version="0.1.0")

# The static frontend is opened via file:// or a local static server on any
# origin, so the PoC allows cross-origin uploads.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

store.init_db()


class MatchRecord(BaseModel):
    score: float
    name: str
    profile_url: str
    social_handle: str
    matched_image_id: str
    thumbnail: str  # base64 JPEG data-uri payload


class SearchResponse(BaseModel):
    backend: str
    face_box: Optional[List[int]]  # [top, right, bottom, left] of query face
    message: str
    results: List[MatchRecord]


class SeedResponse(BaseModel):
    vector_id: str
    backend: str
    message: str


async def _read_upload(file: UploadFile) -> bytes:
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="EMPTY_UPLOAD")
    return data


def _face_vector_or_400(data: bytes) -> face_engine.FaceResult:
    """Spec §4: no face -> clear 400; multiple faces -> largest box only."""
    try:
        faces = face_engine.extract_faces(data)
    except ValueError:
        raise HTTPException(status_code=400, detail="UNREADABLE_IMAGE")
    except RuntimeError as exc:  # no detector available (misconfigured env)
        raise HTTPException(status_code=503, detail=str(exc))
    if not faces:
        raise HTTPException(status_code=400, detail="NO_FACE_DETECTED")
    return faces[0]


# ---------------------------------------------------------------------------
# POST /api/seed
# ---------------------------------------------------------------------------
@app.post("/api/seed", response_model=SeedResponse)
async def seed(
    file: UploadFile = File(...),
    name: str = Form(...),
    social_handle: str = Form(""),
    profile_url: str = Form(""),
):
    data = await _read_upload(file)
    face = _face_vector_or_400(data)
    thumb = face_engine.thumbnail_b64(data)
    vector_id = store.store_vector(
        face.encoding, name.strip() or "Unnamed", social_handle, profile_url, thumb
    )
    # Query images are never persisted; only seeded records keep a thumbnail.
    del data
    return SeedResponse(
        vector_id=vector_id,
        backend=face_engine.active_backend(),
        message="Face indexed successfully.",
    )


# ---------------------------------------------------------------------------
# POST /api/search
# ---------------------------------------------------------------------------
@app.post("/api/search", response_model=SearchResponse)
async def search(
    file: UploadFile = File(...),
    limit: int = Form(MAX_RESULTS),
    threshold: float = Form(DEFAULT_MATCH_THRESHOLD),
):
    data = await _read_upload(file)
    face = _face_vector_or_400(data)
    # Image bytes stay in-memory and are released right after embedding (§4).
    del data

    limit = max(1, min(int(limit), MAX_RESULTS))
    matches = store.search_vectors(face.encoding, limit)

    results: List[MatchRecord] = []
    for m in matches:
        if m.score < threshold:
            continue
        meta = store.get_metadata(m.vector_id)
        if not meta:
            continue
        results.append(
            MatchRecord(
                score=round(m.score, 4),
                name=meta["name"],
                profile_url=meta["profile_url"] or "",
                social_handle=meta["social_handle"] or "",
                matched_image_id=m.vector_id,
                thumbnail=meta["thumbnail"] or "",
            )
        )

    top = max((r.score for r in results), default=0.0)
    if not results or top < MIN_REPORT_THRESHOLD:
        message = "No matching profile found in index."
    else:
        message = f"{len(results)} match(es) above confidence threshold."

    return SearchResponse(
        backend=face_engine.active_backend(),
        face_box=list(face.box),
        message=message,
        results=results,
    )


# ---------------------------------------------------------------------------
# GET /api/health
# ---------------------------------------------------------------------------
@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "backend": face_engine.active_backend(),
        "vector_index": store.index_kind(),
        "indexed_profiles": store.vector_count(),
        "metadata_records": store.count_profiles(),
    }


# ---------------------------------------------------------------------------
# GET /api/profiles  (support endpoint for the Seed Mode UI list)
# ---------------------------------------------------------------------------
@app.get("/api/profiles")
async def profiles():
    ids = store.all_vector_ids()
    items = []
    for vid in ids:
        meta = store.get_metadata(vid)
        if meta:
            items.append(
                {
                    "vector_id": vid,
                    "name": meta["name"],
                    "social_handle": meta["social_handle"] or "",
                    "profile_url": meta["profile_url"] or "",
                    "created_at": meta["created_at"],
                }
            )
    return {"profiles": items}
