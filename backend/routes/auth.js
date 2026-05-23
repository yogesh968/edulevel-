import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isVercel = process.env.VERCEL === '1';
const usersFile = isVercel
    ? path.join(os.tmpdir(), 'users.json')
    : path.join(__dirname, '..', 'data', 'users.json');

// On Vercel: seed /tmp/users.json from bundled data if not yet present
if (isVercel && !fs.existsSync(usersFile)) {
    const bundled = path.join(__dirname, '..', 'data', 'users.json');
    try {
        const seed = fs.existsSync(bundled) ? fs.readFileSync(bundled, 'utf8') : '[]';
        fs.writeFileSync(usersFile, seed);
    } catch (e) {
        fs.writeFileSync(usersFile, '[]');
    }
}

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'edulevel_secret_key';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3003';

function readUsers() {
    if (!fs.existsSync(usersFile)) fs.writeFileSync(usersFile, '[]');
    return JSON.parse(fs.readFileSync(usersFile, 'utf8'));
}

function writeUsers(users) {
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

function generateToken(user) {
    return jwt.sign({ id: user.id, email: user.email, name: user.name, avatar: user.avatar || '' }, JWT_SECRET, { expiresIn: '7d' });
}

// POST /auth/signup
router.post('/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });

        const users = readUsers();
        if (users.find(u => u.email === email)) return res.status(409).json({ error: 'Email already registered' });

        const hashed = await bcrypt.hash(password, 10);
        const user = { id: Date.now().toString(), name, email, password: hashed, avatar: '', provider: 'local' };
        users.push(user);
        writeUsers(users);

        const token = generateToken(user);
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'All fields required' });

        const users = readUsers();
        const user = users.find(u => u.email === email);
        if (!user || user.provider === 'google') return res.status(401).json({ error: 'Invalid credentials' });

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

        const token = generateToken(user);
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /auth/google — redirect to Google
router.get('/google', (req, res) => {
    const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: `${BACKEND_URL}/auth/google/callback`,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        prompt: 'select_account'
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// GET /auth/google/callback
router.get('/google/callback', async (req, res) => {
    try {
        const { code } = req.query;
        if (!code) return res.redirect(`${FRONTEND_URL}/login?error=no_code`);

        // Exchange code for tokens
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: `${BACKEND_URL}/auth/google/callback`,
                grant_type: 'authorization_code'
            })
        });
        const tokenData = await tokenRes.json();
        if (tokenData.error) return res.redirect(`${FRONTEND_URL}/login?error=${tokenData.error}`);

        // Get user info from Google
        const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        const googleUser = await userRes.json();

        const users = readUsers();
        let user = users.find(u => u.email === googleUser.email);
        if (!user) {
            user = { id: Date.now().toString(), name: googleUser.name, email: googleUser.email, avatar: googleUser.picture, password: '', provider: 'google' };
            users.push(user);
            writeUsers(users);
        } else {
            user.avatar = googleUser.picture;
            user.name = googleUser.name;
            writeUsers(users);
        }

        const token = generateToken(user);
        res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`);
    } catch (err) {
        res.redirect(`${FRONTEND_URL}/login?error=${err.message}`);
    }
});

// GET /auth/me — verify token
router.get('/me', (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'No token' });
        const decoded = jwt.verify(token, JWT_SECRET);
        res.json({ user: decoded });
    } catch {
        res.status(401).json({ error: 'Invalid token' });
    }
});

export default router;
