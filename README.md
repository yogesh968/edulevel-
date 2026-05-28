# Edulevel+

An AI-powered tutoring platform that lets you upload a PDF and have a real conversation with it. Ask questions, request diagrams, and get structured explanations — all grounded in your own document.

---

## What it does

You drop in a PDF — a textbook chapter, lecture notes, anything — and the app processes it into searchable chunks. From there you can ask questions in plain English and get answers that are actually pulled from your document, not hallucinated from thin air.

It also has a vision layer. Upload an image alongside your question and the AI can analyze it. Ask for a diagram and it generates one on the fly using Pollinations AI.

The response style adapts automatically — short factual questions get short answers, complex ones get structured breakdowns with headers and bullet points.

---

## Tech stack

**Frontend** — React + Vite, plain CSS (no UI library)

**Backend** — Node.js + Express

**AI / Models**
- [Llama 3.3 70B](https://groq.com) via Groq for text reasoning
- [Salesforce BLIP VQA](https://huggingface.co/Salesforce/blip-vqa-base) via Hugging Face for image understanding
- [Pollinations AI](https://pollinations.ai) for diagram generation

**RAG pipeline** — PDF → `pdf-parse` → text chunking → cosine similarity search → top-5 chunks passed to LLM as context

---

## Project structure

```
edulevel-/
├── backend/
│   ├── routes/
│   │   ├── upload.js     # PDF parsing, chunking, storage
│   │   ├── chat.js       # RAG retrieval + LLM call
│   │   └── auth.js       # Auth routes (integration pending)
│   ├── utils/
│   │   ├── embedding.js      # Cosine similarity + Groq LLM wrapper
│   │   └── textSplitting.js  # Chunk text into ~400 token pieces
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Upload.jsx    # PDF upload UI
│   │   │   ├── ChatUI.jsx    # Chat interface
│   │   │   └── Flashcards.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   └── App.jsx
│   └── vite.config.js
```

---

## Getting started

### Prerequisites
- Node.js v18+
- A [Groq API key](https://console.groq.com)
- A [Hugging Face token](https://huggingface.co/settings/tokens)

### Setup

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

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

Frontend runs on `http://localhost:5173`, backend on `http://localhost:3003`. The Vite proxy forwards all `/api` requests to the backend automatically.

---

## How the RAG pipeline works

1. PDF is uploaded and parsed with `pdf-parse`
2. Extracted text is split into ~400-word chunks
3. Each chunk is stored with a `topicId` tied to the session
4. On each question, cosine similarity is computed between the query and all chunks
5. Top 5 most relevant chunks are injected into the LLM prompt as context
6. Llama 3.3 generates an answer grounded in those chunks

---

## Notes

- Auth is scaffolded but bypassed for now — the app opens directly to the main page. Auth integration is planned.
- On Vercel, file storage uses `/tmp` since the filesystem is ephemeral.
- Password-protected or image-only PDFs won't work — the text must be extractable.

---

Built by Yogesh Kumar
