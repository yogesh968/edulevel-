import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import uploadRoutes from './routes/upload.js';
import chatRoutes from './routes/chat.js';
import authRoutes from './routes/auth.js';
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

app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy", "default-src * 'unsafe-inline' 'unsafe-eval'; img-src * data:; font-src * https://fonts.gstatic.com;");
    next();
});

app.get('/', (req, res) => {
    res.send('Edulevel+ Backend is Running Successfully 🚀');
});

app.get('/favicon.ico', (req, res) => res.status(204).end());

app.use(['/api/upload', '/upload'], uploadRoutes);
app.use(['/api/chat', '/chat'], chatRoutes);
app.use('/auth', authRoutes);

app.get('/api/health', (req, res) => res.json({ status: "API is online and matching routes" }));

app.use('/images', express.static(path.join(__dirname, 'public', 'images')));

// Only start HTTP server in local dev — Vercel uses export default
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

export default app;
