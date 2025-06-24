import express from 'express';
import { ObjectId } from 'mongodb';
import connectDB from '../db.js';

const router = express.Router();

// GET /api/cart - Get all cart items
router.get('/', async (req, res) => {
    try {
        const db = await connectDB();
        const collection = db.collection('cart');
        const cartItems = await collection.find({}).toArray();
        res.json(cartItems);
    } catch (err) {
        console.error('Error fetching cart:', err);
        res.status(500).json({ error: 'Failed to fetch cart', details: err.message });
    }
});

// POST /api/cart - Add item to cart
router.post('/', async (req, res) => {
    try {
        const db = await connectDB();
        const collection = db.collection('cart');
        const result = await collection.insertOne(req.body);
        res.status(201).json(result);
    } catch (err) {
        console.error('Error adding to cart:', err);
        res.status(500).json({ error: 'Failed to add to cart', details: err.message });
    }
});

// DELETE /api/cart/:id - Remove item from cart
router.delete('/:id', async (req, res) => {
    try {
        const db = await connectDB();
        const collection = db.collection('cart');
        const result = await collection.deleteOne({ _id: new ObjectId(req.params.id) });
        res.json(result);
    } catch (err) {
        console.error('Error removing from cart:', err);
        res.status(500).json({ error: 'Failed to remove from cart', details: err.message });
    }
});

export default router; 