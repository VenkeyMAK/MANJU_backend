import express from 'express';
import auth from '../middleware/auth.js';
import User from '../models/User.js';
import connectDB from '../db.js';
import WalletTransaction from '../models/WalletTransaction.js';
import Notification from '../models/Notification.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET || 'manjumobiles123';

const router = express.Router();

// Admin login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    const user = await User.findByEmail(email);

    if (!user || user.role !== 'admin') {
      return res.status(401).json({ message: 'Invalid credentials or not an admin' });
    }

    const isPasswordValid = await User.validatePassword(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const tokenPayload = { id: user._id, email: user.email, role: user.role };
    const token = jwt.sign(
      tokenPayload,
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      message: 'Admin login successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Server error during admin login' });
  }
});

// Create a new admin user (protected route)
router.post('/create-admin', auth, (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ msg: 'Access denied. Admins only.' });
    }
    next();
}, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please provide name, email, and password' });
    }

    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: 'An admin with this email already exists' });
    }

    const result = await User.create({
      name,
      email,
      password,
      role: 'admin'
    });

    const newUser = await User.findById(result.insertedId);

    res.status(201).json({
      message: 'Admin user created successfully',
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ message: 'Server error while creating admin' });
  }
});

// Middleware to check for admin role
const adminAuth = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ msg: 'Access denied. Admins only.' });
  }
  next();
};

// @route   GET api/admin/users
// @desc    Get all users with their wallet balances
// @access  Private (Admin)
router.get('/users', auth, adminAuth, async (req, res) => {
  try {
    const db = await connectDB();
    const usersCollection = db.collection('users');
    // Fetch all users and project to exclude password
    const usersFromDb = await usersCollection.find({}, { projection: { password: 0 } }).toArray();
    
    // Ensure every user has a walletBalance property
    const users = usersFromDb.map(user => ({
      ...user,
      walletBalance: user.walletBalance || 0
    }));

    res.json(users);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/admin/users/:id/tree
// @desc    Get a user's referral tree
// @access  Private (Admin)
router.get('/referral-tree/:id', auth, adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // A recursive function to build the referral tree
    const buildTree = async (userId, level = 0) => {
      const user = await User.findById(userId);
      if (!user) return null;

      const db = await connectDB();
      const usersCollection = db.collection('users');
      const directReferrals = await usersCollection.find({ referrerId: user._id }).toArray();

      const children = [];
      for (const referral of directReferrals) {
        const childNode = await buildTree(referral._id, level + 1);
        if (childNode) {
          children.push(childNode);
        }
      }

      // Return the user node with its children, excluding sensitive data
      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        referralCode: user.referralCode,
        walletBalance: user.walletBalance || 0,
        joinedDate: user.createdAt, // Add joined date
        level, // Add the level
        children,
      };
    };

    const referralTree = await buildTree(id);

    if (!referralTree) {
      return res.status(404).json({ msg: 'User not found' });
    }

    res.json(referralTree);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/admin/notifications
// @desc    Get recent transactions for notification feed
// @access  Private (Admin)
router.get('/notifications', auth, adminAuth, async (req, res) => {
  try {
    const db = await connectDB();
    const notifications = await db.collection('wallet_transactions').aggregate([
      { $sort: { createdAt: -1 } },
      { $limit: 15 },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userDetails'
        }
      },
      { 
        $unwind: { 
          path: '$userDetails',
          preserveNullAndEmptyArrays: true
        } 
      },
      {
        $project: {
          _id: '$_id',
          type: '$type',
          message: '$description',
          userName: { $ifNull: [ '$userDetails.name', 'Unknown User' ] },
          userId: '$userId',
          amount: '$amount',
          createdAt: '$createdAt',
        }
      }
    ]).toArray();

    res.json(notifications);
  } catch (err) {
    console.error('Error fetching admin notifications:', err);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/admin/stats/mlm-revenue
// @desc    Get total company revenue from MLM commissions
// @access  Private (Admin)
router.get('/stats/mlm-revenue', auth, adminAuth, async (req, res) => {
  try {
    const db = await connectDB();
    const result = await db.collection('notifications').aggregate([
      {
        $match: {
          'relatedData.companyShare': { $exists: true, $gt: 0 }
        }
      },
      {
        $group: {
          _id: '$relatedData.orderNumber',
          companyShare: { $first: '$relatedData.companyShare' }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$companyShare' }
        }
      }
    ]).toArray();

    const totalRevenue = result.length > 0 ? result[0].totalRevenue : 0;
    res.json({ totalRevenue });

  } catch (err) {
    console.error('Error fetching MLM revenue:', err);
    res.status(500).send('Server Error');
  }
});

export default router;

