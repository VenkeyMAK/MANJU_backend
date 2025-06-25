import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';  // Import dotenv

// Load environment variables
dotenv.config();

// Import routes
import productRoutes from './routes/product.js';
 
import dbPromise from './db.js';
import filterRoutes from './routes/filters.js';
import reviewsRoutes from './routes/reviews.js';

import referralRoutes from './routes/referralRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
 
import accessoriesRoutes from './routes/accessories.js';
import orderRoutes from './routes/order.js';
import userRoutes from './routes/userRoutes.js';
 
import authMiddleware from './middleware/auth.js';
import { isAdmin } from './middleware/role.js';
 
 
import groceryRoutes from './routes/grocery.js';
import cartRoutes from './routes/cart.js';
import wishlistRoutes from './routes/wishlist.js';
import adminRoutes from './routes/admin.js';
 
import customerRoutes from './routes/customer.js';
 
import searchRoutes from './routes/search.js';
import walletRoutes from './routes/walletRoutes.js';
import authRoutes from './routes/auth.js';
 
import erpRoutes from './routes/erp.js';
 

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Enable CORS for all routes with proper configuration
app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization','x-auth-token'],
  credentials: true
}));

// Enable pre-flight requests for all routes
app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

 
// Mount routes
app.use('/api/products', productRoutes);
app.use('/api/accessories', accessoriesRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/filters', filterRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
 
app.use('/api/users', userRoutes);
app.use('/api/groceries', groceryRoutes);

// Add admin routes
app.use('/api/admin', adminRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/erp', erpRoutes);

app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/search', searchRoutes);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Serve static files from the uploads directory
app.use('/uploads', express.static('uploads'));

// Basic health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

const PORT = process.env.PORT || 5000;

// Start server with error handling
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is busy, trying port ${PORT + 1}`);
    app.listen(PORT + 1, () => {
      console.log(`Server is running on port ${PORT + 1}`);
    });
  } else {
    console.error('Server error:', err);
  }
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});