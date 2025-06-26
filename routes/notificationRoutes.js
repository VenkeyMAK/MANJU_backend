import express from 'express';
import auth from '../middleware/auth.js';
import Notification from '../models/Notification.js';

const router = express.Router();

// Middleware to check for admin role
const adminAuth = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ msg: 'Access denied. Admins only.' });
  }
  next();
};

// @route   GET api/notifications
// @desc    Get all notifications for admin
// @access  Private (Admin)
router.get('/', auth, adminAuth, async (req, res) => {
  try {
    const notifications = await Notification.find({});
    res.json(notifications);
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).send('Server Error');
  }
});

export default router;
