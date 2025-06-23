import express from 'express';
import { ObjectId } from 'mongodb';
import connectDB from '../db.js';
import auth from '../middleware/auth.js';
import WalletTransaction from '../models/WalletTransaction.js';

const router = express.Router();

// Get wallet balance and transactions
router.get('/balance', auth, async (req, res) => {
    try {
        const db = await connectDB();
        const transactions = await WalletTransaction.findByUserId(req.user.id);
        
        // Calculate balance from transactions
        const balance = transactions.reduce((acc, trans) => {
            return acc + (trans.amount || 0);
        }, 0);

        // Get user details
        const user = await db.collection('users').findOne(
            { _id: new ObjectId(req.user.id) },
            { projection: { walletBalance: 1 } }
        );

        res.json({
            balance: user?.walletBalance || balance || 0,
            transactions: transactions
        });

    } catch (error) {
        console.error('Error fetching wallet:', error);
        res.status(500).json({ 
            error: 'Failed to fetch wallet balance',
            details: error.message 
        });
    }
});

// Get transaction history
router.get('/transactions', auth, async (req, res) => {
    try {
        const transactions = await WalletTransaction.findByUserId(req.user.id);
        res.json(transactions);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ 
            error: 'Failed to fetch transactions',
            details: error.message 
        });
    }
});

export default router;
