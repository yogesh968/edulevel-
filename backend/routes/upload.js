import express from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import { splitTextIntoChunks } from '../utils/textSplitting.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// VERCEL FIX: Use /tmp for storage because the main directory is read-only
const isVercel = process.env.VERCEL === '1';
const uploadDir = isVercel ? path.join(os.tmpdir(), 'uploads') : path.join(__dirname, '..', 'uploads');
const chunksFilePath = isVercel ? path.join(os.tmpdir(), 'chunks.json') : path.join(__dirname, '..', 'data', 'chunks.json');
const imagesFilePath = isVercel ? path.join(os.tmpdir(), 'images.json') : path.join(__dirname, '..', 'data', 'images.json');

// Ensure directories exist safely
try {
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    // Also ensure /tmp versions of data files exist if on Vercel
    if (isVercel) {
        if (!fs.existsSync(chunksFilePath)) fs.writeFileSync(chunksFilePath, '[]');
        if (!fs.existsSync(imagesFilePath)) fs.writeFileSync(imagesFilePath, '[]');
    }
} catch (e) {
    console.warn("Storage warning (expected on some Vercel regions):", e.message);
}

const router = express.Router();

const upload = multer({ dest: uploadDir });

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
