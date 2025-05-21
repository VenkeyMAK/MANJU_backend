import express from 'express';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import Order from '../models/Order.js';
import connectDB from '../db.js';
import auth from '../middleware/auth.js';

dotenv.config();
const router = express.Router();

// Create a transport with Hostinger SMTP settings
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.hostinger.com',
  port: process.env.EMAIL_PORT || 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER || 'murugan@arjanapartners.in',
    pass: process.env.EMAIL_PASSWORD || 'Murugan@123'
  },
  debug: true,
  tls: {
    rejectUnauthorized: false,
    ciphers: 'SSLv3'
  }
});

// Add this verification to check SMTP connection
transporter.verify(function (error, success) {
  if (error) {
    console.log("SMTP Error:", error);
  } else {
    console.log("SMTP Server is ready to take our messages");
  }
});

// POST route for creating a new order (protected route)
router.post('/orders', auth, async (req, res) => {
  try {
    const db = await connectDB();
    const orderData = {
      ...req.body,
      user: req.user.id // Add user ID from auth middleware
    };
    
    const order = await Order.create(db, orderData);

    // Send confirmation email
    const mailOptions = {
      from: 'murugan@arjanapartners.in',
      to: orderData.email,
      subject: `Order Confirmation - ${orderData.orderNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h3 style="color: #333;">Thank you for your order!</h3>
          <p>Order Number: <strong>${orderData.orderNumber}</strong></p>
          <p>Total: ₹${orderData.total}</p>
          <p>Delivery Pincode: ${orderData.pincode}</p>
          <p>We'll contact you at: ${orderData.mobile}</p>
          <p style="color: #666;">If you have any questions, please contact us.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    res.json({ 
      success: true, 
      message: 'Order placed successfully',
      order 
    });
  } catch (err) {
    console.error('Error creating order:', err);
    res.status(500).json({ error: 'Failed to place order' });
  }
});

// GET route for fetching user's orders (protected route)
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

// Keep the existing routes for backward compatibility
router.post('/users/orders', auth, async (req, res) => {
  try {
    const db = await connectDB();
    const orderData = {
      ...req.body,
      user: req.user.id
    };
    
    const order = await Order.create(db, orderData);

    const mailOptions = {
      from: 'murugan@arjanapartners.in',
      to: orderData.email,
      subject: `Order Confirmation - ${orderData.orderNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h3 style="color: #333;">Thank you for your order!</h3>
          <p>Order Number: <strong>${orderData.orderNumber}</strong></p>
          <p>Total: ₹${orderData.total}</p>
          <p>Delivery Pincode: ${orderData.pincode}</p>
          <p>We'll contact you at: ${orderData.mobile}</p>
          <p style="color: #666;">If you have any questions, please contact us.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    res.json({ 
      success: true, 
      message: 'Order placed successfully',
      order 
    });
  } catch (err) {
    console.error('Error creating order:', err);
    res.status(500).json({ error: 'Failed to place order' });
  }
});

router.get('/users/orders', auth, async (req, res) => {
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

