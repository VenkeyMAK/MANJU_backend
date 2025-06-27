import express from 'express';
import auth from '../middleware/auth.js';
import User from '../models/User.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import connectDB from '../db.js';
import { ObjectId } from 'mongodb';
import { Parser } from 'json2csv';

const router = express.Router();

// Middleware to check for admin privileges
const adminAuth = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== 'admin') {
      return res.status(403).json({ msg: 'Admin resources access denied' });
    }
    next();
  } catch (err) {
    res.status(500).send('Server Error');
  }
};

// @route   GET api/admin/dashboard/all-data
// @desc    Get all consolidated data for the admin dashboard
// @access  Private (Admin)
router.get('/all-data', auth, adminAuth, async (req, res) => {
    try {
        const db = await connectDB();
        const now = new Date();

        // --- Date Ranges ---
        const { start: todayStart, end: todayEnd } = getStartAndEndOfDay(now);
        const { start: weekStart, end: weekEnd } = getStartAndEndOfWeek(now);
        const { start: monthStart, end: monthEnd } = getStartAndEndOfMonth(now);

        // --- Base Metrics ---
        const totalUsers = await db.collection('users').countDocuments();
        const newUsersToday = await db.collection('users').countDocuments({ createdAt: { $gte: todayStart, $lte: todayEnd } });
        const totalOrders = await db.collection('orders').countDocuments();
        const paidOrders = await db.collection('orders').countDocuments({ paymentStatus: 'Paid' });
        const totalProducts = await db.collection('products').countDocuments();
        
        // Calculate total stock across all products
        const stockData = await db.collection('products').aggregate([
            { 
                $group: { 
                    _id: null, 
                    totalStock: { $sum: '$stock' } 
                } 
            }
        ]).toArray();
        const totalStock = stockData.length > 0 ? stockData[0].totalStock : 0;

        // --- Revenue & Sales Calculations ---
        const revenueData = await db.collection('orders').aggregate([
            { $match: { paymentStatus: 'Paid' } },
            { $group: { 
                _id: null, 
                totalRevenue: { $sum: '$total' },
                todayRevenue: { $sum: { $cond: [ { $and: [ { $gte: ["$createdAt", todayStart] }, { $lte: ["$createdAt", todayEnd] } ] }, '$total', 0 ] } },
                weeklyRevenue: { $sum: { $cond: [ { $and: [ { $gte: ["$createdAt", weekStart] }, { $lte: ["$createdAt", weekEnd] } ] }, '$total', 0 ] } },
                monthlyRevenue: { $sum: { $cond: [ { $and: [ { $gte: ["$createdAt", monthStart] }, { $lte: ["$createdAt", monthEnd] } ] }, '$total', 0 ] } }
            } }
        ]).toArray();
        const revenue = revenueData[0] || { totalRevenue: 0, todayRevenue: 0, weeklyRevenue: 0, monthlyRevenue: 0 };

        const totalRefundsResult = await db.collection('orders').aggregate([{ $match: { status: 'Refunded' } }, { $group: { _id: null, total: { $sum: '$total' } } }]).toArray();
        const totalRefunds = totalRefundsResult.length > 0 ? totalRefundsResult[0].total : 0;

        // --- Order Status ---
        const orderStatusCounts = await db.collection('orders').aggregate([
            { $group: { _id: { $toLower: "$status" }, count: { $sum: 1 } } }
        ]).toArray();

        const stats = {
            users: { total: totalUsers, newToday: newUsersToday },
            products: { 
                total: totalProducts,
                totalStock: totalStock
            },
            orders: {
                total: totalOrders,
                paid: paidOrders,
                byStatus: orderStatusCounts.reduce((acc, { _id, count }) => ({ ...acc, [_id || 'unknown']: count }), {})
            },
            revenue: {
                total: revenue.totalRevenue,
                today: revenue.todayRevenue,
                thisWeek: revenue.weeklyRevenue,
                thisMonth: revenue.monthlyRevenue,
                averageOrderValue: paidOrders > 0 ? revenue.totalRevenue / paidOrders : 0
            },
            refunds: { total: totalRefunds }
        };

        // --- Top Selling Products ---
        const topProducts = await db.collection('orders').aggregate([
            { $match: { paymentStatus: { $in: ['Paid', 'paid', 'PAID'] } } }, // Match all case variations of 'Paid'
            { $unwind: '$items' },
            { $match: { 'items.price': { $gt: 0 } } }, // Only include items with valid prices
            { 
                $group: { 
                    _id: '$items.product', 
                    name: { $first: '$items.name' }, 
                    price: { $avg: '$items.price' }, // Use average price for consistency
                    totalSold: { $sum: '$items.quantity' },
                    revenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
                }
            },
            { 
                $project: {
                    _id: 1,
                    name: 1,
                    price: { $round: [{ $ifNull: ['$price', 0] }, 2] }, // Round to 2 decimal places
                    totalSold: 1,
                    revenue: 1
                }
            },
            { $sort: { totalSold: -1 } },
            { $limit: 5 }
        ]).toArray();

        console.log('Top Products:', JSON.stringify(topProducts, null, 2)); // Debug log

        // --- Sales by Category ---
        const salesByCategory = await db.collection('orders').aggregate([
            { $match: { paymentStatus: 'Paid' } },
            { $unwind: '$items' },
            { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'productInfo' } },
            { $unwind: '$productInfo' },
            { $group: { _id: '$productInfo.category', totalSales: { $sum: { $multiply: [ '$items.quantity', '$items.price' ] } } } },
            { $sort: { totalSales: -1 } }
        ]).toArray();

        // --- Low Stock & Recent Orders ---
        const lowStockProducts = await db.collection('products').find({ stock: { $lte: 10 } }).project({ name: 1, stock: 1, company: 1, model: 1 }).toArray();
        const recentOrders = await db.collection('orders').find().sort({ createdAt: -1 }).limit(10).toArray();

        // --- Sales Graph Data (last 30 days) ---
        const dateLabels = getLastNDays(30);
        const salesGraphDataRaw = await db.collection('orders').aggregate([
            { $match: { createdAt: { $gte: new Date(new Date().setDate(new Date().getDate() - 30)) }, paymentStatus: 'Paid' } },
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, totalSales: { $sum: "$total" } } },
            { $sort: { _id: 1 } }
        ]).toArray();
        const salesMap = salesGraphDataRaw.reduce((acc, item) => ({ ...acc, [item._id]: item.totalSales }), {});
        const salesGraphData = dateLabels.map(label => ({ date: label, sales: salesMap[label] || 0 }));

        // --- Consolidate all data ---
        res.json({
            stats,
            topProducts,
            lowStockProducts,
            recentOrders,
            salesGraphData,
            salesByCategory
        });

    } catch (err) {
        console.error('Consolidated dashboard data error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});



// Helper function to get start and end of a date range
const getStartAndEndOfDay = (date = new Date()) => {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return { start, end };
};

const getStartAndEndOfWeek = (date = new Date()) => {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
};

const getStartAndEndOfMonth = (date = new Date()) => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
};



// Helper function to generate date ranges for the last N days
const getLastNDays = (n) => {
  const result = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    result.push(d.toISOString().split('T')[0]);
  }
  return result;
};


// @route   GET api/admin/dashboard/stats
// @desc    Get dashboard statistics
// @access  Private (Admin)
router.get('/stats', auth, adminAuth, async (req, res) => {
  try {
    const db = await connectDB();
    const now = new Date();
    const { start: todayStart, end: todayEnd } = getStartAndEndOfDay(now);
    const { start: weekStart, end: weekEnd } = getStartAndEndOfWeek(now);
    const { start: monthStart, end: monthEnd } = getStartAndEndOfMonth(now);

    // User stats
    const totalUsers = await db.collection('users').countDocuments();
    const newUsersToday = await db.collection('users').countDocuments({ createdAt: { $gte: todayStart, $lte: todayEnd } });

    // Order stats
    const totalOrders = await db.collection('orders').countDocuments();
    const ordersToday = await db.collection('orders').countDocuments({ createdAt: { $gte: todayStart, $lte: todayEnd } });
    const ordersThisWeek = await db.collection('orders').countDocuments({ createdAt: { $gte: weekStart, $lte: weekEnd } });
    const ordersThisMonth = await db.collection('orders').countDocuments({ createdAt: { $gte: monthStart, $lte: monthEnd } });

    // Revenue stats
    const totalRevenueResult = await db.collection('orders').aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]).toArray();
    const totalRevenue = totalRevenueResult.length > 0 ? totalRevenueResult[0].total : 0;

    const todayRevenueResult = await db.collection('orders').aggregate([
      { $match: { paymentStatus: 'paid', createdAt: { $gte: todayStart, $lte: todayEnd } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]).toArray();
    const todayRevenue = todayRevenueResult.length > 0 ? todayRevenueResult[0].total : 0;

    const weeklyRevenueResult = await db.collection('orders').aggregate([
        { $match: { paymentStatus: 'paid', createdAt: { $gte: weekStart, $lte: weekEnd } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]).toArray();
    const weeklyRevenue = weeklyRevenueResult.length > 0 ? weeklyRevenueResult[0].total : 0;

    const monthlyRevenueResult = await db.collection('orders').aggregate([
      { $match: { paymentStatus: 'paid', createdAt: { $gte: monthStart, $lte: monthEnd } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]).toArray();
    const monthlyRevenue = monthlyRevenueResult.length > 0 ? monthlyRevenueResult[0].total : 0;

    // Refunds
    const totalRefundsResult = await db.collection('orders').aggregate([
        { $match: { status: 'refunded' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]).toArray();
    const totalRefunds = totalRefundsResult.length > 0 ? totalRefundsResult[0].total : 0;


    // Order status counts
    const orderStatusCounts = await db.collection('orders').aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]).toArray();

    res.json({
      users: {
        total: totalUsers,
        newToday: newUsersToday
      },
      orders: {
        total: totalOrders,
        today: ordersToday,
        thisWeek: ordersThisWeek,
        thisMonth: ordersThisMonth,
        byStatus: orderStatusCounts.reduce((acc, { _id, count }) => ({ ...acc, [_id]: count }), {})
      },
      revenue: {
        total: totalRevenue,
        today: todayRevenue,
        thisWeek: weeklyRevenue,
        thisMonth: monthlyRevenue
      },
      refunds: {
        total: totalRefunds
      }
    });

  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET api/admin/dashboard/sales-summary
// @desc    Get sales summary for different periods
// @access  Private (Admin)
router.get('/sales-summary', auth, adminAuth, async (req, res) => {
    try {
        const db = await connectDB();
        const { period } = req.query; // 'daily', 'weekly', 'monthly'
        let gte;

        const now = new Date();
        if (period === 'weekly') {
            gte = new Date(now.setDate(now.getDate() - 7));
        } else if (period === 'monthly') {
            gte = new Date(now.setMonth(now.getMonth() - 1));
        } else { // daily
            gte = new Date(now.setDate(now.getDate() - 1));
        }

        const sales = await db.collection('orders').aggregate([
            { $match: { createdAt: { $gte: gte }, paymentStatus: 'paid' } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    totalSales: { $sum: "$totalAmount" },
                    totalOrders: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]).toArray();

        res.json(sales);
    } catch (err) {
        console.error('Sales summary error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET api/admin/dashboard/top-selling-products
// @desc    Get top selling products
// @access  Private (Admin)
router.get('/top-selling-products', auth, adminAuth, async (req, res) => {
    try {
        const db = await connectDB();
        const limit = parseInt(req.query.limit) || 5;
        const topProducts = await db.collection('orders').aggregate([
            { $unwind: '$items' },
            { $match: { paymentStatus: 'paid' } },
            {
                $group: {
                    _id: '$items.product',
                    name: { $first: '$items.name' },
                    totalSold: { $sum: '$items.quantity' }
                }
            },
            { $sort: { totalSold: -1 } },
            { $limit: limit }
        ]).toArray();
        res.json(topProducts);
    } catch (err) {
        console.error('Top selling products error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET api/admin/dashboard/low-stock-products
// @desc    Get products with low stock
// @access  Private (Admin)
router.get('/low-stock-products', auth, adminAuth, async (req, res) => {
    try {
        const db = await connectDB();
        const threshold = parseInt(req.query.threshold) || 10;
        const lowStockProducts = await db.collection('products').find({
            stock: { $lte: threshold }
        }).toArray();
        res.json(lowStockProducts);
    } catch (err) {
        console.error('Low stock products error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET api/admin/dashboard/recent-orders
// @desc    Get recent orders
// @access  Private (Admin)
router.get('/recent-orders', auth, adminAuth, async (req, res) => {
    try {
        const db = await connectDB();
        const limit = parseInt(req.query.limit) || 10;
        const recentOrders = await db.collection('orders').find()
            .sort({ createdAt: -1 })
            .limit(limit)
            .toArray();
        res.json(recentOrders);
    } catch (err) {
        console.error('Recent orders error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET api/admin/dashboard/sales-graph
// @desc    Get sales data for graph
// @access  Private (Admin)
router.get('/sales-graph', auth, adminAuth, async (req, res) => {
  try {
    const db = await connectDB();
    const days = parseInt(req.query.days) || 30;
    const dateLabels = getLastNDays(days);

    const salesData = await db.collection('orders').aggregate([
      { $match: { createdAt: { $gte: new Date(new Date().setDate(new Date().getDate() - days)) }, paymentStatus: 'paid' } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          totalSales: { $sum: "$totalAmount" }
        }
      },
      { $sort: { _id: 1 } }
    ]).toArray();

    const salesMap = salesData.reduce((acc, item) => {
        acc[item._id] = item.totalSales;
        return acc;
    }, {});

    const chartData = dateLabels.map(label => ({
        date: label,
        sales: salesMap[label] || 0
    }));

    res.json(chartData);
  } catch (err) {
    console.error('Sales graph error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});



// @route   POST api/admin/dashboard/inventory/stock-in
// @desc    Add stock to a product
// @access  Private (Admin)
router.post('/inventory/stock-in', auth, adminAuth, async (req, res) => {
    try {
        const db = await connectDB();
        const { productId, quantity } = req.body;

        if (!productId || !quantity) {
            return res.status(400).json({ msg: 'Please provide productId and quantity' });
        }

        const result = await db.collection('products').updateOne(
            { _id: new ObjectId(productId) },
            { $inc: { stock: parseInt(quantity) } }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ msg: 'Product not found' });
        }

        res.json({ msg: 'Stock updated successfully' });
    } catch (err) {
        console.error('Stock-in error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST api/admin/dashboard/inventory/stock-out
// @desc    Remove stock from a product
// @access  Private (Admin)
router.post('/inventory/stock-out', auth, adminAuth, async (req, res) => {
    try {
        const db = await connectDB();
        const { productId, quantity } = req.body;

        if (!productId || !quantity) {
            return res.status(400).json({ msg: 'Please provide productId and quantity' });
        }

        const product = await db.collection('products').findOne({ _id: new ObjectId(productId) });
        if (!product) {
            return res.status(404).json({ msg: 'Product not found' });
        }

        if (product.stock < quantity) {
            return res.status(400).json({ msg: 'Insufficient stock' });
        }

        await db.collection('products').updateOne(
            { _id: new ObjectId(productId) },
            { $inc: { stock: -parseInt(quantity) } }
        );

        res.json({ msg: 'Stock updated successfully' });
    } catch (err) {
        console.error('Stock-out error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET api/admin/dashboard/categories
// @desc    Get all categories
// @access  Private (Admin)
router.get('/categories', auth, adminAuth, async (req, res) => {
    try {
        const db = await connectDB();
        const categories = await db.collection('categories').find().toArray();
        res.json(categories);
    } catch (err) {
        console.error('Get categories error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST api/admin/dashboard/categories
// @desc    Add a new category
// @access  Private (Admin)
router.post('/categories', auth, adminAuth, async (req, res) => {
    try {
        const db = await connectDB();
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({ msg: 'Please provide a category name' });
        }

        const newCategory = { name, createdAt: new Date() };
        await db.collection('categories').insertOne(newCategory);
        res.json(newCategory);
    } catch (err) {
        console.error('Add category error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   PUT api/admin/dashboard/categories/:id
// @desc    Update a category
// @access  Private (Admin)
router.put('/categories/:id', auth, adminAuth, async (req, res) => {
    try {
        const db = await connectDB();
        const { name } = req.body;
        const { id } = req.params;

        if (!name) {
            return res.status(400).json({ msg: 'Please provide a category name' });
        }

        const result = await db.collection('categories').updateOne(
            { _id: new ObjectId(id) },
            { $set: { name } }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ msg: 'Category not found' });
        }

        res.json({ msg: 'Category updated successfully' });
    } catch (err) {
        console.error('Update category error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   DELETE api/admin/dashboard/categories/:id
// @desc    Delete a category
// @access  Private (Admin)
router.delete('/categories/:id', auth, adminAuth, async (req, res) => {
    try {
        const db = await connectDB();
        const { id } = req.params;

        const result = await db.collection('categories').deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
            return res.status(404).json({ msg: 'Category not found' });
        }

        res.json({ msg: 'Category deleted successfully' });
    } catch (err) {
        console.error('Delete category error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});


// @desc    Get all orders with pagination and filtering
// @access  Private (Admin)
router.get('/orders', auth, adminAuth, async (req, res) => {
    try {
        const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', status, paymentStatus, search } = req.query;
        const db = await connectDB();
        
        let filter = {};
        if (status) {
            if (status.toLowerCase() === 'unknown') {
                filter.status = { $in: [null, "", "null"] };
            } else {
                filter.status = { $regex: `^${status}$`, $options: 'i' };
            }
        }
        if (paymentStatus) {
            filter.paymentStatus = { $regex: `^${paymentStatus}$`, $options: 'i' };
        }
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            filter.$or = [
                { 'shippingInfo.firstName': searchRegex },
                { 'shippingInfo.lastName': searchRegex },
                { 'email': searchRegex },
                { 'mobile': searchRegex },
                { '_id': ObjectId.isValid(search) ? new ObjectId(search) : null }
            ].filter(cond => cond._id !== null);
        }

        const result = await Order.findAll(db, { 
            page: parseInt(page),
            limit: parseInt(limit),
            sortBy,
            sortOrder,
            ...filter
        });
        res.json(result);
    } catch (err) {
        console.error('Get orders error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET api/admin/dashboard/orders/:id
// @desc    Get a single order by ID
// @access  Private (Admin)
router.get('/orders/:id', auth, adminAuth, async (req, res) => {
    try {
        const db = await connectDB();
        const order = await Order.findById(db, req.params.id);
        if (!order) {
            return res.status(404).json({ msg: 'Order not found' });
        }
        res.json(order);
    } catch (err) {
        console.error('Get order by ID error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET api/admin/dashboard/top-products
// @desc    Get top selling products
// @access  Private (Admin)
router.get('/top-products', auth, adminAuth, async (req, res) => {
    try {
        const db = await connectDB();
        const { limit = 10 } = req.query;

        const topProducts = await db.collection('orderitems').aggregate([
            {
                $lookup: {
                    from: 'products',
                    localField: 'product',
                    foreignField: '_id',
                    as: 'productInfo'
                }
            },
            { $unwind: '$productInfo' },
            {
                $group: {
                    _id: '$product',
                    name: { $first: '$productInfo.name' },
                    totalSold: { $sum: '$quantity' },
                    totalRevenue: { $sum: { $multiply: ['$price', '$quantity'] } },
                    avgPrice: { $avg: '$price' },
                    product: { $first: '$productInfo' }
                }
            },
            { $sort: { totalSold: -1 } },
            { $limit: parseInt(limit) },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    totalSold: 1,
                    totalRevenue: 1,
                    avgPrice: 1,
                    image: '$product.images.0',
                    category: '$product.category',
                    stock: '$product.stock'
                }
            }
        ]).toArray();

        res.json(topProducts);
    } catch (err) {
        console.error('Get top products error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET api/admin/dashboard/revenue-breakdown
// @desc    Get revenue breakdown by time period
// @access  Private (Admin)
router.get('/revenue-breakdown', auth, adminAuth, async (req, res) => {
    try {
        const db = await connectDB();
        const now = new Date();
        
        // Get today's date range
        const { start: todayStart, end: todayEnd } = getStartAndEndOfDay(now);
        // Get current week's date range
        const { start: weekStart, end: weekEnd } = getStartAndEndOfWeek(now);
        // Get current month's date range
        const { start: monthStart, end: monthEnd } = getStartAndEndOfMonth(now);

        // Calculate revenue for different time periods
        const [todayRevenue] = await db.collection('orders').aggregate([
            { 
                $match: { 
                    paymentStatus: 'Paid',
                    createdAt: { $gte: todayStart, $lte: todayEnd }
                } 
            },
            { 
                $group: { 
                    _id: null, 
                    total: { $sum: '$total' },
                    count: { $sum: 1 }
                } 
            }
        ]).toArray();

        const [weekRevenue] = await db.collection('orders').aggregate([
            { 
                $match: { 
                    paymentStatus: 'Paid',
                    createdAt: { $gte: weekStart, $lte: weekEnd }
                } 
            },
            { 
                $group: { 
                    _id: null, 
                    total: { $sum: '$total' },
                    count: { $sum: 1 }
                } 
            }
        ]).toArray();

        const [monthRevenue] = await db.collection('orders').aggregate([
            { 
                $match: { 
                    paymentStatus: 'Paid',
                    createdAt: { $gte: monthStart, $lte: monthEnd }
                } 
            },
            { 
                $group: { 
                    _id: null, 
                    total: { $sum: '$total' },
                    count: { $sum: 1 }
                } 
            }
        ]).toArray();

        // Get revenue by category
        const revenueByCategory = await db.collection('orderitems').aggregate([
            {
                $lookup: {
                    from: 'products',
                    localField: 'product',
                    foreignField: '_id',
                    as: 'productInfo'
                }
            },
            { $unwind: '$productInfo' },
            {
                $group: {
                    _id: '$productInfo.category',
                    totalRevenue: { $sum: { $multiply: ['$price', '$quantity'] } },
                    count: { $sum: '$quantity' }
                }
            },
            { $sort: { totalRevenue: -1 } }
        ]).toArray();

        res.json({
            today: todayRevenue || { total: 0, count: 0 },
            week: weekRevenue || { total: 0, count: 0 },
            month: monthRevenue || { total: 0, count: 0 },
            byCategory: revenueByCategory
        });
    } catch (err) {
        console.error('Get revenue breakdown error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET api/admin/dashboard/product-stats
// @desc    Get product statistics including total stock and low stock items
// @access  Private (Admin)
router.get('/product-stats', auth, adminAuth, async (req, res) => {
    try {
        const db = await connectDB();
        
        // Get total products and stock
        const [productStats] = await db.collection('products').aggregate([
            {
                $group: {
                    _id: null,
                    totalProducts: { $sum: 1 },
                    totalStock: { $sum: '$stock' },
                    totalValue: { $sum: { $multiply: ['$price', '$stock'] } }
                }
            }
        ]).toArray();

        // Get low stock products (less than 10 in stock)
        const lowStockProducts = await db.collection('products')
            .find({ stock: { $lt: 10 } })
            .sort({ stock: 1 })
            .project({ name: 1, stock: 1, price: 1, images: { $slice: 1 } })
            .toArray();

        // Get out of stock products
        const outOfStockProducts = await db.collection('products')
            .find({ stock: { $lte: 0 } })
            .count();

        res.json({
            totalProducts: productStats?.totalProducts || 0,
            totalStock: productStats?.totalStock || 0,
            totalInventoryValue: productStats?.totalValue || 0,
            lowStockCount: lowStockProducts.length,
            outOfStockCount: outOfStockProducts,
            lowStockProducts
        });
    } catch (err) {
        console.error('Get product stats error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET api/admin/dashboard/orders/export/csv
// @desc    Export orders to CSV
// @access  Private (Admin)
router.get('/orders/export/csv', auth, adminAuth, async (req, res) => {
    try {
        const { status, paymentStatus, search } = req.query;
        const db = await connectDB();

        let filter = {};
        if (status) {
            if (status.toLowerCase() === 'unknown') {
                filter.status = { $in: [null, "", "null"] };
            } else {
                filter.status = { $regex: `^${status}$`, $options: 'i' };
            }
        }
        if (paymentStatus) {
            filter.paymentStatus = { $regex: `^${paymentStatus}$`, $options: 'i' };
        }
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            filter.$or = [
                { 'shippingInfo.firstName': searchRegex },
                { 'shippingInfo.lastName': searchRegex },
                { 'email': searchRegex },
                { 'mobile': searchRegex },
                { '_id': ObjectId.isValid(search) ? new ObjectId(search) : null }
            ].filter(cond => cond._id !== null);
        }

        const orders = await db.collection('orders').find(filter).sort({ createdAt: -1 }).toArray();

        if (orders.length === 0) {
            return res.status(404).json({ msg: 'No orders found for export' });
        }

        const flattenedOrders = orders.map(order => ({
            orderId: order._id,
            customerName: `${order.shippingInfo.firstName} ${order.shippingInfo.lastName}`,
            customerEmail: order.email,
            customerPhone: order.mobile,
            totalAmount: order.total,
            paymentStatus: order.paymentStatus,
            orderStatus: order.status,
            orderDate: order.createdAt,
            products: order.items.map(item => `${item.name} (Qty: ${item.quantity})`).join(', '),
            shippingAddress: `${order.shippingInfo.address}, ${order.shippingInfo.city}, ${order.shippingInfo.state} ${order.shippingInfo.postalCode}, ${order.shippingInfo.country}`
        }));

        const json2csvParser = new Parser();
        const csv = json2csvParser.parse(flattenedOrders);

        res.header('Content-Type', 'text/csv');
        res.attachment('orders.csv');
        res.send(csv);

    } catch (err) {
        console.error('Export orders error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   PUT api/admin/dashboard/orders/:id/status
// @desc    Update order status
// @access  Private (Admin)
router.put('/orders/:id/status', auth, adminAuth, async (req, res) => {
    try {
        const db = await connectDB();
        const { status } = req.body;
        if (!status) {
            return res.status(400).json({ msg: 'Status is required' });
        }
        const result = await Order.updateStatus(db, req.params.id, status);
        if (!result) {
            return res.status(404).json({ msg: 'Order not found' });
        }
        res.json({ msg: 'Order status updated successfully' });
    } catch (err) {
        console.error('Update order status error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});


// CUSTOMER MANAGEMENT

// @route   GET api/admin/dashboard/customers
// @desc    Get all customers with pagination and search
// @access  Private (Admin)
router.get('/customers', auth, adminAuth, async (req, res) => {
    try {
        const db = await connectDB();
        const { page = 1, limit = 10, search = '' } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const query = {};
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query.$or = [
                { name: searchRegex },
                { email: searchRegex }
            ];
        }

        const customers = await db.collection('users').find(query).skip(skip).limit(parseInt(limit)).toArray();
        const total = await db.collection('users').countDocuments(query);

        res.json({
            data: customers,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('Get customers error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET api/admin/dashboard/customers/:id
// @desc    Get a single customer by ID
// @access  Private (Admin)
router.get('/customers/:id', auth, adminAuth, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ msg: 'Customer not found' });
        }
        res.json(user);
    } catch (err) {
        console.error('Get customer by ID error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   PUT api/admin/dashboard/customers/:id
// @desc    Update customer details
// @access  Private (Admin)
router.put('/customers/:id', auth, adminAuth, async (req, res) => {
    try {
        const db = await connectDB();
        const { name, email, role } = req.body;
        const updateData = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (role) updateData.role = role;

        const result = await db.collection('users').updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: updateData }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ msg: 'Customer not found or no changes made' });
        }

        res.json({ msg: 'Customer updated successfully' });
    } catch (err) {
        console.error('Update customer error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   DELETE api/admin/dashboard/customers/:id
// @desc    Delete a customer
// @access  Private (Admin)
router.delete('/customers/:id', auth, adminAuth, async (req, res) => {
    try {
        const db = await connectDB();
        const result = await db.collection('users').deleteOne({ _id: new ObjectId(req.params.id) });

        if (result.deletedCount === 0) {
            return res.status(404).json({ msg: 'Customer not found' });
        }

        // Optional: Also delete related data like orders, reviews etc.

        res.json({ msg: 'Customer deleted successfully' });
    } catch (err) {
        console.error('Delete customer error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});


// REPORTS & ANALYTICS

// @route   GET api/admin/dashboard/reports/sales
// @desc    Generate a sales report in CSV format
// @access  Private (Admin)
router.get('/reports/sales', auth, adminAuth, async (req, res) => {
    try {
        const db = await connectDB();
        const { startDate, endDate } = req.query;

        const query = { paymentStatus: 'paid' };
        if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const orders = await db.collection('orders').find(query).sort({ createdAt: -1 }).toArray();

        if (orders.length === 0) {
            return res.status(404).json({ msg: 'No orders found for the selected period' });
        }

        const fields = [
            { label: 'Order ID', value: '_id' },
            { label: 'Date', value: 'createdAt' },
            { label: 'Customer Name', value: 'shippingInfo.name' },
            { label: 'Customer Email', value: 'email' },
            { label: 'Total Amount', value: 'totalAmount' },
            { label: 'Payment Status', value: 'paymentStatus' },
            { label: 'Order Status', value: 'status' }
        ];

        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(orders);

        res.header('Content-Type', 'text/csv');
        res.attachment('sales-report.csv');
        res.send(csv);

    } catch (err) {
        console.error('Sales report error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});


// PAYMENT & SHIPPING MANAGEMENT

// @route   PUT api/admin/dashboard/orders/:id/payment-status
// @desc    Update order payment status
// @access  Private (Admin)
router.put('/orders/:id/payment-status', auth, adminAuth, async (req, res) => {
    try {
        const db = await connectDB();
        const { paymentStatus } = req.body;

        if (!paymentStatus) {
            return res.status(400).json({ msg: 'Payment status is required' });
        }
        const result = await Order.updatePaymentStatus(db, req.params.id, paymentStatus);
        if (!result) {
            return res.status(404).json({ msg: 'Order not found' });
        }
        res.json({ msg: 'Order payment status updated successfully' });
    } catch (err) {
        console.error('Update order payment status error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   PUT api/admin/dashboard/orders/:id/shipping
// @desc    Update order shipping details
// @access  Private (Admin)
router.put('/orders/:id/shipping', auth, adminAuth, async (req, res) => {
    try {
        const db = await connectDB();
        const { trackingNumber, carrier } = req.body;
        const updateFields = {};

        if (trackingNumber) updateFields['shippingInfo.trackingNumber'] = trackingNumber;
        if (carrier) updateFields['shippingInfo.carrier'] = carrier;

        if (Object.keys(updateFields).length === 0) {
            return res.status(400).json({ msg: 'Please provide shipping details to update' });
        }

        const result = await db.collection('orders').updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: updateFields }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ msg: 'Order not found or no changes made' });
        }

        res.json({ msg: 'Shipping details updated successfully' });
    } catch (err) {
        console.error('Update shipping details error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
