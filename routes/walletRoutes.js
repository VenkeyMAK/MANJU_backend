import express from 'express';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import auth from '../middleware/auth.js';
import User from '../models/User.js';
import WalletTransaction from '../models/WalletTransaction.js';
import Order from '../models/Order.js';
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
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    res.json({ walletBalance: user.walletBalance || 0 });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/wallet/transactions
// @desc    Get current user's wallet transaction history
// @access  Private
router.get('/transactions', auth, async (req, res) => {
  try {
    const transactions = await WalletTransaction.find({ user: req.user.id }).sort({ date: -1 });
    res.json(transactions);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/wallet/purchase
// @desc    Create an order using wallet balance
// @access  Private
router.post('/purchase', auth, async (req, res) => {
    const { total, ...orderDataWithoutTotal } = req.body;

    if (!total || total <= 0) {
        return res.status(400).json({ msg: 'Invalid order total.' });
    }

    try {
        const db = await connectDB();
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        if (user.walletBalance < total) {
            return res.status(400).json({ msg: 'Insufficient wallet balance.' });
        }

        const orderPayload = {
            ...orderDataWithoutTotal,
            total,
            user: req.user.id,
            paymentMethod: 'Wallet',
            status: 'Paid'
        };
        const order = await Order.create(db, orderPayload);

        // Deduct from wallet and create transaction
        user.walletBalance -= total;
        await user.save();

        const transaction = new WalletTransaction({
            user: req.user.id,
            amount: -total,
            type: 'debit',
            description: `Purchase for Order #${order.orderNumber}`,
        });
        await transaction.save();

        await CommissionService.distribute(order);

        try {
            await sendEmailWithRetry({
                from: process.env.EMAIL_USER || 'murugan@arjanapartners.in',
                to: order.email,
                subject: `Order Confirmation - ${order.orderNumber}`,
                html: `
                  <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h3>Your order has been successfully paid for using your wallet!</h3>
                    <p>Order Number: <strong>${order.orderNumber}</strong></p>
                    <p>Total: ₹${order.total}</p>
                  </div>
                `
            });
        } catch (emailError) {
            console.error('Wallet purchase email sending failed:', emailError);
        }

        res.status(201).json({ success: true, message: 'Purchase successful!', order });

    } catch (err) {
        console.error('Wallet purchase error:', err);
        res.status(500).send('Server Error');
    }
});


export default router;
