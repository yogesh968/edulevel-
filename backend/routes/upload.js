import express from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import { splitTextIntoChunks } from '../utils/textSplitting.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const chunksFilePath = path.join(__dirname, '..', 'data', 'chunks.json');

const router = express.Router();

// Ensure uploads dir exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)){
    fs.mkdirSync(uploadsDir);
}

const upload = multer({ dest: 'uploads/' });

router.post('/', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        const dataBuffer = fs.readFileSync(req.file.path);
        let pdfData;
        try {
            pdfData = await pdfParse(dataBuffer);
        } catch (pdfError) {
            console.error("PDF Parsing Error:", pdfError);
            fs.unlinkSync(req.file.path);
            return res.status(422).json({ 
                error: "Invalid PDF format.", 
                details: "The uploaded file could not be read. Ensure it is a valid, readable PDF file (not password-protected or corrupted)." 
            });
        }
        
        const text = pdfData.text;
        if (!text || text.trim().length === 0) {
             fs.unlinkSync(req.file.path);
             return res.status(422).json({ error: "The PDF appears to be empty or contains only images. Please upload a PDF with extractable text." });
        }

        fs.unlinkSync(req.file.path);

        const textChunks = splitTextIntoChunks(text, 400);
        const topicId = crypto.randomUUID(); 

        const processedChunks = [];
        let existingChunks = [];
        if (fs.existsSync(chunksFilePath)) {
            try {
                existingChunks = JSON.parse(fs.readFileSync(chunksFilePath, 'utf8'));
            } catch (e) {
                existingChunks = []; // reset if corrupted
            }
        }

        for (let i = 0; i < textChunks.length; i++) {
            processedChunks.push({
                id: crypto.randomUUID(),
                topicId,
                text: textChunks[i],
            });
        }

        const newChunksData = [...existingChunks, ...processedChunks];
        fs.writeFileSync(chunksFilePath, JSON.stringify(newChunksData, null, 2));

        res.json({ success: true, topicId, message: `Processed ${processedChunks.length} chunks.` });
    } catch (error) {
        console.error("Upload error:", error);
        res.status(500).json({ error: "Failed to process PDF.", details: error.message });
    }
});

export default router;
