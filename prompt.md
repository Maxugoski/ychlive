# TASK SPECIFICATION: Build a Proof-of-Concept Reverse Face-Search Engine

## Objective
Build a web application that accepts an uploaded image of a person's face, extracts its biometric facial vector, performs a nearest-neighbor similarity search against a vector database, and returns matching profile records (names, social handles, or metadata).

---

## 1. Tech Stack Requirements
* **Frontend:** React / Next.js or Vanilla HTML/CSS/JS (Clean, modern UI).
* **Backend:** Python (FastAPI or Flask) for machine learning processing.
* **Facial Processing:** `face_recognition` library (built on `dlib`) or InsightFace for extracting 128-dimensional (or 512-dimensional) face embeddings.
* **Vector Database:** Qdrant (Local Docker or Cloud) OR Pinecone / Milvus for similarity indexing.
* **Metadata Database:** PostgreSQL or SQLite to map Vector IDs to user metadata (Name, Social Media Links, Source URL).

---

## 2. Core Architecture & Pipeline

### Pipeline A: Data Ingestion & Indexing (Seeding the Database)
1. Accept image files along with associated metadata (e.g., Name: "Jane Doe", Social: "@janedoe", Source URL: "example.com").
2. Detect the target face using OpenCV / `face_recognition`.
3. Generate a face embedding array (e.g., 128 floats representing facial landmark distances).
4. Store the face embedding vector into the Vector Database with a unique `vector_id`.
5. Store `vector_id` + metadata (Name, URL, handles) into the metadata database.

### Pipeline B: Reverse Search Execution
1. Accept a user-uploaded query image via the API.
2. Detect the primary face in the image and convert it into a target vector.
3. Query the Vector Database using Cosine Similarity or Euclidean Distance.
4. Retrieve the Top-N nearest vector matches along with their similarity confidence scores (e.g., matches above a 0.85 threshold).
5. Join vector match IDs with the metadata database and return JSON results to the frontend.

---

## 3. Step-by-Step Implementation Guide

### Step 1: Project Setup
- Setup a Python virtual environment (`python -m venv venv`).
- Install dependencies:
  `pip install fastapi uvicorn face_recognition qdrant-client opencv-python numpy pillow pydantic`
- Setup local Qdrant server using Docker (`docker run -p 6333:6333 qdrant/qdrant`) or initialize an in-memory/cloud instance.

### Step 2: Backend API Endpoints (`main.py`)
Build a FastAPI app with three key endpoints:

1. `POST /api/seed`
   - **Input:** Image File (`UploadFile`) + JSON Metadata (`name`, `profile_url`, `social_handle`).
   - **Process:** Extract face vector using `face_recognition.face_encodings(image)[0]`. Insert vector into Qdrant collection (vector size: 128, distance metric: Cosine). Save metadata payload inside the vector payload or linked DB.
   - **Output:** Success message + generated Vector ID.

2. `POST /api/search`
   - **Input:** Image File (`UploadFile`).
   - **Process:**
     - Extract query face vector. If no face detected, return 400 error.
     - Execute `qdrant_client.search(collection_name="faces", query_vector=face_vector, limit=5)`.
     - Filter out matches below confidence threshold (e.g., score < 0.80).
   - **Output:** Array of matched records containing: `score`, `name`, `profile_url`, `social_handle`, `matched_image_id`.

3. `GET /api/health`
   - Health check endpoint returning vector index status and count of indexed profiles.

### Step 3: Frontend Interface
Build a simple, responsive UI:
1. **Upload / Drag-and-Drop Area:** Allow users to upload a image (`.jpg`, `.png`).
2. **Preview & Processing State:** Display crop overlay of detected face while querying API.
3. **Results Section:** Display cards showing matched profiles:
   - Match Confidence Score (percentage bar).
   - Name & Associated Social Links / Details.
   - Thumbnail of matched profile.
4. **Seed Mode Toggle:** A simple UI tab to allow adding new records into the index to test recognition capabilities.

---

## 4. Operational Guardrails & Edge Cases
* **No Face Found:** If the uploaded query image contains no identifiable face, return a clear user error: *"No facial biometric markers found in image."*
* **Multiple Faces Detected:** Isolate the largest detected face box as the primary subject for query embedding.
* **Low Similarity Threshold:** Do not return false positives. If top match confidence is below 0.75, report *"No matching profile found in index."*
* **Security & Cleanup:** Do not permanently save raw uploaded search query images to disk after vector extraction. Pass images strictly in-memory or delete temporary buffers immediately after embedding generation.