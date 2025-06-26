import { ObjectId } from 'mongodb';
import connectDB from '../db.js';

class Notification {
  static async create(notificationData) {
    const db = await connectDB();
    const notification = {
      type: notificationData.type, // e.g., 'commission', 'cashback', 'threshold_reached', 'new_user'
      isRead: false,
      createdAt: new Date(),
      ...notificationData // Spread the rest of the data (userId, userName, message, relatedData, etc.)
    };

    const result = await db.collection('notifications').insertOne(notification);
    return { ...notification, _id: result.insertedId };
  }

  static async find(query = {}, limit = 50) {
    const db = await connectDB();
    return await db.collection('notifications')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }
}

export default Notification;
