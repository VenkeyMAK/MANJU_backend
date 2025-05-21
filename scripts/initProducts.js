import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { MongoClient } from 'mongodb';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const uri = 'mongodb+srv://venkatesh:MAKpass@cluster0.nh7iqso.mongodb.net/Products';
const client = new MongoClient(uri);

async function initProducts() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    const db = client.db('Products');
    const collection = db.collection('Products');

    // Check if collection exists
    const collections = await db.listCollections().toArray();
    const collectionExists = collections.some(col => col.name === 'Products');

    if (!collectionExists) {
      console.log('Creating Products collection...');
      await db.createCollection('Products');
    }

    // Sample products data
    const sampleProducts = [
      {
        "Company Name": "Samsung",
        "Model Name": "Galaxy S23 Ultra",
        "Mobile Weight": "234g",
        "RAM": "12GB",
        "Front Camera": "12MP",
        "Back Camera": "200MP + 12MP + 10MP + 10MP",
        "Processor": "Snapdragon 8 Gen 2",
        "Battery Capacity": "5000mAh",
        "Screen Size": "6.8 inches",
        "Launched Price (India)": "₹124,999",
        "Launched Year": 2023,
        "Image URL": "https://images.samsung.com/is/image/samsung/p6pim/in/2302/gallery/in-galaxy-s23-ultra-s918-sm-s918bzgdinu-thumb-534606516"
      },
      {
        "Company Name": "Apple",
        "Model Name": "iPhone 15 Pro Max",
        "Mobile Weight": "221g",
        "RAM": "8GB",
        "Front Camera": "12MP",
        "Back Camera": "48MP + 12MP + 12MP",
        "Processor": "A17 Pro",
        "Battery Capacity": "4422mAh",
        "Screen Size": "6.7 inches",
        "Launched Price (India)": "₹159,900",
        "Launched Year": 2023,
        "Image URL": "https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-7inch-natural_titanium?wid=5120&hei=2880&fmt=p-jpg&qlt=80&.v=1693009283816"
      },
      {
        "Company Name": "OnePlus",
        "Model Name": "11 5G",
        "Mobile Weight": "205g",
        "RAM": "16GB",
        "Front Camera": "16MP",
        "Back Camera": "50MP + 48MP + 32MP",
        "Processor": "Snapdragon 8 Gen 2",
        "Battery Capacity": "5000mAh",
        "Screen Size": "6.7 inches",
        "Launched Price (India)": "₹56,999",
        "Launched Year": 2023,
        "Image URL": "https://image01.oneplus.net/shop/2023/01/04/1/MjA2ODU2ODM1ODQ3NTQ=/600x600.webp"
      }
    ];

    // Insert sample data
    const result = await collection.insertMany(sampleProducts);
    console.log(`Inserted ${result.insertedCount} products`);

    // Create indexes
    await collection.createIndex({ "Model Name": 1 });
    await collection.createIndex({ "Company Name": 1 });
    console.log('Created indexes on Model Name and Company Name');

    console.log('Products collection initialized successfully');
  } catch (err) {
    console.error('Error initializing products:', err);
  } finally {
    await client.close();
  }
}

initProducts(); 