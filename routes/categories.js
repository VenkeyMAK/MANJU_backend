import express from 'express';
const router = express.Router();

// Mock data for categories - replace with database logic later
const categories = [
  { id: 1, name: 'Mobiles', slug: 'mobiles' },
  { id: 2, name: 'Accessories', slug: 'accessories' },
  { id: 3, name: 'Groceries', slug: 'groceries' },
];

// @route   GET api/categories
// @desc    Get all categories
// @access  Public
router.get('/', (req, res) => {
  try {
    res.json(categories);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

export default router;
