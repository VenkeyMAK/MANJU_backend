import express from 'express';
import auth from '../middleware/auth.js';
import {
  getProfile,
  updateProfile,
  addAddress,
  updateAddress,
  deleteAddress,
  getAddresses,
  getOrders,
  addToWishlist,
  removeFromWishlist,
  getWishlist,
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  // clearCart,
  // Add new accessories cart controllers
  getAccessoriesCart,
  addToAccessoriesCart,
  updateAccessoriesCartItem,
  removeFromAccessoriesCart,
  clearAccessoriesCart,
  // Add new groceries cart controllers
  getGroceriesCart,
  addToGroceriesCart,
  updateGroceriesCartItem,
  removeFromGroceriesCart,
  clearGroceriesCart,
  getAllCarts,
  clearAllCarts
} from '../controllers/userController.js';
import { ObjectId } from 'mongodb';
import connectDB from '../db.js';

const router = express.Router();

// Profile routes
router.get('/profile', auth, getProfile);
router.put('/profile', auth, updateProfile);

// Address routes
router.get('/addresses', auth, getAddresses);
router.post('/addresses', auth, addAddress);
router.put('/addresses/:addressId', auth, updateAddress);
router.delete('/addresses/:addressId', auth, deleteAddress);

// Order routes
router.get('/orders', auth, getOrders);

// Wishlist routes
router.get('/wishlist', auth, getWishlist);
router.post('/wishlist', auth, addToWishlist);
router.delete('/wishlist/:productId', auth, removeFromWishlist);

// Get all carts route
router.get('/cart/all', auth, getAllCarts);

// Clear all carts route
router.delete('/cart/all', auth, clearAllCarts);

// Product Cart routes
router.get('/cart', auth, getCart);
router.post('/cart', auth, addToCart);
router.put('/cart/:itemId', auth, updateCartItem);
router.delete('/cart/:itemId', auth, removeFromCart);
// router.delete('/cart', auth, clearCart);

// Accessories cart routes
router.get('/accessories-cart', auth, getAccessoriesCart);
router.post('/accessories-cart', auth, addToAccessoriesCart);
router.put('/accessories-cart/:itemId', auth, updateAccessoriesCartItem);
router.delete('/accessories-cart/:itemId', auth, removeFromAccessoriesCart);
router.delete('/accessories-cart', auth, clearAccessoriesCart);

// Groceries cart routes
router.get('/groceries-cart', auth, getGroceriesCart);
router.post('/groceries-cart', auth, addToGroceriesCart);
router.put('/groceries-cart/:itemId', auth, updateGroceriesCartItem);
router.delete('/groceries-cart/:itemId', auth, removeFromGroceriesCart);
router.delete('/groceries-cart', auth, clearGroceriesCart);

// GET /api/users/cart/all - Get user's cart
router.get('/cart/all', async (req, res) => {
    try {
        const db = await connectDB();
        const collection = db.collection('cart');
        const cartItems = await collection.find({}).toArray();
        res.json(cartItems);
    } catch (err) {
        console.error('Error fetching cart:', err);
        res.status(500).json({ error: 'Failed to fetch cart', details: err.message });
    }
});

// GET /api/users/wishlist - Get user's wishlist
router.get('/wishlist', async (req, res) => {
    try {
        const db = await connectDB();
        const collection = db.collection('wishlist');
        const wishlistItems = await collection.find({}).toArray();
        res.json(wishlistItems);
    } catch (err) {
        console.error('Error fetching wishlist:', err);
        res.status(500).json({ error: 'Failed to fetch wishlist', details: err.message });
    }
});

export default router;