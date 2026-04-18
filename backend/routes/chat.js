import express from 'express';
import { computeSimilarities, askLLM } from '../utils/embedding.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// VERCEL FIX: Match the storage location used in the upload route
const isVercel = process.env.VERCEL === '1';
const chunksFilePath = isVercel ? path.join(os.tmpdir(), 'chunks.json') : path.join(__dirname, '..', 'data', 'chunks.json');
const imagesFilePath = isVercel ? path.join(os.tmpdir(), 'images.json') : path.join(__dirname, '..', 'data', 'images.json');

const router = express.Router();

router.post('/', async (req, res) => {
    try {
        const { topicId, question, history = [], image } = req.body;
        if (!topicId && !question && !image) {
            return res.status(400).json({ error: "question or image is required" });
        }

        let chunksData = [];
        if (fs.existsSync(chunksFilePath)) {
            chunksData = JSON.parse(fs.readFileSync(chunksFilePath, 'utf8'));
        }

        // 3. Context Retrieval (PDF Chunks)
        const topicChunks = chunksData.filter(c => c.topicId === topicId);
        const contextText = topicChunks.length > 0
            ? (await (async () => {
                const textsToCompare = topicChunks.map(c => c.text);
                const similarities = await computeSimilarities(question || "image analysis", textsToCompare);
                const scoredChunks = topicChunks.map((chunk, idx) => ({ ...chunk, similarity: similarities[idx] || 0 }));
                scoredChunks.sort((a, b) => b.similarity - a.similarity);
                return scoredChunks.slice(0, 5).map(c => c.text).join('\n\n---\n\n');
            })())
            : "";

        // 4. Image Retrieval Logic (Guaranteed Matching Layer)
        let imagesData = [];
        if (fs.existsSync(imagesFilePath)) {
            imagesData = JSON.parse(fs.readFileSync(imagesFilePath, 'utf8'));
        }

        let relevantImages = [];
        let visualContext = "";

        if (imagesData.length > 0) {
            const queryLower = (question || "").toLowerCase();
            console.log(`[IMAGE LOG]: Aggressive retrieval for query: "${queryLower}"`);

            // 1. Semantic Search
            let imgSimilarities = [];
            try {
                const imageSentences = imagesData.map(img => `${img.title}. ${img.description} Keywords: ${img.keywords.join(', ')}`);
                imgSimilarities = await computeSimilarities(queryLower || "diagram", imageSentences);
            } catch (err) {
                imgSimilarities = new Array(imagesData.length).fill(0);
            }

            // 2. Multi-Layer Scoring
            const scoredImages = imagesData.map((img, i) => {
                let score = imgSimilarities[i] || 0;

                // A. Guaranteed Keyword Map (Instant Boost)
                const keyMappings = {
                    'sound': ['img_001', 'img_sound_02'],
                    'bell': ['img_001'],
                    'ear': ['img_human_ear'],
                    'cell': ['img_plant_cell', 'img_animal_cell'],
                    'light': ['img_light_spectrum'],
                    'work': ['img_work_power'],
                    'vibrate': ['img_001', 'img_sound_01']
                };

                for (const [key, ids] of Object.entries(keyMappings)) {
                    if (queryLower.includes(key) && ids.includes(img.id)) {
                        score += 5.0; // Overwhelming boost
                    }
                }

                // B. General Keyword Match
                if (img.keywords.some(k => queryLower.includes(k.toLowerCase())) ||
                    img.title.toLowerCase().includes(queryLower)) {
                    score += 1.0;
                }

                return { ...img, score };
            });

            scoredImages.sort((a, b) => b.score - a.score);

            // 3. Selection with high reliability
            relevantImages = scoredImages
                .filter(img => img.score > 0.3) // Lowered hurdle to ensure output
                .slice(0, 2)
                .map(img => {
                    console.log(`[IMAGE LOG]: SUCCESS! Returning ${img.title} (Score: ${img.score})`);
                    return {
                        filename: img.filename,
                        title: img.title,
                        description: img.description
                    };
                });

            if (relevantImages.length > 0) {
                visualContext = "\n\n[USER-PROVIDED DIAGRAMS FOR THIS TOPIC]:\n" + relevantImages.map(img => `- ${img.title}: ${img.description}`).join('\n');
            } else {
                console.log(`[IMAGE LOG]: NO MATCHES found for: "${queryLower}"`);
            }
        }

        // 5. Ask LLM with PDF + Visual Context
        const prompt = `[DOCUMENT CONTEXT]:\n${contextText}\n${visualContext}\n\n[USER QUESTION]:\n${question}\n\n[INSTRUCTIONS]: 
- Answer as a premium AI tutor. 
- If the question is simple/short, KEEP IT TO 1-2 SENTENCES.
- If diagrams are provided, briefly refer to them.
- Only provide a detailed explanation if the question is complex or explicitly asks for more detail.`;

        const answer = await askLLM(prompt, question, history, image);

        res.json({
            answer,
            images: relevantImages,
            userImage: image || null
        });

    } catch (error) {
        console.error("Chat error:", error);
        res.status(500).json({
            error: "Failed to generate answer",
            details: error.message
        });
    }
});

export default router;
// Chat history export
