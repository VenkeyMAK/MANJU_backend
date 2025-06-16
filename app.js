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
import authRoutes from './routes/auth.js';
import accessoriesRoutes from './routes/accessories.js';
import orderRoutes from './routes/order.js';
import userRoutes from './routes/userRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Add CORS configuration before your routes
app.use(cors({
  // In production, allow all origins or use specific domains
  origin: process.env.NODE_ENV === 'production'
    ? '*' // Allow any origin in production
    : ['http://localhost:8080', 'http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-auth-token', 'Authorization', 'Accept']
}));

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
app.use('/api/filters', filterRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', orderRoutes);

// Add user routes
app.use('/api/users', userRoutes);
app.use('/api/groceries', groceryRoutes);

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