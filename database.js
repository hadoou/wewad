/**
 * Database Module - PostgreSQL
 * Cynex Client API
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Query helper
async function query(text, params) {
    const start = Date.now();
    const res = await pool.query(text, params);
    return res;
}

// Initialize tables
async function initDatabase() {
    try {
        // Users table
        await query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100),
                password VARCHAR(255) NOT NULL,
                role VARCHAR(20) DEFAULT 'USER',
                hwid VARCHAR(255),
                avatar VARCHAR(255),
                telegram VARCHAR(100),
                banned BOOLEAN DEFAULT false,
                free_resets INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // License keys table
        await query(`
            CREATE TABLE IF NOT EXISTS keys (
                id SERIAL PRIMARY KEY,
                key VARCHAR(50) UNIQUE NOT NULL,
                days INTEGER DEFAULT 30,
                activations INTEGER DEFAULT 1,
                used_activations INTEGER DEFAULT 0,
                status VARCHAR(20) DEFAULT 'NONE',
                owner_id INTEGER REFERENCES users(id),
                hwid VARCHAR(255),
                expires_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // HWID reset tokens table
        await query(`
            CREATE TABLE IF NOT EXISTS hwid_tokens (
                id SERIAL PRIMARY KEY,
                token VARCHAR(255) UNIQUE NOT NULL,
                used BOOLEAN DEFAULT false,
                used_by INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Promo codes table
        await query(`
            CREATE TABLE IF NOT EXISTS promos (
                id SERIAL PRIMARY KEY,
                code VARCHAR(50) UNIQUE NOT NULL,
                discount INTEGER DEFAULT 0,
                activations INTEGER DEFAULT 1,
                used_activations INTEGER DEFAULT 0,
                author VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Products table
        await query(`
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                price_usd DECIMAL(10,2),
                price_rub DECIMAL(10,2),
                days INTEGER,
                activations INTEGER DEFAULT 1,
                active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create default admin if not exists
        const bcrypt = require('bcryptjs');
        const adminCheck = await query('SELECT id FROM users WHERE role = $1', ['ADMIN']);
        
        if (adminCheck.rows.length === 0) {
            const hashedPassword = bcrypt.hashSync('admin123', 10);
            await query(`
                INSERT INTO users (username, email, password, role)
                VALUES ($1, $2, $3, $4)
            `, ['admin', 'admin@cynex.local', hashedPassword, 'ADMIN']);
            console.log('✅ Default admin created: admin / admin123');
        }

        console.log('✅ Database initialized');
    } catch (error) {
        console.error('Database init error:', error);
    }
}

module.exports = { query, initDatabase, pool };
