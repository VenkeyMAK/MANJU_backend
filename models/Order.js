import { ObjectId } from 'mongodb';

const Order = {
  async create(db, orderData) {
    const collection = db.collection('orders');
    const result = await collection.insertOne({
      ...orderData,
      items: orderData.items || [],
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
    // Convert userId string to ObjectId for correct matching
    return await collection.find({ user: new ObjectId(userId) })
      .sort({ createdAt: -1 })
      .toArray();
  },

  async findByEmail(db, email) {
    const collection = db.collection('orders');
    return await collection.find({ email })
      .sort({ createdAt: -1 })
      .toArray();
  },

  async findAll(db, { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', status, paymentStatus, search }) {
    const collection = db.collection('orders');
    
    // Build query
    const query = {};
    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    
    // Add search functionality
    if (search && search.trim()) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { orderNumber: { $regex: searchRegex } },
        { 'user.name': { $regex: searchRegex } },
        { email: { $regex: searchRegex } },
        { mobile: { $regex: searchRegex } },
        { 'shippingInfo.mobile': { $regex: searchRegex } }
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    const total = await collection.countDocuments(query);
    
    // Get orders with pagination and sorting
    const orders = await collection.aggregate([
      { $match: query },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userData'
        }
      },
      { $unwind: { path: '$userData', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          'user.name': '$userData.name',
          'user.email': '$userData.email'
        }
      },
      { $sort: { [sortBy]: sortOrder === 'asc' ? 1 : -1 } },
      { $skip: skip },
      { $limit: limit }
    ]).toArray();

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
    const result = await collection.updateOne(
      { _id: new ObjectId(orderId) },
      { $set: { status, updatedAt: new Date() } }
    );
    
    // If order status is updated to 'Delivered' and payment is not already marked as paid,
    // update payment status to 'Paid' for Cash on Delivery orders
    if (status === 'Delivered') {
      const order = await collection.findOne({ _id: new ObjectId(orderId) });
      if (order && order.paymentMethod === 'Cash on Delivery' && order.paymentStatus !== 'paid') {
        await collection.updateOne(
          { _id: new ObjectId(orderId) },
          { $set: { paymentStatus: 'paid', updatedAt: new Date() } }
        );
      }
    }
    
    return result;
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
