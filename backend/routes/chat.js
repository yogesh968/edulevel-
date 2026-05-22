import express from 'express';
import { computeSimilarities, askLLM } from '../utils/embedding.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isVercel = process.env.VERCEL === '1';
const chunksFilePath = isVercel ? path.join(os.tmpdir(), 'chunks.json') : path.join(__dirname, '..', 'data', 'chunks.json');

const router = express.Router();

router.post('/', async (req, res) => {
    try {
        const { topicId, question, history = [], image } = req.body;
        if (!topicId && !question && !image) {
            return res.status(400).json({ error: "question or image is required" });
        }

        // Load chunks and retrieve top context
        let chunksData = [];
        if (fs.existsSync(chunksFilePath)) {
            chunksData = JSON.parse(fs.readFileSync(chunksFilePath, 'utf8'));
        }

        const topicChunks = chunksData.filter(c => c.topicId === topicId);
        const contextText = topicChunks.length > 0
            ? await (async () => {
                const textsToCompare = topicChunks.map(c => c.text);
                const similarities = await computeSimilarities(question || "summary", textsToCompare);
                const scored = topicChunks.map((chunk, idx) => ({ ...chunk, similarity: similarities[idx] || 0 }));
                scored.sort((a, b) => b.similarity - a.similarity);
                return scored.slice(0, 5).map(c => c.text).join('\n\n---\n\n');
            })()
            : "";

        // Check if user is asking for an image
        const isImageRequest = /\b(image|diagram|picture|visual|chart|illustration|show me|generate|create image|draw)\b/i.test(question);

        if (isImageRequest) {
            // Extract meaningful keywords from the user's question
            const imageKeywords = question
                .replace(/\b(image|diagram|picture|visual|chart|illustration|show|generate|create|draw|of|the|a|an|me|give|make)\b/gi, '')
                .replace(/[^a-zA-Z0-9 ]/g, ' ')
                .split(/\s+/)
                .filter(w => w.length > 2)
                .slice(0, 8)
                .join(' ')
                .trim();

            const topChunkKeywords = topicChunks[0]?.text
                .replace(/[^a-zA-Z0-9 ]/g, ' ')
                .split(/\s+/)
                .filter(w => w.length > 4)
                .slice(0, 5)
                .join(' ') || '';

            const finalKeywords = imageKeywords || topChunkKeywords || 'education';
            const imagePrompt = `educational diagram ${finalKeywords} textbook illustration labeled white background`;
            const encodedPrompt = encodeURIComponent(imagePrompt);
            const seed = Math.floor(Math.random() * 99999);
            const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=800&height=500&nologo=true&seed=${seed}`;

            // Wait for image to be ready on Pollinations before returning
            for (let i = 0; i < 6; i++) {
                try {
                    const check = await fetch(imageUrl);
                    if (check.ok && check.headers.get('content-type')?.includes('image')) break;
                } catch (_) {}
                await new Promise(r => setTimeout(r, 5000));
            }

            return res.json({
                answer: `Here is a diagram for **${finalKeywords}**.`,
                images: [{ url: imageUrl, title: finalKeywords, description: `AI-generated diagram: ${finalKeywords}` }],
                userImage: image || null
            });
        }

        // Normal chat — text only, no images
        const prompt = `[DOCUMENT CONTEXT]:\n${contextText}\n\n[USER QUESTION]:\n${question}\n\n[INSTRUCTIONS]:
- Answer as a premium AI tutor.
- Simple question: 1-2 sentences. Complex question: structured explanation.
- Do NOT mention or suggest images, diagrams or visuals.`;

        const answer = await askLLM(prompt, question, history, image);

        res.json({ answer, images: [], userImage: image || null });

    } catch (error) {
        console.error("Chat error:", error);
        res.status(500).json({ error: "Failed to generate answer", details: error.message });
    }
});

export default router;
