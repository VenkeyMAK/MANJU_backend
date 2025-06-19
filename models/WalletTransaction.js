import { ObjectId } from 'mongodb';
import connectDB from '../db.js';

class WalletTransaction {
  static async findTransactions(query = {}) {
    const db = await connectDB();
    return await db.collection('wallet_transactions')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();
  }

  static async findByUserId(userId) {
    const db = await connectDB();
    return await db.collection('wallet_transactions')
      .find({ userId: new ObjectId(userId) })
      .sort({ createdAt: -1 })
      .toArray();
  }

  static async create(transactionData) {
    const db = await connectDB();
    const transaction = {
      userId: new ObjectId(transactionData.userId),
      amount: transactionData.amount,
      type: transactionData.type,
      description: transactionData.description,
      status: transactionData.status || 'completed',
      createdAt: new Date(),
      ...(transactionData.relatedOrderId && { 
        relatedOrderId: new ObjectId(transactionData.relatedOrderId) 
      }),
      ...(transactionData.relatedUserId && { 
        relatedUserId: new ObjectId(transactionData.relatedUserId) 
      })
    };

    const result = await db.collection('wallet_transactions').insertOne(transaction);
    return { ...transaction, _id: result.insertedId };
  }
}

export default WalletTransaction;
