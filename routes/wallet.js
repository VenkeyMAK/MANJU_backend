import express from 'express';
import { ObjectId } from 'mongodb';
import connectDB from '../db.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Get wallet balance and transactions
router.get('/balance', auth, async (req, res) => {
    try {
        const db = await connectDB();
        const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.id) });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get wallet data
        const wallet = await db.collection('wallets').findOne({ userId: new ObjectId(req.user.id) });

        if (!wallet) {
            // Create new wallet if it doesn't exist
            const newWallet = {
                userId: new ObjectId(req.user.id),
                balance: 0,
                transactions: []
            };
            await db.collection('wallets').insertOne(newWallet);
            return res.json({ balance: 0, transactions: [] });
        }

        res.json({
            balance: wallet.balance,
            transactions: wallet.transactions || []
        });
    } catch (error) {
        console.error('Error fetching wallet:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
