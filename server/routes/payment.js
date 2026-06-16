/**
 * Payment Routes - Products, Prices
 * Cynex Client API
 */

const express = require('express');
const { db } = require('../database');
const { authMiddleware } = require('../auth');

const router = express.Router();

// Get products
router.get('/products', (req, res) => {
    try {
        const products = db.prepare('SELECT * FROM products WHERE active = 1').all();
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка получения продуктов' });
    }
});

// Get prices
router.get('/payment/prices', (req, res) => {
    try {
        const products = db.prepare('SELECT id, name, price_usd, price_rub FROM products WHERE active = 1').all();
        
        const usd = {};
        const rub = {};
        
        products.forEach(p => {
            usd[p.id] = p.price_usd;
            rub[p.id] = p.price_rub;
        });

        res.json({ usd, rub });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка получения цен' });
    }
});

// Create payment (crypto)
router.post('/payment/create', authMiddleware, (req, res) => {
    try {
        const { productId, promoCode } = req.body;
        
        const product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(productId);
        if (!product) {
            return res.status(404).json({ error: 'Продукт не найден' });
        }

        // TODO: Integrate with crypto payment provider
        res.json({ 
            success: true, 
            message: 'Платеж создан',
            paymentUrl: 'https://example.com/pay'
        });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка создания платежа' });
    }
});

// Validate promo
router.post('/payment/validate-promo', (req, res) => {
    try {
        const { code } = req.body;

        const promo = db.prepare('SELECT * FROM promos WHERE code = ?').get(code);
        
        if (!promo) {
            return res.status(404).json({ error: 'Промокод не найден' });
        }

        if (promo.used_activations >= promo.activations) {
            return res.status(400).json({ error: 'Промокод использован' });
        }

        res.json({ 
            success: true, 
            discount: promo.discount,
            promoId: promo.id
        });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка проверки промокода' });
    }
});

// Download loader
router.get('/download/loader', authMiddleware, (req, res) => {
    // TODO: Add actual loader file
    res.status(404).json({ error: 'Загрузчик недоступен' });
});

module.exports = router;
