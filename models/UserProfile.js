import { ObjectId } from 'mongodb';

const UserProfile = {
  async findOne(db, query) {
    return await db.collection('userprofiles').findOne(query);
  },

  async findOneAndUpdate(db, query, update, options = {}) {
    return await db.collection('userprofiles').findOneAndUpdate(query, update, options);
  },

  async updateOne(db, query, update) {
    return await db.collection('userprofiles').updateOne(query, update);
  },

  async insertOne(db, data) {
    return await db.collection('userprofiles').insertOne(data);
  }
};

export default UserProfile;