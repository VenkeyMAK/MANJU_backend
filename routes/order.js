import express from 'express';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import Order from '../models/Order.js';
import connectDB from '../db.js';
import auth from '../middleware/auth.js';
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
  // Add connection timeout and retry options
  connectionTimeout: 10000, // 10 seconds
  maxConnections: 5,
  maxMessages: 100,
  pool: true, // Use pooled connections
  rateDelta: 1000, // Wait 1 second between retries
  rateLimit: 5, // 5 emails per second
  requireTLS: true
});

// Add retry logic for email sending
const sendEmailWithRetry = async (mailOptions, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await transporter.sendMail(mailOptions);
      console.log('Email sent successfully');
      return true;
    } catch (error) {
      console.error(`Email attempt ${attempt} failed:`, error);
      if (attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // Exponential backoff
    }
  }
};

router.post('/orders', auth, async (req, res) => {
  try {
    const db = await connectDB();
    const orderData = {
      ...req.body,
      user: req.user.id
    };

    const order = await Order.create(db, orderData);

    try {
      await sendEmailWithRetry({
        from: process.env.EMAIL_USER || 'murugan@arjanapartners.in',
        to: orderData.email,
        subject: `Order Confirmation - ${order.orderNumber}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h3>Thank you for your order!</h3>
            <p>Order Number: <strong>${order.orderNumber}</strong></p>
            <p>Total: ₹${order.total}</p>
            <p>We'll contact you at: ${order.mobile}</p>
          </div>
        `
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Continue with order processing even if email fails
    }

    // Distribute commissions after successful order creation
    await CommissionService.distribute(order);

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      order
    });
  } catch (err) {
    console.error('Error creating order:', err);
    res.status(500).json({ error: 'Failed to place order' });
  }
});

router.get('/orders', auth, async (req, res) => {
  try {
    const db = await connectDB();
    const orders = await Order.findByUserId(db, req.user.id);
    res.json(orders);
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

export default router;

