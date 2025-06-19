import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const authMiddleware = (req, res, next) => {
  const token = req.header('x-auth-token');
  
  console.log('Received Headers:', req.headers);
  console.log('Token received:', token);
  
  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }
  
  try {
    // Update secret to match the one used in login
    const secret = process.env.JWT_SECRET || 'manjumobiles123'; // Use the same secret everywhere
    const decoded = jwt.verify(token, secret);
    
    console.log('Decoded token:', decoded);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Token verification error:', err);
    res.status(401).json({ message: 'Token is not valid', error: err.message });
  }
};

export default authMiddleware;