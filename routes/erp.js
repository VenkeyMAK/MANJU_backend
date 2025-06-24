import express from 'express';
import { getDashboardData } from '../controllers/erpController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/erp/dashboard
// @desc    Get all data for the ERP dashboard
// @access  Private
router.get('/dashboard', auth, getDashboardData);

export default router;
