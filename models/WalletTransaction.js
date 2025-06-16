import { ObjectId } from 'mongodb';
import connectDB from '../db.js';

const WalletTransaction = {
  // Create a new wallet transaction
  async create(transactionData, session) {
    const db = await connectDB();
    const collection = db.collection('wallet_transactions');
    
    const transaction = {
      userId: new ObjectId(transactionData.userId),
      amount: transactionData.amount, // can be positive (credit) or negative (debit)
      type: transactionData.type, // 'cashback', 'mlm_commission', 'withdrawal', 'bonus'
      description: transactionData.description,
      relatedOrderId: transactionData.relatedOrderId ? new ObjectId(transactionData.relatedOrderId) : null,
      relatedUserId: transactionData.relatedUserId ? new ObjectId(transactionData.relatedUserId) : null, // e.g., the user who made the purchase for MLM
      createdAt: new Date(),
    };

    const result = await collection.insertOne(transaction, { session });
    return result;
  },

  // Find transactions by user ID
  async findByUserId(userId) {
    const db = await connectDB();
    const collection = db.collection('wallet_transactions');
    return await collection.find({ userId: new ObjectId(userId) }).sort({ createdAt: -1 }).toArray();
  }
};

export default WalletTransaction;
