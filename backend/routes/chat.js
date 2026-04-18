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

        // 4. Image Retrieval Logic (Multi-Image Support) - Before LLM
        let imagesData = [];
        if (fs.existsSync(imagesFilePath)) {
            imagesData = JSON.parse(fs.readFileSync(imagesFilePath, 'utf8'));
        }

        let relevantImages = [];
        let visualContext = "";

        if (imagesData.length > 0) {
             console.log(`[IMAGE LOG]: Processing retrieval for question: "${question}"`);
             
             let imgSimilarities = [];
             try {
                const imageSentences = imagesData.map(img => `${img.title}. ${img.description} Keywords: ${img.keywords.join(', ')}`);
                imgSimilarities = await computeSimilarities(question, imageSentences);
             } catch (err) {
                console.error("[IMAGE LOG]: Similarity API failed, falling back to keyword matching:", err.message);
                imgSimilarities = new Array(imagesData.length).fill(0);
             }
             
             const scoredImages = imagesData.map((img, i) => {
                  let semanticScore = imgSimilarities[i] || 0;
                  let keywordScore = 0;
                  
                  const queryLower = question.toLowerCase();
                  
                  // 1. Direct Keyword Match (0.6 boost)
                  const hasDirectKeyword = img.keywords.some(k => queryLower.includes(k.toLowerCase())) || 
                                         img.title.toLowerCase().includes(queryLower);
                  if (hasDirectKeyword) keywordScore += 0.6;
                  
                  // 2. Specific Iconic Boost (0.4 boost)
                  if (queryLower.includes('sound') && img.id.includes('sound')) keywordScore += 0.4;
                  if (queryLower.includes('sound') && img.id === 'img_001') keywordScore += 0.5; // Bell for Sound
                  if (queryLower.includes('bell') && img.id === 'img_001') keywordScore += 0.8;
                  if (queryLower.includes('cell') && img.id.includes('cell')) keywordScore += 0.6;
                  
                  const finalScore = semanticScore + keywordScore;
                  return { ...img, score: finalScore };
             });

             scoredImages.sort((a, b) => b.score - a.score);
             
             // Log the top scored image for debugging
             if (scoredImages.length > 0) {
                 console.log(`[IMAGE LOG]: Top match: ${scoredImages[0].title} (Score: ${scoredImages[0].score})`);
             }

             relevantImages = scoredImages
                .filter(img => img.score > 0.4) // stricter threshold (matching must be strong)
                .slice(0, 2) // Max 2 photos as requested
                .map(img => ({
                    filename: img.filename,
                    title: img.title,
                    description: img.description
                }));

             if (relevantImages.length > 0) {
                visualContext = "\n\n[AVAILABLE DIAGRAMS]:\n" + relevantImages.map(img => `- ${img.title}: ${img.description}`).join('\n');
                console.log(`[IMAGE LOG]: Found ${relevantImages.length} relevant images.`);
             } else {
                console.log(`[IMAGE LOG]: No images met the threshold.`);
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
