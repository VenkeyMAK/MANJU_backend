import express from 'express';
import auth from '../middleware/auth.js';
import User from '../models/User.js';
import connectDB from '../db.js';
import WalletTransaction from '../models/WalletTransaction.js';
import Notification from '../models/Notification.js';

const router = express.Router();

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
