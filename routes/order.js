import express from 'express';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import Order from '../models/Order.js';
import connectDB from '../db.js';
import auth from '../middleware/auth.js';
import { isAdmin } from '../middleware/role.js';
import CommissionService from '../services/commissionService.js';
import { ObjectId } from 'mongodb';

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



// POST /api/orders - Create new order
router.post('/', auth, async (req, res) => {
    try {
        const db = await connectDB();
        const { items, shippingInfo, email, mobile, paymentMethod, total } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ error: 'Order must contain at least one item.' });
        }

        // Items are now expected to be complete from the request, including category and costPrice.
        // The backend will no longer enrich them from the database.
        const newOrderData = {
            user: new ObjectId(req.user.id),
            items,
            total,
            shippingInfo,
            email,
            mobile,
            paymentMethod,
        };

        const newOrder = await Order.create(db, newOrderData);
        
        res.status(201).json({ success: true, data: newOrder });

    } catch (err) {
        console.error('Error creating order:', err);
        res.status(500).json({ error: 'Failed to create order', details: err.message });
    }
});



router.get('/my-orders', auth, async (req, res) => {
  try {
    const db = await connectDB();
    const orders = await Order.findByUserId(db, req.user.id);
    res.json(orders);
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get all orders (for admin panel)
router.get('/admin/orders', auth, async (req, res) => {
  try {
    const db = await connectDB();
    const { 
      page = 1, 
      limit = 10, 
      sortBy = 'createdAt', 
      sortOrder = 'desc',
      status,
      paymentStatus,
      search
    } = req.query;

    const result = await Order.findAll(db, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sortBy,
      sortOrder,
      status,
      paymentStatus,
      search: search?.trim()
    });

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
});

// Get order by ID
router.get('/orders/:id', auth, async (req, res) => {
  try {
    const db = await connectDB();
    const order = await Order.findById(db, req.params.id);
    
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // Check if user is authorized to view this order
    if (req.user.role !== 'admin' && order.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Not authorized to view this order' });
    }

    res.json({ success: true, data: order });
  } catch (err) {
    console.error('Error fetching order:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch order' });
  }
});

// Update order status (admin only)
router.patch('/admin/orders/:id/status', auth, isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, error: 'Status is required' });
    }

    // Validate status value
    const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid status. Must be one of: ' + validStatuses.join(', ') 
      });
    }

    const db = await connectDB();
    const result = await Order.updateStatus(db, req.params.id, status);
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // Get the updated order to return in response
    const updatedOrder = await Order.findById(db, req.params.id);
    
    res.json({ 
      success: true, 
      message: 'Order status updated successfully',
      order: updatedOrder
    });
  } catch (err) {
    console.error('Error updating order status:', err);
    res.status(500).json({ success: false, error: 'Failed to update order status' });
  }
});

// Update payment status (admin only)
router.patch('/admin/orders/:id/payment-status', auth, isAdmin, async (req, res) => {
  try {
    const { paymentStatus } = req.body;
    if (!paymentStatus) {
      return res.status(400).json({ success: false, error: 'Payment status is required' });
    }

    const db = await connectDB();
    const result = await Order.updatePaymentStatus(db, req.params.id, paymentStatus);
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    res.json({ success: true, message: 'Payment status updated successfully' });
  } catch (err) {
    console.error('Error updating payment status:', err);
    res.status(500).json({ success: false, error: 'Failed to update payment status' });
  }
});

// Delete all of a user's orders (user only)
router.delete('/my-orders', auth, async (req, res) => {
  try {
    const db = await connectDB();
    await Order.deleteAllUserOrders(db, req.user.id);
    res.json({ success: true, message: 'All your orders have been deleted successfully' });
  } catch (err) {
    console.error('Error deleting all user orders:', err);
    res.status(500).json({ success: false, error: 'Failed to delete all your orders' });
  }
});

// Delete a single order by ID (user must own the order)
router.delete('/:id', auth, async (req, res) => {
  try {
    const db = await connectDB();
    const result = await Order.deleteUserOrder(db, req.params.id, req.user.id);

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, error: 'Order not found or you do not have permission to delete it' });
    }

    res.json({ success: true, message: 'Order deleted successfully' });
  } catch (err) {
    // Avoid crashing on invalid ObjectId
    if (err.name === 'BSONError') {
      return res.status(400).json({ success: false, error: 'Invalid Order ID format' });
    }
    console.error('Error deleting order:', err);
    res.status(500).json({ success: false, error: 'Failed to delete order' });
  }
});

// Delete a single order (admin only)
router.delete('/admin/orders/:id', auth, isAdmin, async (req, res) => {
  try {
    const db = await connectDB();
    const result = await Order.deleteOne(db, req.params.id);

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    res.json({ success: true, message: 'Order deleted successfully' });
  } catch (err) {
    console.error('Error deleting order:', err);
    res.status(500).json({ success: false, error: 'Failed to delete order' });
  }
});

// Delete all orders (admin only)
router.delete('/admin/all-orders', auth, isAdmin, async (req, res) => {
  try {
    const db = await connectDB();
    await Order.deleteAll(db);
    res.json({ success: true, message: 'All orders deleted successfully' });
  } catch (err) {
    console.error('Error deleting all orders:', err);
    res.status(500).json({ success: false, error: 'Failed to delete all orders' });
  }
});

export default router;