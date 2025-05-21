import express from 'express';
import { ObjectId } from 'mongodb'; // Although likely not needed for accessories based on image
import connectDB from '../db.js';

const router = express.Router();

// Define Accessory Interface based on image (for reference)
/*
interface Accessory {
  _id?: ObjectId; // Or maybe just use the number id?
  id: number; // The number ID like 1, 2, 3
  acc_id: string; // The string ID like acc002
  brand: string;
  name: string;
  price: number;
  original_price: number;
  discount: number;
  rating: number;
  rating_count: string; // e.g., "(1.8K)" or "-809" - needs parsing
  image_url: string;
  category: string; // "Earphones", "Headphone"
  description: string;
  visual_cue: string;
}
*/

// Sample data for initialization
const sampleAccessories = [
  {
    id: 1,
    acc_id: "acc001",
    brand: "Sony",
    name: "Sony WH-1000XM4 Wireless Noise Cancelling Headphones",
    price: 29990,
    original_price: 34990,
    discount: 0.14,
    rating: 4.8,
    rating_count: "(2.5K)",
    image_url: "https://m.media-amazon.com/images/I/71o8Q5XJS5L._SL1500_.jpg",
    category: "Headphones",
    description: "Industry-leading noise cancellation with Dual Noise Sensor technology",
    visual_cue: "Premium black finish with copper accents"
  },
  {
    id: 2,
    acc_id: "acc002",
    brand: "Apple",
    name: "AirPods Pro (2nd Generation)",
    price: 24990,
    original_price: 26900,
    discount: 0.07,
    rating: 4.7,
    rating_count: "(1.8K)",
    image_url: "https://m.media-amazon.com/images/I/61SUj2aKoEL._SL1500_.jpg",
    category: "Earphones",
    description: "Active Noise Cancellation with Transparency mode",
    visual_cue: "Sleek white design with charging case"
  }
];

// Helper function to ensure collection exists with data
async function ensureCollectionExists(db) {
  try {
    const collections = await db.listCollections({ name: 'Accessories' }).toArray();
    if (collections.length === 0) {
      console.log('Creating Accessories collection...');
      await db.createCollection('Accessories');
    }

    const count = await db.collection('Accessories').countDocuments();
    if (count === 0) {
      console.log('Initializing Accessories collection with sample data...');
      await db.collection('Accessories').insertMany(sampleAccessories.map(item => ({...item, _id: new ObjectId() })));
      console.log('Sample data inserted successfully');
    }
  } catch (err) {
    console.error('Error ensuring collection exists:', err);
  }
}

// GET /api/accessories (Get all accessories with filtering and sorting)
router.get('/', async (req, res) => {
  try {
    const db = await connectDB();
    const collection = db.collection('Accessories');

    // --- Pagination --- 
    const page = parseInt(req.query.page) || 1;
    let limit = 20;
    if (req.query.limit) {
        const parsedLimit = parseInt(req.query.limit);
        if (!isNaN(parsedLimit) && parsedLimit > 0) {
            limit = parsedLimit;
        }
    }
    const skip = (page - 1) * limit;

    // --- Filter Parameters --- 
    const searchTerm = req.query.search ? req.query.search.toString().trim() : '';
    const brand = req.query.brand ? req.query.brand.toString().trim() : '';
    const category = req.query.category ? req.query.category.toString().trim() : '';
    const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice) : null;
    const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : null;

    // --- Sort Parameters --- 
    const sortField = req.query.sort ? req.query.sort.toString() : 'default'; // e.g., 'price', or a default field
    const sortOrder = req.query.order && req.query.order.toString().toLowerCase() === 'desc' ? -1 : 1; // 1 for asc, -1 for desc

    console.log('[Backend - Accessories] Received Filters:', { searchTerm, brand, category, minPrice, maxPrice });
    console.log('[Backend - Accessories] Received Sort:', { sortField, sortOrder });

    // --- Build Query Filter --- 
    let queryFilter = {};
    const filterConditions = [];

    if (searchTerm) {
      const regex = { $regex: searchTerm, $options: 'i' };
      filterConditions.push({
        $or: [
          { name: regex },
          { brand: regex },
          { category: regex },
          { description: regex },
          { acc_id: regex }
        ]
      });
    }

    if (brand) {
      filterConditions.push({ brand: { $regex: `^${brand}$`, $options: 'i' } });
    }
    if (category) {
      filterConditions.push({ category: { $regex: `^${category}$`, $options: 'i' } });
    }

    const priceConditions = {};
    if (minPrice !== null && !isNaN(minPrice)) {
      priceConditions.$gte = minPrice;
    }
    if (maxPrice !== null && !isNaN(maxPrice)) {
      priceConditions.$lte = maxPrice;
    }
    if (Object.keys(priceConditions).length > 0) {
      filterConditions.push({ price: priceConditions });
    }
    
    if (filterConditions.length > 0) {
      queryFilter = { $and: filterConditions };
    }
    
    console.log('[Backend - Accessories] Executing Query Filter:', JSON.stringify(queryFilter));
    
    // --- Determine Sort Object --- 
    let sortObj = {};
    if (sortField === 'price') {
      sortObj = { price: sortOrder };
    } else {
      // Default sort or sort by relevance if search term is present
      // For now, if not sorting by price, let MongoDB handle default order or use a specific default field if desired.
      // Example: sortObj = { _id: 1 }; // Default sort by _id
    }
    if (Object.keys(sortObj).length === 0 && searchTerm) {
        // If searching and no specific sort, rely on MongoDB's text search relevance (if applicable) or default order.
        // If using MongoDB Atlas Search, $meta: "searchScore" would be used.
        // For simple regex, there isn't an inherent score to sort by directly in the .sort() method like this.
    }

    console.log('[Backend - Accessories] Using Sort Object:', JSON.stringify(sortObj));

    // Get total count & results
    const totalCount = await collection.countDocuments(queryFilter);
    console.log('[Backend - Accessories] Total matching accessories:', totalCount);

    const accessories = await collection.find(queryFilter)
      .sort(sortObj) // Apply sorting
      .skip(skip)
      .limit(limit)
      .toArray();
    
    // Ensure _id exists for frontend keys (already present in your sample code, good practice)
    const mappedAccessories = accessories.map(acc => ({
        ...acc,
        _id: acc._id ? acc._id.toString() : (acc.acc_id || (acc.id ? acc.id.toString() : Math.random().toString(36).substring(2)))
    }));
    
    res.json({
      accessories: mappedAccessories,
      totalCount,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit)
    });

  } catch (err) {
    console.error('Error fetching accessories:', err);
    res.status(500).json({ 
      error: 'Failed to fetch accessories',
      details: err.message 
    });
  }
});

// GET /api/accessories/search (Search accessories)
router.get('/search', async (req, res) => {
  try {
    const searchTerm = req.query.q;
    if (!searchTerm) {
      return res.status(400).json({ error: 'Search term is required' });
    }

    const db = await connectDB();
    const collection = db.collection('Accessories');

    const query = {
      $or: [
        { name: { $regex: searchTerm, $options: 'i' } },
        { brand: { $regex: searchTerm, $options: 'i' } },
        { category: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } },
        { acc_id: { $regex: searchTerm, $options: 'i' } }
      ]
    };

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10; // Adjusted default limit for search specifically
    const skip = (page - 1) * limit;

    const totalCount = await collection.countDocuments(query);
    const accessories = await collection.find(query)
      .skip(skip)
      .limit(limit)
      .toArray();

    const transformedAccessories = accessories.map(acc => ({
      _id: acc._id || acc.id || acc.acc_id,
      id: acc.id,
      acc_id: acc.acc_id,
      name: acc.name,
      brand: acc.brand,
      image_url: acc.image_url,
      category: acc.category,
      price: acc.price,
      original_price: acc.original_price,
      discount: acc.discount,
      rating: acc.rating,
      rating_count: acc.rating_count,
      description: acc.description,
      visual_cue: acc.visual_cue
    }));

    res.json({
      accessories: transformedAccessories,
      totalCount,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit)
    });
  } catch (err) {
    console.error('Error searching accessories:', err);
    res.status(500).json({ 
      error: 'Failed to search accessories',
      details: err.message 
    });
  }
});


// GET /api/accessories/:id (Get a single accessory)
router.get('/:id', async (req, res) => {
  try {
    const searchId = req.params.id;
    console.log('Fetching accessory with ID:', searchId);
    
    const db = await connectDB();
    const collection = db.collection('Accessories');

    // Log the total number of accessories in the collection
    const totalCount = await collection.countDocuments();
    console.log('Total accessories in collection:', totalCount);

    // Try different ways to find the accessory
    let accessory = null;
    
    // First try: exact match on any ID field
    accessory = await collection.findOne({
      $or: [
        { id: parseInt(searchId) },
        { id: searchId },
        { acc_id: searchId },
        { _id: searchId }
      ]
    });

    // If not found and it's a valid ObjectId, try that
    if (!accessory && ObjectId.isValid(searchId)) {
      console.log('Trying ObjectId search...');
      accessory = await collection.findOne({ 
        _id: new ObjectId(searchId) 
      });
    }

    // If still not found, try a case-insensitive search on acc_id
    if (!accessory) {
      console.log('Trying case-insensitive acc_id search...');
      accessory = await collection.findOne({
        acc_id: { $regex: new RegExp('^' + searchId + '$', 'i') }
      });
    }

    // Log what we found or didn't find
    if (accessory) {
      console.log('Found accessory:', {
        id: accessory.id,
        acc_id: accessory.acc_id,
        _id: accessory._id,
        name: accessory.name
      });
    } else {
      // Log a sample document from the collection to see its structure
      const sampleDoc = await collection.findOne({});
      console.log('No accessory found. Sample document structure:', sampleDoc);
    }

    if (!accessory) {
      return res.status(404).json({ 
        error: 'Accessory not found',
        details: `No accessory found with ID: ${searchId}`
      });
    }

    res.json(accessory);

  } catch (err) {
    console.error('Error fetching accessory:', err);
    res.status(500).json({ 
      error: 'Failed to fetch accessory',
      details: err.message 
    });
  }
});
export default router; 