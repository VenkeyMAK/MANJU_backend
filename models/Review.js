import { ObjectId } from 'mongodb';

const Review = {
  async create(db, reviewData) {
    const collection = db.collection('reviews');
    const review = {
      ...reviewData,
      _id: new ObjectId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const result = await collection.insertOne(review);
    return result;
  },

  async findById(db, id) {
    const collection = db.collection('reviews');
    return await collection.findOne({ _id: new ObjectId(id) });
  },

  async findByProductId(db, productId) {
    const collection = db.collection('reviews');
    return await collection.find({ productId }).toArray();
  },

  async findByUserId(db, userId) {
    const collection = db.collection('reviews');
    return await collection.find({ userId }).toArray();
  },

  async update(db, id, updateData) {
    const collection = db.collection('reviews');
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          ...updateData,
          updatedAt: new Date()
        } 
      },
      { returnDocument: 'after' }
    );
    return result;
  },

  async delete(db, id) {
    const collection = db.collection('reviews');
    return await collection.deleteOne({ _id: new ObjectId(id) });
  }
};

export default Review;