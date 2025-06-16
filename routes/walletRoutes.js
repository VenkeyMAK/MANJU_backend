import express from 'express';
import auth from '../middleware/auth.js';
import User from '../models/User.js';
import WalletTransaction from '../models/WalletTransaction.js';

const router = express.Router();

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
    const transactions = await WalletTransaction.findByUserId(req.user.id);
    res.json(transactions);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

export default router;
