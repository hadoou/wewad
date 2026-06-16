/**
 * Cynex Client API Server
 * Main entry point
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./database');

// Initialize database
initDatabase();

// Create app
const app = express();

// CORS configuration
app.use(cors({
    origin: true,
    credentials: true
}));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api', require('./routes/auth'));
app.use('/api/user', require('./routes/user'));
app.use('/api/key', require('./routes/license'));
app.use('/api', require('./routes/payment'));
app.use('/api', require('./routes/admin'));

// Server status
app.get('/api/status', (req, res) => {
    res.json({ 
        status: 'online', 
        maintenance: false, 
        mode: 'normal',
        version: '1.0.0'
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ ok: true });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Эндпоинт не найден' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Cynex API running on port ${PORT}`);
    console.log(`📡 http://localhost:${PORT}`);
});
