import connectDB from '../db.js';
import { ObjectId } from 'mongodb';

// Helper functions
const getAggregationValue = (result, field, defaultValue = 0) => {
  return result.length > 0 ? result[0][field] : defaultValue;
};

const calculateInventoryValue = (products) => {
  return products.reduce((total, product) => {
    return total + (product.stock * (product.costPrice || 0));
  }, 0);
};

const getLowStockAlerts = (products) => {
  return products.filter(product => {
    const stock = product.stock || 0;
    const minStock = product.minStock || 10; // Default minimum stock
    return stock <= minStock;
  }).slice(0, 5);
};

const calculateFinancialMetrics = async (db) => {
  try {
    const orders = await db.collection('orders').find({ paymentStatus: 'paid' }).toArray();
    
    if (!orders || orders.length === 0) {
      return {
        totalRevenue: 0,
        totalCOGS: 0,
        totalOrders: 0,
        avgOrderValue: 0
      };
    }

    let totalRevenue = 0;
    let totalCOGS = 0;
    let totalOrders = orders.length;

    for (const order of orders) {
      totalRevenue += order.total || 0;
      
      if (order.items && Array.isArray(order.items)) {
        for (const item of order.items) {
          totalCOGS += (item.quantity || 0) * (item.costPrice || 0);
        }
      }
    }

    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return {
      totalRevenue,
      totalCOGS,
      totalOrders,
      avgOrderValue
    };
  } catch (error) {
    console.error('Error calculating financial metrics:', error);
    return {
      totalRevenue: 0,
      totalCOGS: 0,
      totalOrders: 0,
      avgOrderValue: 0
    };
  }
};

const calculateCustomerMetrics = async (db) => {
  try {
    const totalCustomers = await db.collection('users').countDocuments();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const newCustomers = await db.collection('users').countDocuments({ createdAt: { $gte: oneMonthAgo } });

    const orders = await db.collection('orders').find({ paymentStatus: 'paid', user: { $ne: null } }).toArray();
    const userOrders = orders.reduce((acc, order) => {
      const userId = order.user.toString();
      acc[userId] = (acc[userId] || 0) + 1;
      return acc;
    }, {});

    const returningCustomers = Object.values(userOrders).filter(count => count > 1).length;

    return {
      totalCustomers,
      newCustomers,
      returningCustomers
    };
  } catch (error) {
    console.error('Error calculating customer metrics:', error);
    return {
      totalCustomers: 0,
      newCustomers: 0,
      returningCustomers: 0
    };
  }
};

const calculateInventoryMetrics = async (db) => {
  try {
    const products = await db.collection('Products').find({}).toArray();
    const accessories = await db.collection('Accessories').find({}).toArray();
    const groceries = await db.collection('groceries').find({}).toArray();

    const allProducts = [...products, ...accessories, ...groceries];

    const inventoryLevels = allProducts.reduce((acc, product) => {
      const category = product.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = { 
          stock: 0,
          minStock: 0,
          maxStock: 0,
          products: []
        };
      }
      
      acc[category].stock += product.stock || 0;
      acc[category].minStock += product.minStock || 0;
      acc[category].maxStock += product.maxStock || 0;
      acc[category].products.push(product);
      
      return acc;
    }, {});

    const inventoryMovement = Object.entries(inventoryLevels).map(([category, { stock }]) => ({ 
      category,
      stock,
      products: inventoryLevels[category].products.length
    }));

    const lowStockAlerts = getLowStockAlerts(allProducts);

    return {
      inventoryLevels,
      inventoryMovement,
      lowStockAlerts,
      allProducts
    };
  } catch (error) {
    console.error('Error calculating inventory metrics:', error);
    return {
      inventoryLevels: {},
      inventoryMovement: [],
      lowStockAlerts: [],
      allProducts: []
    };
  }
};

const calculateSalesMetrics = async (db) => {
  try {
    const salesData = await db.collection('orders').aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $unwind: '$items' },
      { $group: { 
        _id: '$items.category',
        totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } },
        totalUnits: { $sum: '$items.quantity' }
      } },
      { $sort: { totalRevenue: -1 } }
    ]).toArray();

    const topProducts = await db.collection('orders').aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $unwind: '$items' },
      { $group: { 
        _id: '$items.name',
        unitsSold: { $sum: '$items.quantity' },
        revenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } },
        category: { $first: '$items.category' }
      } },
      { $sort: { revenue: -1 } },
      { $limit: 5 }
    ]).toArray();

    return {
      salesByCategory: salesData,
      topProducts
    };
  } catch (error) {
    console.error('Error calculating sales metrics:', error);
    return {
      salesByCategory: [],
      topProducts: []
    };
  }
};

export const getDashboardData = async (req, res) => {
  try {
    const db = await connectDB();

    // Calculate all metrics in parallel
    const [financials, customerMetrics, inventoryMetrics, salesMetrics] = await Promise.all([
      calculateFinancialMetrics(db),
      calculateCustomerMetrics(db),
      calculateInventoryMetrics(db),
      calculateSalesMetrics(db)
    ]);

    // Calculate revenue growth
    const today = new Date();
    const last30Days = new Date(new Date().setDate(today.getDate() - 30));
    const prev30Days = new Date(new Date().setDate(today.getDate() - 60));

    const revenueLast30Days = await db.collection('orders').aggregate([
      { $match: { paymentStatus: 'paid', createdAt: { $gte: last30Days } } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]).toArray();

    const revenuePrev30Days = await db.collection('orders').aggregate([
      { $match: { paymentStatus: 'paid', createdAt: { $gte: prev30Days, $lt: last30Days } } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]).toArray();

    const last30DaysRevenue = getAggregationValue(revenueLast30Days, 'total');
    const prev30DaysRevenue = getAggregationValue(revenuePrev30Days, 'total');

    const revenueGrowth = prev30DaysRevenue > 0
      ? ((last30DaysRevenue - prev30DaysRevenue) / prev30DaysRevenue) * 100
      : (last30DaysRevenue > 0 ? 100 : 0);

    // Calculate total inventory value from all products
    const totalInventoryValue = calculateInventoryValue(inventoryMetrics.allProducts);

    // Calculate operational costs (removed mock calculation)
    const totalExpenses = financials.totalCOGS; // Expenses are currently just the cost of goods sold
    const netProfit = financials.totalRevenue - totalExpenses;

    res.json({
      success: true,
      data: {
        financials: {
          totalRevenue: financials.totalRevenue,
          totalCOGS: financials.totalCOGS,
          totalExpenses,
          netProfit,
          avgOrderValue: financials.avgOrderValue.toFixed(2),
          totalOrders: financials.totalOrders,
          revenueGrowth: revenueGrowth.toFixed(2) + '%',
          totalInventoryValue
        },
        customerMetrics: {
          totalCustomers: customerMetrics.totalCustomers,
          newCustomers: customerMetrics.newCustomers,
          returningCustomers: customerMetrics.returningCustomers,
          avgOrderValue: financials.avgOrderValue.toFixed(2)
        },
        inventory: {
          inventoryLevels: inventoryMetrics.inventoryLevels,
          inventoryMovement: inventoryMetrics.inventoryMovement,
          lowStockAlerts: inventoryMetrics.lowStockAlerts,
          totalInventoryValue
        },
        sales: {
          salesByCategory: salesMetrics.salesByCategory,
          topProducts: salesMetrics.topProducts
        }
      }
    });

  } catch (error) {
    console.error('Error fetching ERP dashboard data:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server Error', 
      error: error.message,
      details: {
        financials: error.message.includes('financial') ? true : false,
        customer: error.message.includes('customer') ? true : false,
        inventory: error.message.includes('inventory') ? true : false,
        sales: error.message.includes('sales') ? true : false
      }
    });
  }
};
