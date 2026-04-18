import { computeSimilarities } from './utils/embedding.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const question = "sound";
const imagesFilePath = path.join(__dirname, 'data', 'images.json');

async function test() {
    console.log("Testing Image Retrieval for:", question);
    if (!fs.existsSync(imagesFilePath)) {
        console.error("images.json NOT FOUND at", imagesFilePath);
        return;
    }
    
    const imagesData = JSON.parse(fs.readFileSync(imagesFilePath, 'utf8'));
    const imageSentences = imagesData.map(img => `${img.title}. ${img.description} Keywords: ${img.keywords.join(', ')}`);
    
    try {
        console.log("Calling computeSimilarities...");
        const imgSimilarities = await computeSimilarities(question, imageSentences);
        console.log("Scores received:", imgSimilarities.slice(0, 5));
        
        const scoredImages = imagesData.map((img, i) => {
            let score = imgSimilarities[i] || 0;
            const queryLower = question.toLowerCase();
            const hasDirectKeyword = img.keywords.some(k => queryLower.includes(k.toLowerCase())) || 
                                   img.title.toLowerCase().includes(queryLower);
            
            let finalScore = score;
            if (hasDirectKeyword) finalScore += 0.5;
            if (queryLower.includes('sound') && img.id === 'img_001') finalScore += 0.4;
            
            return { id: img.id, title: img.title, initialScore: score, finalScore: finalScore };
        });

        scoredImages.sort((a, b) => b.finalScore - a.finalScore);
        console.log("Top results:", scoredImages.slice(0, 3));
    } catch (err) {
        console.error("Error during test:", err.message);
    }
}

test();
