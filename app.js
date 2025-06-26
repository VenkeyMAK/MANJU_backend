import express from 'express';
import groceryRoutes from './routes/grocery.js';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';  // Import dotenv

// Load environment variables
dotenv.config();

import productRoutes from './routes/product.js';
import dbPromise from './db.js';
import filterRoutes from './routes/filters.js';
import reviewsRoutes from './routes/reviews.js';
import walletRoutes from './routes/walletRoutes.js';
import referralRoutes from './routes/referralRoutes.js';
import authRoutes from './routes/auth.js';
import accessoriesRoutes from './routes/accessories.js';
import orderRoutes from './routes/order.js';
import userRoutes from './routes/userRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import customerRoutes from './routes/customer.js';
import erpRoutes from './routes/erp.js';
import adminDashboardRoutes from './routes/adminDashboard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Update CORS configuration
const allowedOrigins = ['http://localhost:8080', 'http://localhost:3000'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
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
app.use('/api/filters', filterRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);

// Add user routes
app.use('/api/users', userRoutes);
app.use('/api/groceries', groceryRoutes);

// Add admin routes

app.use('/api/customers', customerRoutes);
app.use('/api/erp', erpRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/admin', adminRoutes);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
const avatarsDir = path.join(uploadsDir, 'avatars');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir);
}

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Basic route
app.get('/', (req, res) => {
  res.send('Welcome to the API!');
});

// Database connection and server startup
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Ensure database connection before starting server
    const db = await dbPromise();
    console.log('Database connection established');

    // Start server after successful database connection
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

    // Handle server shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received. Shutting down gracefully...');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();