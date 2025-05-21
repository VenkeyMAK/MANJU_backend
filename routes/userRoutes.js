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
  clearCart,
  // Add new accessories cart controllers
  getAccessoriesCart,
  addToAccessoriesCart,
  updateAccessoriesCartItem,
  removeFromAccessoriesCart,
  clearAccessoriesCart
} from '../controllers/userController.js';

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

// Product Cart routes
router.get('/cart', auth, getCart);
router.post('/cart', auth, addToCart);
router.put('/cart/:itemId', auth, updateCartItem);
router.delete('/cart/:itemId', auth, removeFromCart);
router.delete('/cart', auth, clearCart);

// Accessories cart routes
router.get('/accessories-cart', auth, getAccessoriesCart);
router.post('/accessories-cart', auth, addToAccessoriesCart);
router.put('/accessories-cart/:itemId', auth, updateAccessoriesCartItem);
router.delete('/accessories-cart/:itemId', auth, removeFromAccessoriesCart);
router.delete('/accessories-cart', auth, clearAccessoriesCart);

export default router;