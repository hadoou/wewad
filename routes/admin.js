/**
 * Admin Routes - Keys, Users, HWID, Promos
 * Cynex Client API
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');
const { authMiddleware, adminMiddleware, adminOnlyMiddleware } = require('../auth');

const router = express.Router();

// All admin routes require auth + admin role
router.use(authMiddleware);
router.use(adminMiddleware);

// ==================== KEYS ====================

// Generate keys
router.post('/admin/keys/generate', (req, res) => {
    try {
        const { count = 1, days = 30, activations = 1 } = req.body;

        const keys = [];
        const insert = db.prepare('INSERT INTO keys (key, days, activations, status) VALUES (?, ?, ?, ?)');

        for (let i = 0; i < count; i++) {
            const key = generateKey();
            insert.run(key, days, activations, 'NONE');
            keys.push(key);
        }

        res.json({ success: true, keys, count });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка генерации ключей' });
    }
});

// Add custom key
router.post('/admin/keys/add', (req, res) => {
    try {
        const { key, days = 30, activations = 1 } = req.body;

        if (!key) {
            return res.status(400).json({ error: 'Введите ключ' });
        }

        const existing = db.prepare('SELECT id FROM keys WHERE key = ?').get(key);
        if (existing) {
            return res.status(400).json({ error: 'Ключ уже существует' });
        }

        db.prepare('INSERT INTO keys (key, days, activations, status) VALUES (?, ?, ?, ?)')
            .run(key, days, activations, 'NONE');

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка добавления ключа' });
    }
});

// Extend all active keys
router.post('/admin/keys/extend-all', adminOnlyMiddleware, (req, res) => {
    try {
        const { days } = req.body;

        if (days === 0) {
            // Lifetime
            db.prepare("UPDATE keys SET expires_at = NULL WHERE status = 'ACTIVE'").run();
        } else {
            // Add days
            const keys = db.prepare("SELECT id, expires_at FROM keys WHERE status = 'ACTIVE'").all();
            
            for (const key of keys) {
                let newDate;
                if (key.expires_at) {
                    newDate = new Date(key.expires_at);
                    newDate.setDate(newDate.getDate() + days);
                } else {
                    newDate = new Date();
                    newDate.setDate(newDate.getDate() + days);
                }
                db.prepare('UPDATE keys SET expires_at = ? WHERE id = ?').run(newDate.toISOString(), key.id);
            }
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка продления ключей' });
    }
});

// Get free keys
router.get('/admin/keys/free', (req, res) => {
    try {
        const keys = db.prepare(`
            SELECT k.*, u.username as owner 
            FROM keys k 
            LEFT JOIN users u ON k.owner_id = u.id
            ORDER BY k.created_at DESC
        `).all();
        res.json(keys);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка получения ключей' });
    }
});

// Ban key
router.post('/admin/keys/:id/ban', (req, res) => {
    try {
        db.prepare("UPDATE keys SET status = 'BANNED' WHERE id = ?").run(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка блокировки' });
    }
});

// Unban key
router.post('/admin/keys/:id/unban', (req, res) => {
    try {
        db.prepare("UPDATE keys SET status = 'ACTIVE' WHERE id = ?").run(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка разблокировки' });
    }
});

// Extend key
router.post('/admin/keys/:id/extend', (req, res) => {
    try {
        const { days } = req.body;
        const key = db.prepare('SELECT * FROM keys WHERE id = ?').get(req.params.id);

        if (!key) {
            return res.status(404).json({ error: 'Ключ не найден' });
        }

        if (days === 0) {
            db.prepare('UPDATE keys SET expires_at = NULL WHERE id = ?').run(req.params.id);
        } else {
            let newDate;
            if (key.expires_at) {
                newDate = new Date(key.expires_at);
                newDate.setDate(newDate.getDate() + days);
            } else {
                newDate = new Date();
                newDate.setDate(newDate.getDate() + days);
            }
            db.prepare('UPDATE keys SET expires_at = ? WHERE id = ?').run(newDate.toISOString(), req.params.id);
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка продления' });
    }
});

// Delete key
router.delete('/admin/keys/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM keys WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка удаления' });
    }
});

// Bulk operations
router.post('/admin/keys/bulk', (req, res) => {
    try {
        const { action, keyIds, days } = req.body;

        if (!keyIds || !keyIds.length) {
            return res.status(400).json({ error: 'Выберите ключи' });
        }

        const placeholders = keyIds.map(() => '?').join(',');

        switch (action) {
            case 'extend':
                keyIds.forEach(id => {
                    const key = db.prepare('SELECT expires_at FROM keys WHERE id = ?').get(id);
                    let newDate = key.expires_at ? new Date(key.expires_at) : new Date();
                    newDate.setDate(newDate.getDate() + days);
                    db.prepare('UPDATE keys SET expires_at = ? WHERE id = ?').run(newDate.toISOString(), id);
                });
                break;
            case 'ban':
                db.prepare(`UPDATE keys SET status = 'BANNED' WHERE id IN (${placeholders})`).run(...keyIds);
                break;
            case 'delete':
                db.prepare(`DELETE FROM keys WHERE id IN (${placeholders})`).run(...keyIds);
                break;
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка операции' });
    }
});

// Helper function
function generateKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = '';
    for (let i = 0; i < 16; i++) {
        if (i > 0 && i % 4 === 0) key += '-';
        key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
}

module.exports = router;

// ==================== USERS ====================

// Get all users
router.get('/admin/users', (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const search = req.query.search || '';
        const offset = (page - 1) * limit;

        let whereClause = '1=1';
        let params = [];

        if (search) {
            whereClause = '(username LIKE ? OR email LIKE ?)';
            params = [`%${search}%`, `%${search}%`];
        }

        const users = db.prepare(`
            SELECT u.id, u.username, u.email, u.role, u.banned, u.created_at,
                   k.status as keyStatus
            FROM users u
            LEFT JOIN keys k ON k.owner_id = u.id AND k.status = 'ACTIVE'
            WHERE ${whereClause}
            ORDER BY u.created_at DESC
            LIMIT ? OFFSET ?
        `).all(...params, limit, offset);

        const totalResult = db.prepare(`SELECT COUNT(*) as count FROM users WHERE ${whereClause}`).get(...params);

        res.json({ users, total: totalResult.count, page, limit });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка получения пользователей' });
    }
});

// Ban user
router.post('/admin/users/:id/ban', (req, res) => {
    try {
        db.prepare('UPDATE users SET banned = 1 WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка блокировки' });
    }
});

// Unban user
router.post('/admin/users/:id/unban', (req, res) => {
    try {
        db.prepare('UPDATE users SET banned = 0 WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка разблокировки' });
    }
});

// Delete user
router.delete('/admin/users/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка удаления' });
    }
});

// Reset user HWID
router.post('/admin/users/:id/reset-hwid', (req, res) => {
    try {
        db.prepare('UPDATE users SET hwid = NULL WHERE id = ?').run(req.params.id);
        db.prepare('UPDATE keys SET hwid = NULL WHERE owner_id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сброса HWID' });
    }
});

// ==================== HWID TOKENS ====================

// Generate HWID tokens
router.post('/admin/hwid/generate', (req, res) => {
    try {
        const { count = 1 } = req.body;
        const tokens = [];

        for (let i = 0; i < count; i++) {
            const token = uuidv4();
            db.prepare('INSERT INTO hwid_tokens (token) VALUES (?)').run(token);
            tokens.push(token);
        }

        res.json({ success: true, tokens });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка генерации токенов' });
    }
});

// List HWID tokens
router.get('/admin/hwid/list', (req, res) => {
    try {
        const tokens = db.prepare('SELECT * FROM hwid_tokens ORDER BY created_at DESC').all();
        res.json(tokens);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка получения токенов' });
    }
});

// Delete HWID token
router.delete('/admin/hwid/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM hwid_tokens WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка удаления токена' });
    }
});

// ==================== PROMOS ====================

// Create promo
router.post('/admin/promos/create', (req, res) => {
    try {
        const { code, discount = 0, activations = 1, author } = req.body;

        if (!code) {
            return res.status(400).json({ error: 'Введите код' });
        }

        const existing = db.prepare('SELECT id FROM promos WHERE code = ?').get(code);
        if (existing) {
            return res.status(400).json({ error: 'Промокод уже существует' });
        }

        db.prepare('INSERT INTO promos (code, discount, activations, author) VALUES (?, ?, ?, ?)')
            .run(code, discount, activations, author);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка создания промокода' });
    }
});

// List promos
router.get('/admin/promos/list', (req, res) => {
    try {
        const promos = db.prepare('SELECT * FROM promos ORDER BY created_at DESC').all();
        res.json(promos);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка получения промокодов' });
    }
});

// Delete promo
router.delete('/admin/promos/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM promos WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка удаления промокода' });
    }
});
