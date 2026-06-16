/**
 * License Routes - Key activation, HWID
 * Cynex Client API
 */

const express = require('express');
const { db } = require('../database');
const { authMiddleware } = require('../auth');

const router = express.Router();

// Bind/Activate license key
router.post('/bind', authMiddleware, (req, res) => {
    try {
        const { key } = req.body;

        if (!key) {
            return res.status(400).json({ error: 'Введите ключ' });
        }

        // Find key
        const licenseKey = db.prepare('SELECT * FROM keys WHERE key = ?').get(key);
        
        if (!licenseKey) {
            return res.status(404).json({ error: 'Ключ не найден' });
        }

        if (licenseKey.status === 'BANNED') {
            return res.status(403).json({ error: 'Ключ заблокирован' });
        }

        // Check activations
        if (licenseKey.activations > 0 && licenseKey.used_activations >= licenseKey.activations) {
            return res.status(400).json({ error: 'Ключ уже использован' });
        }

        // Check if already owned by another user
        if (licenseKey.owner_id && licenseKey.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Ключ принадлежит другому пользователю' });
        }

        const user = db.prepare('SELECT hwid FROM users WHERE id = ?').get(req.user.id);

        // Calculate expiration
        let expiresAt = null;
        if (licenseKey.days > 0) {
            const now = new Date();
            now.setDate(now.getDate() + licenseKey.days);
            expiresAt = now.toISOString();
        }

        // Update key
        db.prepare(`
            UPDATE keys SET 
                owner_id = ?,
                status = 'ACTIVE',
                used_activations = used_activations + 1,
                hwid = ?,
                expires_at = ?
            WHERE id = ?
        `).run(req.user.id, user.hwid || null, expiresAt, licenseKey.id);

        res.json({ success: true, expiresAt });
    } catch (error) {
        console.error('Bind error:', error);
        res.status(500).json({ error: 'Ошибка активации' });
    }
});

// HWID reset with token
router.post('/hwid/reset', authMiddleware, (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Введите токен' });
        }

        const tokenData = db.prepare('SELECT * FROM hwid_tokens WHERE token = ?').get(token);

        if (!tokenData) {
            return res.status(404).json({ error: 'Токен не найден' });
        }

        if (tokenData.used) {
            return res.status(400).json({ error: 'Токен уже использован' });
        }

        // Reset HWID
        db.prepare('UPDATE users SET hwid = NULL WHERE id = ?').run(req.user.id);
        db.prepare('UPDATE keys SET hwid = NULL WHERE owner_id = ?').run(req.user.id);
        
        // Mark token as used
        db.prepare('UPDATE hwid_tokens SET used = 1, used_by = ? WHERE id = ?')
            .run(req.user.id, tokenData.id);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сброса HWID' });
    }
});

// Free HWID reset
router.post('/hwid/reset-free', authMiddleware, (req, res) => {
    try {
        const user = db.prepare('SELECT free_resets FROM users WHERE id = ?').get(req.user.id);

        if (!user || user.free_resets <= 0) {
            return res.status(400).json({ error: 'Нет бесплатных сбросов' });
        }

        // Reset HWID
        db.prepare('UPDATE users SET hwid = NULL, free_resets = free_resets - 1 WHERE id = ?').run(req.user.id);
        db.prepare('UPDATE keys SET hwid = NULL WHERE owner_id = ?').run(req.user.id);

        res.json({ success: true, resetsLeft: user.free_resets - 1 });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сброса HWID' });
    }
});

module.exports = router;
