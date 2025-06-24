import express from 'express';
import { ObjectId } from 'mongodb';
import connectDB from '../db.js';

const router = express.Router();

// GET /api/wishlist - Get all wishlist items
router.get('/', async (req, res) => {
    try {
        const db = await connectDB();
        const collection = db.collection('wishlist');
        const wishlistItems = await collection.find({}).toArray();
        res.json(wishlistItems);
    } catch (err) {
        console.error('Error fetching wishlist:', err);
        res.status(500).json({ error: 'Failed to fetch wishlist', details: err.message });
    }
});

// POST /api/wishlist - Add item to wishlist
router.post('/', async (req, res) => {
    try {
        const db = await connectDB();
        const collection = db.collection('wishlist');
        const result = await collection.insertOne(req.body);
        res.status(201).json(result);
    } catch (err) {
        console.error('Error adding to wishlist:', err);
        res.status(500).json({ error: 'Failed to add to wishlist', details: err.message });
    }
});

// DELETE /api/wishlist/:id - Remove item from wishlist
router.delete('/:id', async (req, res) => {
    try {
        const db = await connectDB();
        const collection = db.collection('wishlist');
        const result = await collection.deleteOne({ _id: new ObjectId(req.params.id) });
        res.json(result);
    } catch (err) {
        console.error('Error removing from wishlist:', err);
        res.status(500).json({ error: 'Failed to remove from wishlist', details: err.message });
    }
});

export default router; 