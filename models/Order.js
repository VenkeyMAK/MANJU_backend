import { ObjectId } from 'mongodb';

const Order = {
  async create(db, orderData) {
    const collection = db.collection('orders');
    const result = await collection.insertOne({
      ...orderData,
      createdAt: new Date(),
      status: orderData.status || 'pending',
      paymentStatus: orderData.paymentStatus || 'unpaid'
    });
    // Fetch and return the full document to ensure all data, including the user ID, is passed on
    const newOrder = await collection.findOne({ _id: result.insertedId });
    return newOrder;
  },

  async findById(db, id) {
    const collection = db.collection('orders');
    return await collection.findOne({ _id: new ObjectId(id) });
  },

  async findByUserId(db, userId) {
    const collection = db.collection('orders');
    return await collection.find({ user: userId })
      .sort({ createdAt: -1 })
      .toArray();
  },

  async findByEmail(db, email) {
    const collection = db.collection('orders');
    return await collection.find({ email })
      .sort({ createdAt: -1 })
      .toArray();
  },

  async findAll(db, { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', status, paymentStatus }) {
    const collection = db.collection('orders');
    
    // Build query
    const query = {};
    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;

    // Calculate pagination
    const skip = (page - 1) * limit;
    const total = await collection.countDocuments(query);
    
    // Get orders with pagination and sorting
    const orders = await collection.find(query)
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    return {
      data: orders,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
        limit
      }
    };
  },

  async updateStatus(db, orderId, status) {
    const collection = db.collection('orders');
    return await collection.updateOne(
      { _id: new ObjectId(orderId) },
      { $set: { status, updatedAt: new Date() } }
    );
  },

  async updatePaymentStatus(db, orderId, paymentStatus) {
    const collection = db.collection('orders');
    return await collection.updateOne(
      { _id: new ObjectId(orderId) },
      { $set: { paymentStatus, updatedAt: new Date() } }
    );
  }
};

export default Order;
