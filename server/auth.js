/**
 * Auth Middleware - JWT validation
 * Cynex Client API
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'cynex-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'cynex-refresh-secret-change';

// Generate access token (15 minutes)
function generateAccessToken(user) {
    return jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '15m' }
    );
}

// Generate refresh token (7 days)
function generateRefreshToken(user) {
    return jwt.sign(
        { id: user.id },
        JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
    );
}

// Verify access token
function verifyAccessToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch {
        return null;
    }
}

// Verify refresh token
function verifyRefreshToken(token) {
    try {
        return jwt.verify(token, JWT_REFRESH_SECRET);
    } catch {
        return null;
    }
}

// Auth middleware
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Токен не предоставлен' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    if (!decoded) {
        return res.status(401).json({ error: 'Недействительный токен' });
    }

    req.user = decoded;
    next();
}

// Admin middleware
function adminMiddleware(req, res, next) {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPPORT') {
        return res.status(403).json({ error: 'Нет доступа' });
    }
    next();
}

// Admin only middleware
function adminOnlyMiddleware(req, res, next) {
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Только для администраторов' });
    }
    next();
}

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    authMiddleware,
    adminMiddleware,
    adminOnlyMiddleware,
    JWT_SECRET,
    JWT_REFRESH_SECRET
};
