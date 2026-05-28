# Edulevel+

A document-grounded AI tutoring platform. Upload any PDF and have a real conversation with it — ask questions, generate diagrams, create flashcards, and get structured explanations, all pulled directly from your document.

---

## What it does

- Upload a PDF (textbook chapter, lecture notes, research paper)
- Ask questions in plain English — answers come from your document, not from the model's general knowledge
- Ask for a diagram — one gets generated on the fly via Pollinations AI
- Upload an image alongside a question — the AI analyzes it using BLIP VQA
- Generate flashcards or a full summary of the document in one click
- Chat history persists per session via localStorage
- Response style adapts — short questions get short answers, complex ones get structured breakdowns

---

## Screenshots

> Upload screen

![Upload Screen](docs/screenshots/upload.png)

> Chat interface with diagram generation

![Chat UI](docs/screenshots/chat.png)

> Flashcard modal

![Flashcards](docs/screenshots/flashcards.png)

*(Add your own screenshots to `docs/screenshots/` to populate these)*

---

## Setup

### Prerequisites

- Node.js v18+
- [Groq API key](https://console.groq.com) — free tier works
- [Hugging Face token](https://huggingface.co/settings/tokens) — needed for BLIP image analysis and LLM fallbacks

### Install

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### Environment

Create a `.env` file inside `backend/`:

```env
GROQ_API_KEY=your_groq_key
HF_TOKEN=your_huggingface_token
PORT=3003
```

### Run

```bash
# Terminal 1 — backend
cd backend && npm start

# Terminal 2 — frontend
cd frontend && npm run dev
```

- Frontend → `http://localhost:5173`
- Backend → `http://localhost:3003`
- Vite proxies all `/api/*` requests to the backend automatically — no CORS issues in dev

---

## Architecture

```
Browser (React + Vite)
        │
        │  /api/*  (Vite proxy in dev, direct in prod)
        ▼
Express Server (Node.js)
        │
        ├── POST /api/upload
        │       └── multer → pdf-parse → textSplitting → chunks.json
        │
        └── POST /api/chat
                ├── Load chunks for topicId
                ├── computeSimilarities (Xenova/all-MiniLM-L6-v2, local)
                ├── Top-5 chunks → LLM prompt
                ├── Image request? → Pollinations AI (diagram URL)
                └── Image uploaded? → BLIP VQA (Hugging Face) → LLM
```

### RAG pipeline step by step

1. PDF uploaded → `pdf-parse` extracts raw text
2. `textSplitting.js` splits text into ~400-word chunks
3. Each chunk stored in `chunks.json` with a `topicId` (UUID) tied to the session
4. On each question, `Xenova/all-MiniLM-L6-v2` runs locally to embed both the query and all chunks
5. Cosine similarity computed — top 5 chunks selected
6. Those chunks injected into the Llama 3.3 prompt as `[DOCUMENT CONTEXT]`
7. LLM answers strictly from that context

### LLM fallback chain

The app never hard-fails on a single model. If Groq is down or rate-limited:

```
Groq: llama-3.1-8b-instant
  → llama-3.3-70b-versatile
  → mixtral-8x7b-32768
  → gemma2-9b-it
    → HF: Mistral-7B-Instruct
    → HF: Zephyr-7B
    → HF: Phi-3-mini
    → HF: Gemma-2-2b
```

---

## Project structure

```
edulevel-/
├── backend/
│   ├── routes/
│   │   ├── upload.js         # PDF parsing, chunking, storage
│   │   ├── chat.js           # RAG retrieval, diagram detection, LLM call
│   │   └── auth.js           # Auth routes (scaffolded, not active)
│   ├── utils/
│   │   ├── embedding.js      # Local embeddings + Groq/HF LLM wrapper
│   │   └── textSplitting.js  # Splits text into ~400-word chunks
│   ├── data/                 # chunks.json stored here (local dev)
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Upload.jsx    # PDF upload UI with drag & drop
│   │   │   ├── ChatUI.jsx    # Chat, image upload, voice, flashcards
│   │   │   └── Flashcards.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx   # Auth context (bypassed for now)
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   └── Signup.jsx
│   │   └── App.jsx
│   └── vite.config.js
```

---

## Design decisions

**No vector database** — cosine similarity is computed in-memory using a local transformer model (`all-MiniLM-L6-v2` via `@xenova/transformers`). This keeps the stack simple and free — no Pinecone, no Weaviate, no external embedding API calls.

**No UI library** — the entire frontend is plain CSS. Keeps bundle size small and gives full control over the design without fighting a component library.

**Chunk size of 400 words** — small enough to stay within LLM context limits, large enough to preserve sentence coherence and topic continuity within each chunk.

**Top-5 chunks** — passing more than 5 chunks starts to dilute the prompt and push less relevant content into the context window. 5 was the sweet spot in testing.

**Pollinations AI for diagrams** — zero API key required, generates on-demand educational diagrams from a text prompt. The backend waits up to 30s polling for the image to be ready before returning the URL.

**Groq as primary LLM** — Groq's inference speed is significantly faster than standard OpenAI-compatible endpoints, which matters for a tutoring UX where response latency is noticeable.

**Auth bypassed, not removed** — the full auth scaffold (Login, Signup, AuthContext, auth routes) is kept in the codebase but bypassed with a mock guest user. This means auth can be wired in without restructuring anything.

---

## Assumptions

- The PDF must contain extractable text. Password-protected PDFs and image-only scans (no OCR layer) will be rejected with a clear error.
- One session = one PDF. The `topicId` is a UUID generated per upload and stored in localStorage. Uploading a new PDF starts a fresh session.
- Chunks from all sessions accumulate in `chunks.json`. There is no cleanup mechanism yet — on Vercel this is fine since `/tmp` is wiped between cold starts, but in long-running local dev the file will grow.
- The app is single-user for now. Auth is scaffolded but not enforced, so there is no per-user data isolation.
- Hugging Face free tier models can be slow to respond (cold start ~20s). The BLIP vision model has retry logic built in to handle this.

---

## Deployment notes

- **Vercel** — both `backend/vercel.json` and `frontend/vercel.json` are configured. File storage automatically switches to `/tmp` when `VERCEL=1` is set.
- **Local** — files are stored in `backend/data/` and `backend/uploads/` (both gitignored).

---

Built by Yogesh Kumar
