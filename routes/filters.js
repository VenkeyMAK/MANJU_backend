import express from 'express';
import connectDB from '../db.js';

const router = express.Router();

// Input validation middleware
const validateQuery = (req, res, next) => {
  const { minPrice, maxPrice, page, limit } = req.query;
  if (minPrice && isNaN(parseFloat(minPrice))) {
    return res.status(400).json({ error: 'Invalid minPrice' });
  }
  if (maxPrice && isNaN(parseFloat(maxPrice))) {
    return res.status(400).json({ error: 'Invalid maxPrice' });
  }
  if (page && (isNaN(parseInt(page)) || parseInt(page) < 1)) {
    return res.status(400).json({ error: 'Invalid page number' });
  }
  if (limit && (isNaN(parseInt(limit)) || parseInt(limit) < 1)) {
    return res.status(400).json({ error: 'Invalid limit' });
  }
  next();
};

// Unified endpoint for filtering all products
router.get('/all-products', validateQuery, async (req, res) => {
  try {
    const db = await connectDB();
    const {
      selectedCategory = 'all',
      brand,
      minPrice,
      maxPrice,
      ram,
      processor,
      accessoryType,
      groceryCategory,
      stockFilter,
      search,
      sortBy = 'default',
      page = 1,
      limit = 20
    } = req.query;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const productsPipeline = [
      {
        $addFields: {
          numericPrice: {
            $cond: {
              if: { $and: [{ $ne: ["$Price", null] }, { $ne: ["$Price", ""] }, { $eq: [{ $type: "$Price" }, "string"] }] },
              then: {
                $toInt: {
                  $trim: {
                    chars: " ",
                    input: {
                      $replaceAll: {
                        input: { $replaceAll: { input: "$Price", find: ",", replacement: "" } },
                        find: "₹",
                        replacement: ""
                      }
                    }
                  }
                }
              },
              else: "$Price" // Fallback to original Price if not a string
            }
          }
        }
      },
      {
        $project: {
          _id: 1,
          name: '$Model Name',
          brand: '$Company Name',
          price: '$numericPrice',
          type: 'mobile',
          category: 'mobiles',
          RAM: '$RAM',
          Processor: '$Processor',
          imageUrl: '$Image URL',
          description: '$Description',
          stock: '$stock',
          rating: '$rating',
          rating_count: '$rating_count'
        }
      }
    ];

    const accessoriesPipeline = [
      {
        $project: {
          _id: 1,
          name: '$name',
          brand: '$brand',
          price: '$price',
          type: 'accessory',
          category: '$category',
          imageUrl: '$image_url',
          description: '$description',
          stock: '$stock',
          rating: '$rating',
          rating_count: '$rating_count'
        }
      }
    ];

    const groceryPipeline = [
      {
        $project: {
          _id: 1,
          name: '$name',
          brand: '$brand',
          price: '$price',
          type: 'grocery',
          category: '$category',
          imageUrl: '$image_url',
          description: '$description',
          stock: '$stock',
          rating: '$rating',
          rating_count: '$rating_count'
        }
      }
    ];

    let mainPipeline = [];
    let sourceCollectionName = 'Products';

    if (selectedCategory === 'mobiles') {
      mainPipeline = productsPipeline;
    } else if (selectedCategory === 'accessories') {
      sourceCollectionName = 'Accessories';
      mainPipeline = accessoriesPipeline;
    } else if (selectedCategory === 'groceries') {
      sourceCollectionName = 'Grocery';
      mainPipeline = groceryPipeline;
    } else {
      mainPipeline = productsPipeline.concat([
        { $unionWith: { coll: 'Accessories', pipeline: accessoriesPipeline } },
        { $unionWith: { coll: 'Grocery', pipeline: groceryPipeline } }
      ]);
    }

    const matchConditions = [];
    if (search) {
      const regex = { $regex: search, $options: 'i' };
      matchConditions.push({ $or: [{ name: regex }, { brand: regex }, { description: regex }, { category: regex }] });
    }
    if (brand) {
      matchConditions.push({ brand: { $regex: `^${brand}$`, $options: 'i' } });
    }
    if (minPrice) {
      matchConditions.push({ price: { $gte: parseInt(minPrice, 10) } });
    }
    if (maxPrice) {
      matchConditions.push({ price: { $lte: parseInt(maxPrice, 10) } });
    }
    if (stockFilter) {
      if (stockFilter === 'in-stock') {
        matchConditions.push({ stock: { $gt: 0 } });
      } else if (stockFilter === 'low-stock') {
        matchConditions.push({ stock: { $gte: 1, $lte: 10 } });
      } else if (stockFilter === 'out-of-stock') {
        matchConditions.push({ stock: { $eq: 0 } });
      }
    }
    if (selectedCategory === 'mobiles') {
      if (ram) matchConditions.push({ RAM: ram });
      if (processor) matchConditions.push({ Processor: processor });
    } else if (selectedCategory === 'accessories') {
      if (accessoryType) matchConditions.push({ category: { $regex: `^${accessoryType}$`, $options: 'i' } });
    } else if (selectedCategory === 'groceries') {
      if (groceryCategory) matchConditions.push({ category: { $regex: `^${groceryCategory}$`, $options: 'i' } });
    }

    if (matchConditions.length > 0) {
      mainPipeline.push({ $match: { $and: matchConditions } });
    }

    if (sortBy && sortBy !== 'default') {
      const sortMap = {
        'price-asc': { price: 1 },
        'price-desc': { price: -1 },
        'name-asc': { name: 1 },
        'name-desc': { name: -1 },
        'rating-desc': { rating: -1 },
        'stock-desc': { stock: -1 }
      };
      if (sortMap[sortBy]) {
        mainPipeline.push({ $sort: sortMap[sortBy] });
      }
    }

    const countPipeline = [...mainPipeline, { $count: 'total' }];

    mainPipeline.push({ $skip: skip });
    mainPipeline.push({ $limit: parseInt(limit, 10) });

    const sourceCollection = db.collection(sourceCollectionName);

    const [products, countResult] = await Promise.all([
      sourceCollection.aggregate(mainPipeline).toArray(),
      sourceCollection.aggregate(countPipeline).toArray()
    ]);

    const totalCount = countResult.length > 0 ? countResult[0].total : 0;
    const result = {
      products,
      totalCount,
      currentPage: parseInt(page, 10),
      totalPages: Math.ceil(totalCount / parseInt(limit, 10))
    };

    res.json(result);
  } catch (err) {
    console.error('Error fetching filtered products:', err);
    res.status(500).json({ error: 'Failed to fetch products', details: err.message });
  }
});

// Endpoint to get all available filter options for the UI
router.get('/', async (req, res) => {
  try {
    const db = await connectDB();
    const productsCollection = db.collection('Products');
    const accessoriesCollection = db.collection('Accessories');
    const groceryCollection = db.collection('Grocery');

    const [brands, rams, processors, accessoryTypes, groceryCategories] = await Promise.all([
      productsCollection.distinct('Company Name', { 'Company Name': { $ne: null } }),
      productsCollection.distinct('RAM', { RAM: { $ne: null } }),
      productsCollection.distinct('Processor', { Processor: { $ne: null } }),
      accessoriesCollection.distinct('category', { category: { $ne: null } }),
      groceryCollection.distinct('category', { category: { $ne: null } })
    ]);

    const result = { brands, rams, processors, accessoryTypes, groceryCategories };
    res.json(result);
  } catch (err) {
    console.error('Failed to fetch filter options:', err);
    res.status(500).json({ error: 'Failed to fetch filter options', details: err.message });
  }
});

export default router;