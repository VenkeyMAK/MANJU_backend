import { ObjectId } from 'mongodb';
import bcrypt from 'bcrypt';
// Import the connectDB function instead of the unresolved promise/instance
import connectDB from '../db.js';


// User collection operations
const User = {
  // Create a new user
  async create(userData) {
    // Call connectDB() to get the database instance
    const database = await connectDB();
    const collection = database.collection('users');

    // Only hash password if it is provided (not null/undefined)
    if (userData.password) {
      const salt = await bcrypt.genSalt(10);
      userData.password = await bcrypt.hash(userData.password, salt);
    }

    // Add creation timestamp
    userData.createdAt = new Date();

    const result = await collection.insertOne(userData);
    return result;
  },

  // Find user by email
  async findByEmail(email) {
    // Call connectDB() to get the database instance
    const database = await connectDB();
    const collection = database.collection('users');
    return await collection.findOne({ email });
  },

  // Find user by ID
  async findById(id) {
    // Call connectDB() to get the database instance
    const database = await connectDB();
    const collection = database.collection('users');
    // Ensure the ID is converted to an ObjectId
    if (!ObjectId.isValid(id)) {
        return null; // Or throw an error, depending on desired behavior
    }
    return await collection.findOne({ _id: new ObjectId(id) });
  },

  // Validate password (doesn't need DB connection)
  async validatePassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }
  // Ensure all methods are defined *within* this closing brace
};

export default User;
// There should be NO code after this line in this file structure.
// If you had an 'async updateUser' function here, it needs to be moved
// inside the 'User = { ... };' block above.