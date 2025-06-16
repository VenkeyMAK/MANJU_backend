const Grocery = require('../models/Grocery');

// @desc    Get all groceries
// @route   GET /api/groceries
// @access  Public
exports.getGroceries = async (req, res, next) => {
  try {
    const groceries = await Grocery.find({});
    res.status(200).json({
      success: true,
      count: groceries.length,
      data: groceries
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};
