import express from 'express';
import auth from '../middleware/auth.js';
import User from '../models/User.js';
import connectDB from '../db.js';
import { ObjectId } from 'mongodb';

const router = express.Router();

// @route   GET api/referral/code
// @desc    Get current user's referral code
// @access  Private
router.get('/code', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // If user exists but doesn't have a referral code, generate and save one.
    if (!user.referralCode) {
      let newReferralCode = user.generateReferralCode();
      // Ensure the generated code is unique
      while (await User.findOne({ referralCode: newReferralCode })) {
        newReferralCode = user.generateReferralCode();
      }
      user.referralCode = newReferralCode;
      await user.save();
    }

    res.json({ referralCode: user.referralCode });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/referral/network
// @desc    Get user's direct referrals (downline)
// @access  Private
router.get('/network', auth, async (req, res) => {
    try {
        const db = await connectDB();
        const usersCollection = db.collection('users');

        const referrals = await usersCollection.find(
            { referrerId: new ObjectId(req.user.id) },
            { projection: { name: 1, email: 1, createdAt: 1 } } 
        ).toArray();

        res.json(referrals);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

export default router;
