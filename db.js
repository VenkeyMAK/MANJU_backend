import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Use environment variable or fallback to the direct connection string
const uri = process.env.MONGODB_URI || 'mongodb+srv://venkatesh:MAKpass@cluster0.nh7iqso.mongodb.net';
const client = new MongoClient(uri, {
  serverSelectionTimeoutMS: 30000, // 30 second timeout
  maxPoolSize: 50,
  connectTimeoutMS: 30000, // 30 seconds connection timeout
  socketTimeoutMS: 45000, // 45 seconds socket timeout
  retryWrites: true,
  retryReads: true,
  w: 'majority'
});


let dbInstance = null;

async function connectDB() {
  try {
    if (!dbInstance) {
      console.log('Attempting to connect to MongoDB...');
      await client.connect();
      console.log('Successfully connected to MongoDB');
      dbInstance = client.db('Products');
      
      // Test the connection by running a simple command
      await dbInstance.command({ ping: 1 });
      console.log('Database connection verified');
    }
    return dbInstance;
  } catch (err) {
    console.error('MongoDB connection error:', err);
    // Close the client if connection fails
    if (client) {
      await client.close();
      dbInstance = null;
    }
    throw new Error(`Database connection failed: ${err.message}`);
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  if (client) {
    console.log('Closing MongoDB connection...');
    await client.close();
    console.log('MongoDB connection closed');
    process.exit(0);
  }
});

export default connectDB;