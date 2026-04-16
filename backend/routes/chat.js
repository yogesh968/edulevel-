import express from 'express';
import { computeSimilarities, askLLM } from '../utils/embedding.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const chunksFilePath = path.join(__dirname, '..', 'data', 'chunks.json');
const imagesFilePath = path.join(__dirname, '..', 'data', 'images.json');

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

        const topicChunks = chunksData.filter(c => c.topicId === topicId);
        
        // Context is optional if we have an image or general question
        const contextText = topicChunks.length > 0 
            ? (await (async () => {
                const textsToCompare = topicChunks.map(c => c.text);
                const similarities = await computeSimilarities(question || "image analysis", textsToCompare);
                const scoredChunks = topicChunks.map((chunk, idx) => ({ ...chunk, similarity: similarities[idx] || 0 }));
                scoredChunks.sort((a, b) => b.similarity - a.similarity);
                return scoredChunks.slice(0, 5).map(c => c.text).join('\n\n---\n\n');
              })())
            : "";

        // 3. Ask LLM
        const prompt = (contextText && contextText.length > 50) 
            ? `[DOCUMENT CONTEXT]:\n${contextText}\n\n[USER QUESTION]:\n${question}\n\n[INSTRUCTIONS]: Answer concisely in 2-3 sentences. Do not use conversational filler or link unrelated topics.`
            : question;

        const answer = await askLLM(prompt, question, history, image);

        // 4. Image Retrieval Logic
        let imagesData = [];
        if (fs.existsSync(imagesFilePath)) {
            imagesData = JSON.parse(fs.readFileSync(imagesFilePath, 'utf8'));
        }

        let bestImage = null;
        if (imagesData.length > 0) {
             const imageSentences = imagesData.map(img => `${img.title}. ${img.description} Keywords: ${img.keywords.join(', ')}`);
             const searchContext = `${question} ${answer}`;
             const imgSimilarities = await computeSimilarities(searchContext, imageSentences);
             
             let highestSim = -1;
             for (let i = 0; i < imagesData.length; i++) {
                  if (imgSimilarities[i] > highestSim && imgSimilarities[i] > 0.20) { 
                      highestSim = imgSimilarities[i];
                      bestImage = {
                          filename: imagesData[i].filename,
                          title: imagesData[i].title,
                          description: imagesData[i].description
                      };
                  }
             }
        }

        res.json({
            answer,
            image: bestImage
        });

    } catch (error) {
        console.error("Chat error:", error);
        res.status(500).json({ 
            error: "Failed to generate answer", 
            details: error.message,
            stack: error.stack
        });
    }
});

export default router;
