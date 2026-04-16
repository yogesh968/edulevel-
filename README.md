# Lumina Tutor - RAG-Based AI Tutor With Image Retrieval

Lumina Tutor is an intelligent educational application that allows users to upload PDF materials and engage in a conversational interface to learn and ask questions. It uses Retrieval-Augmented Generation (RAG) to ground answers in the given text, and supports smart image retrieval from a local database to accompany its answers.

## Architecture & Logic

### 1. RAG (Retrieval-Augmented Generation) Pipeline
1. **Document Ingestion:** The user uploads a PDF. The backend extracts text using `pdf-parse`.
2. **Text Chunking:** The text is split into smaller, manageable chunks (approx. 400 words) using a custom utility to fit within token limits and improve search granularity.
3. **Embeddings Generation:** We use `text-embedding-3-small` (via OpenAI) to convert each text chunk into a high-dimensional vector representation. These are saved to `chunks.json`.
4. **Query & Retrieval:** When a user asks a question, their query is also embedded. We calculate the mathematical similarity (Cosine Similarity) between the query vector and all chunk vectors. The top K=5 chunks are retrieved.
5. **Generation (LLM):** The prompt explicitly instructs the LLM (GPT-4o-mini) to use *only* the provided context chunks. This severely limits hallucination. 

### 2. How Embeddings Work
Embeddings are a way of representing words, sentences, or images as arrays of numbers (vectors) in a high-dimensional space. Concepts that are semantically similar (e.g., "Apple" and "Orange") sit closer together in this space than unrelated concepts (e.g., "Apple" and "Bicycle"). By converting our PDF text and User Queries into vectors, we can find relevant context mathematically utilizing dot products / cosine similarity.

### 3. Image Retrieval Logic
1. **Image Metadata:** A `images.json` file stores mock metadata for diagrams (id, filename, title, description, keywords).
2. **Image Embeddings:** On server start, textual representations of each image (title + description + keywords) are passed to the embedding model, and the resulting vectors are stored in the JSON file. 
3. **Retrieval Action:** After the LLM generates a text answer for the user, we *embed that generated answer*. Then, we run cosine similarity against the image vectors. If an image surpasses a set similarity threshold (e.g., >0.25), it is returned along with the answer to be displayed on the frontend. 

## Requirements
- Node.js installed
- OpenAI API Key

## Setup Instructions

### Backend
1. Open a terminal and navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up the `.env` file! A placeholder has been created for you. Provide your valid OpenAI key:
   ```
   OPENAI_API_KEY=sk-xxxx...
   PORT=3001
   ```
4. Start the server:
   ```bash
   npm run dev
   ```

### Frontend
1. Open a *new* terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Follow the local host link provided in the terminal (usually `http://localhost:5173`) to view the application. 
# Project Setup
1. npm install in backend
2. npm install in frontend
3. Create .env
// Task: Add unit tests

## Current Status
- Repository initialized with structured file-wise commits.
- 30-commit milestone reached.
