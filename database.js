/**
 * Database Module - SQLite with better-sqlite3
 * Cynex Client API
 */

const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'cynex.db'));

// Initialize tables
function initDatabase() {
    // Users table
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'USER',
            hwid TEXT,
            avatar TEXT,
            telegram TEXT,
            banned INTEGER DEFAULT 0,
            free_resets INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // License keys table
    db.exec(`
        CREATE TABLE IF NOT EXISTS keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE NOT NULL,
            days INTEGER DEFAULT 30,
            activations INTEGER DEFAULT 1,
            used_activations INTEGER DEFAULT 0,
            status TEXT DEFAULT 'NONE',
            owner_id INTEGER,
            hwid TEXT,
            expires_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (owner_id) REFERENCES users(id)
        )
    `);

    // HWID reset tokens table
    db.exec(`
        CREATE TABLE IF NOT EXISTS hwid_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            token TEXT UNIQUE NOT NULL,
            used INTEGER DEFAULT 0,
            used_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (used_by) REFERENCES users(id)
        )
    `);

    // Promo codes table
    db.exec(`
        CREATE TABLE IF NOT EXISTS promos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            discount INTEGER DEFAULT 0,
            activations INTEGER DEFAULT 1,
            used_activations INTEGER DEFAULT 0,
            author TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Products table
    db.exec(`
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            price_usd REAL,
            price_rub REAL,
            days INTEGER,
            activations INTEGER DEFAULT 1,
            active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Payments table
    db.exec(`
        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            product_id INTEGER,
            amount REAL,
            currency TEXT,
            status TEXT DEFAULT 'pending',
            payment_id TEXT,
            promo_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (product_id) REFERENCES products(id)
        )
    `);

    // Server settings table
    db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    `);

    // Create default admin if not exists
    const adminExists = db.prepare('SELECT id FROM users WHERE role = ?').get('ADMIN');
    if (!adminExists) {
        const bcrypt = require('bcryptjs');
        const hashedPassword = bcrypt.hashSync('admin123', 10);
        db.prepare(`
            INSERT INTO users (username, email, password, role)
            VALUES (?, ?, ?, ?)
        `).run('admin', 'admin@cynex.local', hashedPassword, 'ADMIN');
        console.log('✅ Default admin created: admin / admin123');
    }

    // Insert default settings
    const defaultSettings = [
        ['maintenance', 'false'],
        ['mode', 'normal']
    ];
    
    const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
    for (const [key, value] of defaultSettings) {
        insertSetting.run(key, value);
    }

    console.log('✅ Database initialized');
}

module.exports = { db, initDatabase };
