/**
 * Auth Routes - Login, Register, Logout
 * Cynex Client API
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../database');
const { generateAccessToken, generateRefreshToken, authMiddleware, verifyRefreshToken } = require('../auth');

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
    try {
        const { username, password, email } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Имя пользователя и пароль обязательны' });
        }

        if (username.length < 3 || username.length > 20) {
            return res.status(400).json({ error: 'Имя пользователя от 3 до 20 символов' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Пароль минимум 6 символов' });
        }

        // Check if exists
        const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
        if (existing) {
            return res.status(400).json({ error: 'Пользователь уже существует' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = db.prepare(`
            INSERT INTO users (username, email, password, role)
            VALUES (?, ?, ?, 'USER')
        `).run(username, email || null, hashedPassword);

        const user = db.prepare('SELECT id, username, email, role, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        res.json({
            success: true,
            accessToken,
            refreshToken,
            user
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Ошибка регистрации' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Введите имя пользователя и пароль' });
        }

        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        
        if (!user) {
            return res.status(401).json({ error: 'Неверные данные' });
        }

        if (user.banned) {
            return res.status(403).json({ error: 'Аккаунт заблокирован' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Неверные данные' });
        }

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        res.json({
            success: true,
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Ошибка входа' });
    }
});

// Logout
router.post('/logout', (req, res) => {
    res.json({ success: true });
});

// Refresh token
router.post('/refresh', (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(401).json({ error: 'Токен не предоставлен' });
        }

        const decoded = verifyRefreshToken(refreshToken);
        if (!decoded) {
            return res.status(401).json({ error: 'Недействительный токен' });
        }

        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
        if (!user || user.banned) {
            return res.status(401).json({ error: 'Пользователь не найден' });
        }

        const accessToken = generateAccessToken(user);
        const newRefreshToken = generateRefreshToken(user);

        res.json({
            accessToken,
            refreshToken: newRefreshToken
        });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка обновления токена' });
    }
});

// Get current user
router.get('/me', authMiddleware, (req, res) => {
    try {
        const user = db.prepare(`
            SELECT u.id, u.username, u.email, u.role, u.hwid, u.telegram, u.avatar,
                   u.banned, u.free_resets, u.created_at,
                   k.key as license_key, k.status as keyStatus, k.expires_at as expiresAt
            FROM users u
            LEFT JOIN keys k ON k.owner_id = u.id AND k.status = 'ACTIVE'
            WHERE u.id = ?
        `).get(req.user.id);

        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка получения данных' });
    }
});

module.exports = router;
