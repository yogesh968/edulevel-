import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import uploadRoutes from './routes/upload.js';
import chatRoutes from './routes/chat.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

app.use('/upload', uploadRoutes);
app.use('/chat', chatRoutes);

// Simple endpoint to serve images locally if needed
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
// API versioning placeholder
