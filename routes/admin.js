import express from 'express';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import authMiddleware from '../middleware/auth.js';
import { isAdmin } from '../middleware/role.js';

dotenv.config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'manjumobiles123';

// Admin login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    const user = await User.findByEmail(email);

    if (!user || user.role !== 'admin') {
      return res.status(401).json({ message: 'Invalid credentials or not an admin' });
    }

    const isPasswordValid = await User.validatePassword(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const tokenPayload = { id: user._id, email: user.email, role: user.role };
    const token = jwt.sign(
      tokenPayload,
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      message: 'Admin login successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Server error during admin login' });
  }
});

// Create a new admin user (protected route)
router.post('/create-admin', [authMiddleware, isAdmin], async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please provide name, email, and password' });
    }

    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: 'An admin with this email already exists' });
    }

    const result = await User.create({
      name,
      email,
      password,
      role: 'admin'
    });

    const newUser = await User.findById(result.insertedId);

    res.status(201).json({
      message: 'Admin user created successfully',
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ message: 'Server error while creating admin' });
  }
});

export default router;
