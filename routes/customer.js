import express from 'express';
import connectDB from '../db.js';
import auth from '../middleware/auth.js';
import { ObjectId } from 'mongodb';

const router = express.Router();

// GET /api/customers - Get all customers with their order statistics
router.get('/', auth, async (req, res) => {
  try {
    const db = await connectDB();
    
    // First, get all orders with user information
    const orders = await db.collection('orders')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    // Get unique user IDs from orders
    const userIds = [...new Set(orders.map(order => order.user))]
      .filter(Boolean) // Remove any null/undefined values
      .map(id => new ObjectId(id));

    // Get user details for these IDs
    const users = await db.collection('users')
      .find({ _id: { $in: userIds } })
      .project({ name: 1, email: 1, mobile: 1 })
      .toArray();

    // Create a map of user ID to user details
    const userMap = users.reduce((acc, user) => {
      acc[user._id.toString()] = {
        name: user.name || 'N/A',
        email: user.email || 'N/A',
        mobile: user.mobile || null // Set to null to check for order mobile later
      };
      return acc;
    }, {});

    // Also create a map of emails to users for easier lookup
    const emailMap = users.reduce((acc, user) => {
      if (user.email) {
        acc[user.email] = user._id.toString();
      }
      return acc;
    }, {});

    // Group orders by user
    const customerOrders = orders.reduce((acc, order) => {
      // Try to find user by ID first, then by email
      let userId = order.user?.toString();
      
      // If no user ID but we have email, try to find user by email
      if (!userId && order.email) {
        const foundUserId = emailMap[order.email];
        if (foundUserId) {
          userId = foundUserId;
          order.user = userId; // Update order with found user ID
        }
      }
      
      // If still no user ID, create a unique key for this order
      const userKey = userId || `email_${order.email || 'unknown'}_${order.mobile || 'unknown'}`;
      
      if (!acc[userKey]) {
        acc[userKey] = {
          orders: [],
          totalSpent: 0,
          lastOrder: null,
          userId: userId,
          email: order.email,
          mobile: order.mobile
        };
      }
      
      acc[userKey].orders.push(order);
      acc[userKey].totalSpent += order.total || 0;
      
      // Update mobile if not set and available in order
      if (!acc[userKey].mobile && order.mobile) {
        acc[userKey].mobile = order.mobile;
      }
      
      // Update email if not set and available in order
      if (!acc[userKey].email && order.email) {
        acc[userKey].email = order.email;
      }
      
      if (!acc[userKey].lastOrder || order.createdAt > acc[userKey].lastOrder) {
        acc[userKey].lastOrder = order.createdAt;
      }
      
      return acc;
    }, {});

    // Format the response with only required fields
    const formattedCustomers = Object.entries(customerOrders).map(([_, data]) => {
      // Get user from map or use order data as fallback
      const user = data.userId ? (userMap[data.userId] || {}) : {};
      
      // Use the most specific data available (order data overrides user data)
      const customerName = user.name || data.orders[0]?.name || 'Unknown Customer';
      const customerEmail = data.email || user.email || 'N/A';
      const customerMobile = data.mobile || user.mobile || 'N/A';
      
      return {
        name: customerName,
        contact: {
          email: customerEmail,
          mobile: customerMobile
        },
        orders: data.orders.length,
        totalSpent: data.totalSpent || 0,
        lastOrder: data.lastOrder ? new Date(data.lastOrder).toLocaleDateString() : 'N/A'
      };
    });

    // Sort by last order date (newest first)
    formattedCustomers.sort((a, b) => {
      const dateA = a.lastOrder === 'N/A' ? new Date(0) : new Date(a.lastOrder);
      const dateB = b.lastOrder === 'N/A' ? new Date(0) : new Date(b.lastOrder);
      return dateB - dateA;
    });

    res.json({
      success: true,
      count: formattedCustomers.length,
      data: formattedCustomers
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

export default router;
