/**
 * Auth Routes - Login, Register, Logout
 * Cynex Client API (PostgreSQL)
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../database');
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

        const existing = await query('SELECT id FROM users WHERE username = $1', [username]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Пользователь уже существует' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await query(`
            INSERT INTO users (username, email, password, role)
            VALUES ($1, $2, $3, 'USER')
            RETURNING id, username, email, role, created_at
        `, [username, email || null, hashedPassword]);

        const user = result.rows[0];

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

        const result = await query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        
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
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(401).json({ error: 'Токен не предоставлен' });
        }

        const decoded = verifyRefreshToken(refreshToken);
        if (!decoded) {
            return res.status(401).json({ error: 'Недействительный токен' });
        }

        const result = await query('SELECT * FROM users WHERE id = $1', [decoded.id]);
        const user = result.rows[0];
        
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
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const result = await query(`
            SELECT u.id, u.username, u.email, u.role, u.hwid, u.telegram, u.avatar,
                   u.banned, u.free_resets, u.created_at,
                   k.key as license_key, k.status as "keyStatus", k.expires_at as "expiresAt"
            FROM users u
            LEFT JOIN keys k ON k.owner_id = u.id AND k.status = 'ACTIVE'
            WHERE u.id = $1
        `, [req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка получения данных' });
    }
});

module.exports = router;
