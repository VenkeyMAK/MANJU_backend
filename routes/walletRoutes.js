import express from 'express';
import { ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import auth from '../middleware/auth.js';
import User from '../models/User.js';
import WalletTransaction from '../models/WalletTransaction.js';
import Order from '../models/Order.js';
import Notification from '../models/Notification.js';
import connectDB from '../db.js';
import CommissionService from '../services/commissionService.js';

dotenv.config();
const router = express.Router();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.hostinger.com',
  port: process.env.EMAIL_PORT || 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER || 'murugan@arjanapartners.in',
    pass: process.env.EMAIL_PASSWORD || 'Murugan@123'
  },
  tls: {
    rejectUnauthorized: false
  },
  connectionTimeout: 10000, 
  maxConnections: 5,
  maxMessages: 100,
  pool: true, 
  rateDelta: 1000, 
  rateLimit: 5, 
  requireTLS: true
});

const sendEmailWithRetry = async (mailOptions, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await transporter.sendMail(mailOptions);
      console.log('Email sent successfully');
      return true;
    } catch (error) {
      console.error(`Email attempt ${attempt} failed:`, error);
      if (attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
};


// @route   GET api/wallet/balance
// @desc    Get current user's wallet balance
// @access  Private
router.get('/balance', auth, async (req, res) => {
  try {
    const db = await connectDB();
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(req.user.id) }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const transactions = await WalletTransaction.findByUserId(req.user.id);
    
    res.json({
      walletBalance: user.walletBalance || 0,
      transactions: transactions || []
    });
  } catch (err) {
    console.error('Error fetching wallet:', err);
    res.status(500).json({ 
      error: 'Failed to fetch wallet',
      details: err.message 
    });
  }
});

// @route   GET api/wallet/transactions
// @desc    Get current user's wallet transaction history
// @access  Private
router.get('/transactions', auth, async (req, res) => {
  try {
    const transactions = await WalletTransaction.findByUserId(req.user.id);
    res.json(transactions);
  } catch (err) {
    console.error('Error fetching transactions:', err);
    res.status(500).json({ 
      error: 'Failed to fetch transactions',
      details: err.message 
    });
  }
});

// @route   POST api/wallet/purchase
// @desc    Create an order using wallet balance
// @access  Private
router.post('/purchase', auth, async (req, res) => {
    const { total, ...orderData } = req.body;

    if (!total || !Number.isFinite(total) || total <= 0) {
        return res.status(400).json({ msg: 'Invalid order total.' });
    }

    const db = await connectDB();
    const client = db.client;
    const session = client.startSession();

    let savedOrder;

    try {
        await session.withTransaction(async () => {
            const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.id) }, { session });

            if (!user) {
                throw new Error('User not found');
            }
            if ((user.walletBalance || 0) < total) {
                throw new Error('Insufficient wallet balance.');
            }

            const orderCollection = db.collection('orders');
            const orderNumber = `ORD-${Date.now()}`;
            const newOrder = {
                ...orderData,
                orderNumber,
                total,
                user: new ObjectId(req.user.id),
                paymentMethod: 'Wallet',
                status: 'Paid',
                createdAt: new Date()
            };
            const orderResult = await orderCollection.insertOne(newOrder, { session });
            savedOrder = { ...newOrder, _id: orderResult.insertedId };

            const debitTransaction = {
                userId: new ObjectId(req.user.id),
                amount: -total,
                type: 'debit',
                description: `Purchase for Order ${orderNumber}`,
                status: 'completed',
                relatedOrderId: savedOrder._id,
                createdAt: new Date()
            };
            await db.collection('wallet_transactions').insertOne(debitTransaction, { session });

            await User.updateWalletBalance(req.user.id, -total, session);

            await CommissionService.distribute(savedOrder);
        });

        if (savedOrder) {
            try {
                await sendEmailWithRetry({
                    from: process.env.EMAIL_USER || 'murugan@arjanapartners.in',
                    to: savedOrder.email,
                    subject: `Order Confirmation - ${savedOrder.orderNumber}`,
                    html: `<p>Your order ${savedOrder.orderNumber} has been confirmed and paid with your wallet.</p>`
                });
            } catch (emailError) {
                console.error(`Post-purchase email failed for order ${savedOrder.orderNumber}:`, emailError);
            }
        }

        res.status(201).json({ message: 'Purchase successful', orderId: savedOrder._id });

    } catch (error) {
        console.error('Wallet purchase transaction failed:', error);
        res.status(500).json({ msg: error.message || 'Server Error' });
    } finally {
        await session.endSession();
    }
});


export default router;
