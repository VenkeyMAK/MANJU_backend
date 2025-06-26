import express from 'express';
import auth from '../middleware/auth.js';
import User from '../models/User.js';
import connectDB from '../db.js';

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

export default router;