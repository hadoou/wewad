/**
 * User Routes - Profile settings
 * Cynex Client API
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const { db } = require('../database');
const { authMiddleware } = require('../auth');

const router = express.Router();

// Avatar upload config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../uploads'));
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `avatar_${req.user.id}${ext}`);
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/gif'];
        if (!allowed.includes(file.mimetype)) {
            return cb(new Error('Только JPEG, PNG, GIF'));
        }
        cb(null, true);
    }
});

// Set email
router.post('/set-email', authMiddleware, (req, res) => {
    try {
        const { email } = req.body;
        
        db.prepare('UPDATE users SET email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(email, req.user.id);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка изменения email' });
    }
});

// Set telegram
router.post('/set-telegram', authMiddleware, (req, res) => {
    try {
        const { telegram } = req.body;
        
        db.prepare('UPDATE users SET telegram = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(telegram, req.user.id);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка привязки Telegram' });
    }
});

// Change password
router.post('/change-password', authMiddleware, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            return res.status(400).json({ error: 'Введите старый и новый пароль' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Пароль минимум 6 символов' });
        }

        const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id);
        
        const valid = await bcrypt.compare(oldPassword, user.password);
        if (!valid) {
            return res.status(400).json({ error: 'Неверный старый пароль' });
        }

        const hashed = await bcrypt.hash(newPassword, 10);
        db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(hashed, req.user.id);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка смены пароля' });
    }
});

// Upload avatar
router.post('/avatar', authMiddleware, upload.single('avatar'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Файл не загружен' });
        }

        const avatarUrl = `/uploads/${req.file.filename}`;
        db.prepare('UPDATE users SET avatar = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(avatarUrl, req.user.id);

        res.json({ success: true, avatar: avatarUrl });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка загрузки аватара' });
    }
});

// Freeze subscription
router.post('/subscription/freeze', authMiddleware, (req, res) => {
    try {
        const result = db.prepare(`
            UPDATE keys SET status = 'FROZEN' 
            WHERE owner_id = ? AND status = 'ACTIVE'
        `).run(req.user.id);

        if (result.changes === 0) {
            return res.status(400).json({ error: 'Нет активной подписки' });
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка заморозки' });
    }
});

// Unfreeze subscription
router.post('/subscription/unfreeze', authMiddleware, (req, res) => {
    try {
        const result = db.prepare(`
            UPDATE keys SET status = 'ACTIVE' 
            WHERE owner_id = ? AND status = 'FROZEN'
        `).run(req.user.id);

        if (result.changes === 0) {
            return res.status(400).json({ error: 'Нет замороженной подписки' });
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка разморозки' });
    }
});

module.exports = router;
