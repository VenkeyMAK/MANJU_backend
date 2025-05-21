import { ObjectId } from 'mongodb';

const Order = {
  async create(db, orderData) {
    const collection = db.collection('orders');
    const result = await collection.insertOne({
      ...orderData,
      createdAt: new Date()
    });
    return result;
  },

  async findById(db, id) {
    const collection = db.collection('orders');
    return await collection.findOne({ _id: new ObjectId(id) });
  },

  async findByUserId(db, userId) {
    const collection = db.collection('orders');
    return await collection.find({ user: userId })
      .sort({ createdAt: -1 }) // Sort by newest first
      .toArray();
  },

  async findByEmail(db, email) {
    const collection = db.collection('orders');
    return await collection.find({ email }).toArray();
  },

  async findAll(db) {
    const collection = db.collection('orders');
    return await collection.find().toArray();
  }
};

export default Order;
