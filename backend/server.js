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

app.use(cors({
    origin: [process.env.FRONTEND_URL, "http://localhost:5173", "http://localhost:3000"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
}));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Set Security Headers (Fixes the Font/CSP issue)
app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy", "default-src * 'unsafe-inline' 'unsafe-eval'; img-src * data:; font-src * https://fonts.gstatic.com;");
    next();
});

// Root Route (Fixes the 'Cannot GET /' 404 error)
app.get('/', (req, res) => {
    res.send('Edulevel+ Backend is Running Successfully 🚀');
});

// Handle Favicon requests
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Route mapping - Handle both /api and raw routes for maximum Vercel compatibility
app.use('/api/upload', uploadRoutes);
app.use('/api/chat', chatRoutes);
app.use('/upload', uploadRoutes);
app.use('/chat', chatRoutes);

// Simple endpoint to serve images locally if needed
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// Essential for Vercel Serverless environment
export default app;
// API versioning placeholder
