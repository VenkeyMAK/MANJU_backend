import express from 'express';
import { ObjectId } from 'mongodb'; // Import ObjectId to handle MongoDB's unique IDs
import connectDB from '../db.js';

const router = express.Router();

// GET /api/groceries (with filtering, search, and pagination)
router.get('/', async (req, res) => {
  try {
    const db = await connectDB();
    const collection = db.collection('Grocery'); // Ensure this is your correct collection name

    // --- Filtering, Searching, and Sorting Logic ---
    const { q, category, minPrice, maxPrice, sortBy } = req.query;
    const filter = {};

    // Search query for name
    if (q) {
      filter.name = { $regex: q, $options: 'i' };
    }

    // Category filter
    if (category) {
      filter.category = category;
    }

    // Price range filter
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) {
        filter.price.$gte = parseFloat(minPrice);
      }
      if (maxPrice) {
        filter.price.$lte = parseFloat(maxPrice);
      }
    }
    
    // --- Pagination ---
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const groceries = await collection.find(filter).skip(skip).limit(limit).toArray();
    const totalGroceries = await collection.countDocuments(filter);

    res.json({
      groceries,
      currentPage: page,
      totalPages: Math.ceil(totalGroceries / limit),
      totalGroceries,
    });

  } catch (err) {
    console.error('Failed to get groceries:', err);
    res.status(500).json({ error: 'Failed to fetch groceries', details: err.message });
  }
});

// GET /api/groceries/:id (Get a single grocery item by ID)
router.get('/:id', async (req, res) => {
  try {
    const db = await connectDB();
    const collection = db.collection('Grocery');
    const { id } = req.params;

    // Validate that the ID is a valid MongoDB ObjectId
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid grocery ID format' });
    }

    const groceryItem = await collection.findOne({ _id: new ObjectId(id) });

    if (!groceryItem) {
      return res.status(404).json({ message: 'Grocery item not found' });
    }

    res.json(groceryItem);
  } catch (err) {
    console.error('Error fetching grocery item:', err);
    res.status(500).json({ message: 'Server Error', details: err.message });
  }
});

export default router;
