import express from 'express';
import { ObjectId } from 'mongodb'; // Import ObjectId to handle MongoDB's unique IDs
import connectDB from '../db.js';

const router = express.Router();

// GET /api/groceries (with filtering, search, and pagination)
router.get('/', async (req, res) => {
  try {
    const db = await connectDB();
    const collection = db.collection('Grocery');

    const { 
      q, 
      category, 
      minPrice, 
      maxPrice, 
      sort = 'featured',
      order = 'asc',
      brand,
      inStock 
    } = req.query;
    
    const filter = {};

    // Search query for name
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } }
      ];
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

    // Stock filter
    if (inStock !== undefined) {
      filter.stock = inStock === 'true' ? { $gt: 0 } : { $lte: 0 };
    }
    
    // --- Pagination ---
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // --- Sorting ---
    let sortOptions = {};
    switch (sort) {
      case 'price':
        sortOptions.price = order === 'desc' ? -1 : 1;
        break;
      case 'name':
        sortOptions.name = order === 'desc' ? -1 : 1;
        break;
      case 'stock':
        sortOptions.stock = order === 'desc' ? -1 : 1;
        break;
      default:
        sortOptions = { _id: -1 }; // Default sort by latest
    }

    // Execute the main query
    const groceries = await collection
      .find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .toArray();

    // Get total count for pagination
    const totalGroceries = await collection.countDocuments(filter);

    // Get available filters
    const aggregateFilters = await collection.aggregate([
      {
        $facet: {
          categories: [
            { $group: { _id: "$category" } },
            { $sort: { _id: 1 } }
          ],
          priceRange: [
            {
              $group: {
                _id: null,
                minPrice: { $min: "$price" },
                maxPrice: { $max: "$price" }
              }
            }
          ]
        }
      }
    ]).toArray();

    // Transform the response to match the frontend expectations
    const transformedGroceries = groceries.map(item => ({
      _id: item._id,
      id: item.id,
      name: item.name,
      price: item.price,
      category: item.category,
      image_url: item.image_url,
      description: item.description || '',
      unit: item.unit || '',
      stock: item.stock || 0,
      in_stock: item.stock > 0
    }));

    res.json({
      groceries: transformedGroceries,
      currentPage: page,
      totalPages: Math.ceil(totalGroceries / limit),
      totalGroceries,
      filters: {
        categories: aggregateFilters[0].categories.map(c => c._id).filter(Boolean),
        brands: [], // Since we don't have brands in the current schema
        priceRange: aggregateFilters[0].priceRange[0] || { minPrice: 0, maxPrice: 10000 }
      }
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

    let query;
    if (ObjectId.isValid(id)) {
      query = { $or: [{ _id: new ObjectId(id) }, { id: parseInt(id) }] };
    } else {
      query = { id: parseInt(id) };
    }

    const groceryItem = await collection.findOne(query);

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
