import express from 'express';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import dotenv from 'dotenv';



const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET  ; // Use environment variable or fallback

// Initialize Google OAuth client
const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'postmessage' // This is for handling the token from the frontend
);

// Check if email exists
router.get('/check-email', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findByEmail(email);
    res.json({ exists: !!user });
  } catch (error) {
    console.error('Email check error:', error);
    res.status(500).json({ message: 'Error checking email' });
  }
});

// Register a new user
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, referrerCode } = req.body;
    
    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please provide name, email and password' });
    }
    
    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }
    
    // Create new user
    const userData = {
      name,
      email,
      password,
      phone: phone || '',
      role: 'customer', // Default role
      referrerCode // Pass the referral code
    };
    
    const result = await User.create(userData);
    
    // Return success without sending password
    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: result.insertedId,
        name,
        email,
        phone: phone || ''
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// logout

router.post('/logout', async (req, res) => {
  try {
    // Simple logout - just return success
    // Client side will remove the token
    res.status(200).json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error during logout' });
  }
});


// Login user
router.post('/login', async (req, res) => {
  console.log('Login attempt received:', req.body.email); // Log entry point
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      console.log('Login validation failed: Missing email or password');
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // Find user by email
    console.log(`Attempting to find user by email: ${email}`);
    const user = await User.findByEmail(email);
    // Log user details (excluding password hash for security)
    console.log('User found:', user ? { id: user._id, email: user.email, name: user.name, hasPassword: !!user.password } : 'No user found');

    if (!user) {
      console.log('Login failed: User not found');
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Validate password
    console.log(`Validating password for user: ${user.email}`);
    // Ensure user.password exists before comparing
    if (!user.password) {
        console.error(`Login error: User ${user.email} has no password hash stored.`);
        // Send a specific error status/message if the user record is incomplete
        return res.status(500).json({ message: 'Server error: User data incomplete.' });
    }
    const isPasswordValid = await User.validatePassword(password, user.password);
    console.log(`Password validation result for ${user.email}: ${isPasswordValid}`);

    if (!isPasswordValid) {
      console.log('Login failed: Invalid password');
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    console.log(`Generating JWT for user: ${user.email}`);
    const tokenPayload = { id: user._id, email: user.email, role: user.role };
    const token = jwt.sign(
      tokenPayload,
      JWT_SECRET,
      { expiresIn: '1d' }
    );
    console.log(`JWT generated successfully for ${user.email}`);

    // Return user info and token
    res.json({
      message: 'Login successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token
    });
  } catch (error) {
    // Log the specific error that occurred before sending the generic 500 response
    console.error('Login error caught in /api/auth/login:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Update Google OAuth route
router.post('/google', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ message: 'Google token is required' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const { email, name, picture, sub: googleId } = payload;

    // Check if user exists
    let user = await User.findByEmail(email);

    if (!user) {
      // Create new user if doesn't exist
      const userData = {
        name,
        email,
        googleId,
        profilePicture: picture,
        role: 'customer',
        // No password for Google users
        password: null
      };
      
      const result = await User.create(userData);
      user = {
        _id: result.insertedId,
        ...userData
      };
    } else if (!user.googleId) {
      // Update existing user with Google ID if they haven't connected Google before
      await User.updateGoogleId(user._id, googleId);
      user.googleId = googleId;
    }

    // Generate JWT token
    const tokenPayload = { 
      id: user._id, 
      email: user.email, 
      role: user.role 
    };
    
    const jwtToken = jwt.sign(
      tokenPayload,
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Return user info and token
    res.json({
      message: 'Google authentication successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profilePicture: user.profilePicture
      },
      token: jwtToken
    });

  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ 
      message: 'Google authentication failed',
      details: error.message,
      origin: req.headers.origin 
    });
  }
});

export default router;