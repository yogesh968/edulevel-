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

const isVercel = process.env.VERCEL === '1';
const chunksFilePath = isVercel ? path.join(os.tmpdir(), 'chunks.json') : path.join(__dirname, '..', 'data', 'chunks.json');
const imagesFilePath = isVercel ? path.join(os.tmpdir(), 'images.json') : path.join(__dirname, '..', 'data', 'images.json');

try {
    if (isVercel) {
        if (!fs.existsSync(chunksFilePath)) fs.writeFileSync(chunksFilePath, '[]');
        if (!fs.existsSync(imagesFilePath)) fs.writeFileSync(imagesFilePath, '[]');
    }
} catch (e) {
    console.warn("Storage warning (expected on some Vercel regions):", e.message);
}

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are supported.'));
        }
    },
});

function fallbackPdfText(buffer) {
    const raw = buffer.toString('latin1');
    const matches = [];

    for (const match of raw.matchAll(/\((?:\\.|[^\\()])*\)/g)) {
        const value = match[0]
            .slice(1, -1)
            .replace(/\\([nrtbf()\\])/g, (_m, char) => {
                const escapes = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' };
                return escapes[char] || char;
            })
            .replace(/\\([0-7]{1,3})/g, (_m, octal) => String.fromCharCode(parseInt(octal, 8)));

        if (/[a-zA-Z]{3,}/.test(value)) {
            matches.push(value);
        }
    }

    for (const match of raw.matchAll(/<([0-9A-Fa-f]{8,})>/g)) {
        const hex = match[1];
        let value = '';
        for (let i = 0; i < hex.length - 1; i += 2) {
            const code = parseInt(hex.slice(i, i + 2), 16);
            if (code >= 32 && code <= 126) value += String.fromCharCode(code);
        }
        if (/[a-zA-Z]{3,}/.test(value)) {
            matches.push(value);
        }
    }

    return matches.join(' ').replace(/\s+/g, ' ').trim();
}

router.post('/', (req, res, next) => {
    upload.single('file')(req, res, (error) => {
        if (!error) return next();

        const message = error.code === 'LIMIT_FILE_SIZE'
            ? 'PDF must be 10MB or smaller.'
            : error.message;
        return res.status(400).json({ error: message, details: message });
    });
}, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        const dataBuffer = req.file.buffer;
        let pdfData;
        try {
            pdfData = await pdfParse(dataBuffer);
        } catch (pdfError) {
            console.error("PDF Parsing Error:", pdfError);
            const recoveredText = fallbackPdfText(dataBuffer);
            if (!recoveredText) {
                return res.status(422).json({
                    error: "Invalid PDF format.",
                    details: "The uploaded file could not be read. Ensure it is a valid, readable PDF file that is not password-protected or corrupted."
                });
            }
            pdfData = { text: recoveredText };
        }
        
        let text = (pdfData.text || '').replace(/\s+/g, ' ').trim();
        if (!text || text.trim().length === 0) {
            text = `The uploaded PDF "${req.file.originalname}" was accepted, but no selectable text could be extracted. It may be a scanned or image-only PDF. Ask the student to upload a searchable PDF for document-specific tutoring.`;
        }

        const textChunks = splitTextIntoChunks(text, 400);
        const topicId = crypto.randomUUID(); 

        const processedChunks = [];
        let existingChunks = [];
        if (fs.existsSync(chunksFilePath)) {
            try {
                existingChunks = JSON.parse(fs.readFileSync(chunksFilePath, 'utf8'));
            } catch (e) {
                existingChunks = [];
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
