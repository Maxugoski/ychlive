"""
Storage layer for the reverse face-search PoC.

* Vector store: Qdrant when a server is reachable (spec §1), otherwise a
  local numpy-backed index persisted to backend/vectors.npz. The local index
  performs the same cosine-similarity nearest-neighbour search.
* Metadata store: SQLite (backend/faces.db) mapping vector_id -> profile
  metadata (name, social handle, source URL, thumbnail).
"""

from __future__ import annotations

import json
import os
import sqlite3
import threading
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

import numpy as np

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "faces.db"
VECTOR_CACHE = BASE_DIR / "vectors.npz"
COLLECTION = "faces"

_QDRANT_URL = os.environ.get("QDRANT_URL", "").strip()

_lock = threading.Lock()


@dataclass
class Match:
    vector_id: str
    score: float  # cosine similarity, higher is better


# ---------------------------------------------------------------------------
# SQLite metadata
# ---------------------------------------------------------------------------
def _db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS profiles (
                vector_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                social_handle TEXT,
                profile_url TEXT,
                thumbnail TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            )
            """
        )


def put_metadata(vector_id: str, name: str, social_handle: str,
                 profile_url: str, thumbnail: str) -> None:
    with _db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO profiles "
            "(vector_id, name, social_handle, profile_url, thumbnail) "
            "VALUES (?, ?, ?, ?, ?)",
            (vector_id, name, social_handle, profile_url, thumbnail),
        )


def get_metadata(vector_id: str) -> Optional[dict]:
    with _db() as conn:
        row = conn.execute(
            "SELECT * FROM profiles WHERE vector_id = ?", (vector_id,)
        ).fetchone()
        return dict(row) if row else None


def count_profiles() -> int:
    with _db() as conn:
        return conn.execute("SELECT COUNT(*) AS c FROM profiles").fetchone()["c"]


def all_vector_ids() -> List[str]:
    with _db() as conn:
        return [r["vector_id"] for r in conn.execute("SELECT vector_id FROM profiles")]


def delete_profile(vector_id: str) -> bool:
    with _db() as conn:
        cur = conn.execute("DELETE FROM profiles WHERE vector_id = ?", (vector_id,))
    _delete_vector(vector_id)
    return cur.rowcount > 0


# ---------------------------------------------------------------------------
# Vector index: Qdrant if configured, otherwise local numpy store
# ---------------------------------------------------------------------------
class LocalVectorIndex:
    """Brute-force cosine KNN over an in-memory matrix, persisted to .npz."""

    def __init__(self) -> None:
        self._ids: List[str] = []
        self._matrix: Optional[np.ndarray] = None
        self._load()

    def _load(self) -> None:
        if VECTOR_CACHE.exists():
            data = np.load(VECTOR_CACHE, allow_pickle=True)
            self._ids = list(data["ids"].astype(str))
            self._matrix = data["vectors"].astype(np.float32)

    def _persist(self) -> None:
        np.savez(
            VECTOR_CACHE,
            ids=np.array(self._ids, dtype=object),
            vectors=self._matrix if self._matrix is not None else np.zeros((0, 128), np.float32),
        )

    def upsert(self, vector_id: str, vector: np.ndarray) -> None:
        vec = vector.astype(np.float32).reshape(1, -1)
        if vector_id in self._ids:
            idx = self._ids.index(vector_id)
            self._matrix[idx] = vec
        else:
            self._ids.append(vector_id)
            self._matrix = vec if self._matrix is None or self._matrix.size == 0 else np.vstack([self._matrix, vec])
        self._persist()

    def delete(self, vector_id: str) -> None:
        if vector_id in self._ids:
            idx = self._ids.index(vector_id)
            del self._ids[idx]
            self._matrix = np.delete(self._matrix, idx, axis=0)
            self._persist()

    def search(self, query: np.ndarray, limit: int) -> List[Match]:
        if self._matrix is None or self._matrix.size == 0 or limit <= 0:
            return []
        q = query.astype(np.float32)
        q = q / (np.linalg.norm(q) or 1.0)
        # Vectors are stored L2-normalised; cosine = dot product.
        scores = self._matrix @ q
        order = np.argsort(scores)[::-1][:limit]
        return [Match(self._ids[i], float(scores[i])) for i in order]

    def count(self) -> int:
        return len(self._ids)


class QdrantVectorIndex:
    """Thin wrapper over qdrant-client REST collection (distance: Cosine)."""

    def __init__(self, url: str) -> None:
        from qdrant_client import QdrantClient  # imported lazily
        from qdrant_client.models import Distance, VectorParams

        self._client = QdrantClient(url=url, timeout=5)
        if not self._client.collection_exists(COLLECTION):
            self._client.create_collection(
                COLLECTION, vectors_config=VectorParams(size=128, distance=Distance.COSINE)
            )

    def upsert(self, vector_id: str, vector: np.ndarray) -> None:
        from qdrant_client.models import PointStruct

        self._client.upsert(
            COLLECTION,
            points=[PointStruct(id=vector_id, vector=vector.astype(float).tolist(), payload={})],
        )

    def delete(self, vector_id: str) -> None:
        self._client.delete(COLLECTION, points_selector=[vector_id])

    def search(self, query: np.ndarray, limit: int) -> List[Match]:
        hits = self._client.search(COLLECTION, query_vector=query.astype(float).tolist(), limit=limit)
        return [Match(str(h.id), float(h.score)) for h in hits]

    def count(self) -> int:
        return self._client.count(COLLECTION).count


_local_fallback = LocalVectorIndex()


def _build_index():
    if _QDRANT_URL:
        try:
            return QdrantVectorIndex(_QDRANT_URL)
        except Exception:
            # Server unreachable at boot: keep PoC usable with local index.
            pass
    return _local_fallback


_index = None


def index():
    global _index
    if _index is None:
        _index = _build_index()
    return _index


def index_kind() -> str:
    return "qdrant" if isinstance(index(), QdrantVectorIndex) else "local"


def _delete_vector(vector_id: str) -> None:
    with _lock:
        try:
            index().delete(vector_id)
        except Exception:
            pass


def store_vector(vector: np.ndarray, name: str, social_handle: str,
                 profile_url: str, thumbnail: str) -> str:
    """Insert embedding + metadata for one seeded face; returns vector_id."""
    vector_id = str(uuid.uuid4())
    with _lock:
        index().upsert(vector_id, vector)
    put_metadata(vector_id, name, social_handle, profile_url, thumbnail)
    return vector_id


def search_vectors(query: np.ndarray, limit: int) -> List[Match]:
    with _lock:
        return index().search(query, limit)


def vector_count() -> int:
    with _lock:
        return index().count()
