import express from 'express';
import { ObjectId } from 'mongodb';
import connectDB from '../db.js';

const router = express.Router();

// GET /api/products/search?q=ap
router.get('/search', async (req, res) => {
  try {
    const db = await connectDB();
    const collection = db.collection('Products'); // Note: collection name in lowercase
    const q = req.query.q || '';
    const products = await collection.find({
      name: { $regex: q, $options: 'i' }
    }).toArray();
    res.json(products);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Failed to search products', details: err.message });
  }
});

// GET /api/products (Get all products with search and filtering)
router.get('/', async (req, res) => {
  try {
    const db = await connectDB();
    const collection = db.collection('Products'); 
    
    // --- Pagination ---
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // --- Search Term ---
    const searchTerm = req.query.search ? req.query.search.toString().trim() : '';
    
    // --- Filter Parameters (Trim values) ---
    const brand = req.query.brand ? req.query.brand.toString().trim() : '';
    const ram = req.query.ram ? req.query.ram.toString().trim() : '';
    const processor = req.query.processor ? req.query.processor.toString().trim() : '';
    const launchedYear = req.query.launchedYear ? req.query.launchedYear.toString().trim() : '';
    const minPrice = req.query.minPrice ? req.query.minPrice.toString().trim() : '';
    const maxPrice = req.query.maxPrice ? req.query.maxPrice.toString().trim() : '';
    
    console.log('[Backend - Products] Received Filters:', { brand, ram, processor, launchedYear, minPrice, maxPrice });

    // --- Build Aggregation Pipeline ---
    const pipeline = [];

    // Stage 1: Add a numeric price field by parsing the 'Price' string
    // This stage attempts to convert "₹ 79,999" to 79999
    // It handles cases where Price might be missing or not a string
    pipeline.push({
      $addFields: {
        numericPrice: {
          $cond: {
            if: { $and: [ { $ne: ["$Price", null] }, { $ne: ["$Price", ""] }, { $eq: [{ $type: "$Price" }, "string"] } ] },
            then: {
              $toInt: {
                $trim: { // Trim any whitespace that might result from replacements
                  chars: " ", // Explicitly trim spaces
                  input: {
                    $replaceAll: {
                      input: { $replaceAll: { input: "$Price", find: ",", replacement: "" } },
                      find: "₹", // Assuming Rupee symbol, adjust if currency varies or isn't present
                      replacement: ""
                    }
                  }
                }
              }
            },
            else: null // Or a default value like -1 if you prefer to filter out non-parsable prices
          }
        }
      }
    });
    
    // --- Build Match Filter for Aggregation ---
    let matchFilter = {};
    const filterConditions = [];

    // Search condition
    if (searchTerm) {
      const regex = { $regex: searchTerm, $options: 'i' };
      filterConditions.push({
        $or: [
          { "Model Name": regex },
          { "Company Name": regex },
          // { "Processor": regex } // Avoid double-filtering processor if specific filter exists
        ]
      });
    }

    // Specific field filters
    if (brand) {
      filterConditions.push({ "Company Name": { $regex: `^${brand}$`, $options: 'i' } }); 
    }
    if (ram) {
       filterConditions.push({ "RAM": { $regex: ram, $options: 'i' } }); 
    }

    // Price filter (applied on the new numericPrice field)
    let minPriceNumeric = minPrice ? parseInt(minPrice) : null;
    let maxPriceNumeric = null;
    let noUpperPriceLimit = false;

    if (maxPrice) {
      if (maxPrice.endsWith('+')) {
        // Indicates no upper limit beyond this base (e.g., "150000+")
        // We'll parse the number but won't use it for an $lte if this is the case
        maxPriceNumeric = parseInt(maxPrice.replace('+', '')); 
        noUpperPriceLimit = true;
      } else {
        maxPriceNumeric = parseInt(maxPrice);
      }
      if (isNaN(maxPriceNumeric)) maxPriceNumeric = null;
    }
    if (minPriceNumeric !== null && isNaN(minPriceNumeric)) minPriceNumeric = null;

    if (minPriceNumeric !== null) {
      filterConditions.push({ numericPrice: { $gte: minPriceNumeric } });
    }
    if (maxPriceNumeric !== null && !noUpperPriceLimit) {
      filterConditions.push({ numericPrice: { $lte: maxPriceNumeric } });
    }
    // If noUpperPriceLimit is true, we don't add an $lte for maxPriceNumeric, effectively having no upper bound.

    if (processor) {
       filterConditions.push({ "Processor": { $regex: processor, $options: 'i' } }); 
    }
    if (launchedYear) {
        const yearNumber = parseInt(launchedYear);
        if (!isNaN(yearNumber)) {
            filterConditions.push({ "Launched Year": yearNumber }); 
        } else {
             filterConditions.push({ "Launched Year": launchedYear }); 
        }
    }

    if (filterConditions.length > 0) {
        matchFilter = { $and: filterConditions };
    }
    
    // Add the $match stage to the pipeline if there are any conditions
    if (Object.keys(matchFilter).length > 0) {
        pipeline.push({ $match: matchFilter });
    }
    
    console.log('[Backend - Products] Executing Aggregation Pipeline with Match Filter:', JSON.stringify(matchFilter));
    
    // Stage 3: Get total count and paginated results using $facet
    pipeline.push({
      $facet: {
        paginatedResults: [{ $skip: skip }, { $limit: limit }],
        totalCount: [{ $count: 'count' }]
      }
    });

    const results = await collection.aggregate(pipeline).toArray();
    
    const productsFromDb = results[0].paginatedResults;
    const totalCount = results[0].totalCount[0] ? results[0].totalCount[0].count : 0;

    console.log('[Backend - Products] Total matching products from aggregation:', totalCount);
    
    // --- Transformation --- 
    const transformedProducts = productsFromDb.map(product => ({
      _id: product._id,
      "Company Name": product["Company Name"] || product.companyName || "",
      "Model Name": product["Model Name"] || product.modelName || "",
      "Mobile Weight": product["Mobile Weight"] || product.mobileWeight || "",
      "RAM": product["RAM"] || product.ram || "",
      "Front Camera": product["Front Camera"] || product.frontCamera || "",
      "Back Camera": product["Back Camera"] || product.backCamera || "",
      "Processor": product["Processor"] || product.processor || "",
      "Battery Capacity": product["Battery Capacity"] || product.batteryCapacity || "",
      "Screen Size": product["Screen Size"] || product.screenSize || "",
      "Launched Price (Pakistan)": product["Launched Price (Pakistan)"] || product.launchedPricePakistan || "",
      "Price": product["Price"] || product.Price || "",
      "Launched Price (China)": product["Launched Price (China)"] || product.launchedPriceChina || "",
      "Launched Price (USA)": product["Launched Price (USA)"] || product.launchedPriceUSA || "",
      "Launched Price (Dubai)": product["Launched Price (Dubai)"] || product.launchedPriceDubai || "",
      "Launched Year": product["Launched Year"] || product.launchedYear || "",
      "Image URL": product["Image URL"] || product.imageUrl || ""
    }));
    
    res.json({
      products: transformedProducts,
      totalCount,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit)
    });
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ 
      error: 'Failed to fetch products',
      details: err.message 
    });
  }
});

// GET /api/products/:id (Get a single product by ID)
router.get('/:id', async (req, res) => {
  try {
    const db = await connectDB();
    const collection = db.collection('Products'); // Note: collection name in lowercase
    const productId = req.params.id;

    if (!ObjectId.isValid(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const product = await collection.findOne({ _id: new ObjectId(productId) });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (err) {
    console.error('Error fetching product:', err);
    res.status(500).json({ error: 'Failed to fetch product', details: err.message });
  }
});

// POST /api/products (Create a new product)
router.post('/', async (req, res) => {
  try {
    const db = await connectDB();
    const collection = db.collection('products');
    const newProduct = req.body;

    // Basic validation (you should expand this)
    if (!newProduct.name || !newProduct.price) {
      return res.status(400).json({ error: 'Name and price are required' });
    }

    const result = await collection.insertOne(newProduct);
    res.status(201).json({ message: 'Product created', insertedId: result.insertedId });
  } catch (err) {
    console.error('Error creating product', err);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// PUT /api/products/:id (Update an existing product)
router.put('/:id', async (req, res) => {
  try {
    const db = await connectDB();
    const collection = db.collection('Products');
    const productId = req.params.id;

    // Check if the ID is a valid ObjectId
    if (!ObjectId.isValid(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }
    const updatedProduct = req.body;

    // Basic validation (you should expand this)
    if (!updatedProduct.name || !updatedProduct.price) {
      return res.status(400).json({ error: 'Name and price are required' });
    }

    const result = await collection.updateOne(
      { _id: new ObjectId(productId) },
      { $set: updatedProduct }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ message: 'Product updated', modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error('Error updating product', err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE /api/products/:id (Delete a product)
router.delete('/:id', async (req, res) => {
  try {
    const db = await connectDB();
    const collection = db.collection('products');
    const productId = req.params.id;

    // Check if the ID is a valid ObjectId
    if (!ObjectId.isValid(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const result = await collection.deleteOne({ _id: new ObjectId(productId) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ message: 'Product deleted', deletedCount: result.deletedCount });
  } catch (err) {
    console.error('Error deleting product', err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

export default router;