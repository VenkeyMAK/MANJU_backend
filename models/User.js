import { ObjectId } from 'mongodb';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import connectDB from '../db.js';

const User = {
  generateReferralCode() {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
  },

  async create(userData) {
    const db = await connectDB();
    const usersCollection = db.collection('users');

    if (userData.password) {
      const salt = await bcrypt.genSalt(10);
      userData.password = await bcrypt.hash(userData.password, salt);
    }

    let referralCode = this.generateReferralCode();
    while (await this.findByReferralCode(referralCode)) {
      referralCode = this.generateReferralCode();
    }
    
    const newUser = {
        ...userData,
        referralCode,
        walletBalance: 0,
        upline: [],
        referrerId: null,
        createdAt: new Date(),
    };

    if (userData.referrerCode) {
      const referrer = await this.findByReferralCode(userData.referrerCode);
      if (referrer) {
        newUser.referrerId = referrer._id;
        const referrerUpline = referrer.upline || [];
        newUser.upline = [referrer._id, ...referrerUpline].slice(0, 100);
      }
    }
    
    delete newUser.referrerCode;

    const result = await usersCollection.insertOne(newUser);
    return result;
  },

  async findByEmail(email) {
    const db = await connectDB();
    const usersCollection = db.collection('users');
    return await usersCollection.findOne({ email });
  },

  async findById(id) {
    const db = await connectDB();
    const usersCollection = db.collection('users');
    if (!ObjectId.isValid(id)) {
      return null;
    }
    return await usersCollection.findOne({ _id: new ObjectId(id) });
  },
  
  async findByReferralCode(code) {
    const db = await connectDB();
    const usersCollection = db.collection('users');
    return await usersCollection.findOne({ referralCode: code });
  },

  async validatePassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  },
  
  async updateGoogleId(userId, googleId) {
    const db = await connectDB();
    const usersCollection = db.collection('users');
    return await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { googleId: googleId, updatedAt: new Date() } }
    );
  },

  async updateWalletBalance(userId, amount, session) {
    const db = await connectDB();
    const usersCollection = db.collection('users');
    return await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $inc: { walletBalance: amount }, $set: { updatedAt: new Date() } },
      { session }
    );
  }
};

export default User;
// There should be NO code after this line in this file structure.
// If you had an 'async updateUser' function here, it needs to be moved
// inside the 'User = { ... };' block above.