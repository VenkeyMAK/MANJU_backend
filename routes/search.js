import express from 'express';
import { ObjectId } from 'mongodb';
import connectDB from '../db.js';

const router = express.Router();

// GET /api/search - Global search across all product collections
router.get('/', async (req, res) => {
    try {
        const searchTerm = req.query.q;
        if (!searchTerm) {
            return res.status(400).json({ error: 'Search term is required' });
        }

        const db = await connectDB();
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const categoryFilter = req.query.category ? req.query.category.toLowerCase() : '';

        // Define base search query for mobiles (Products)
        const mobileQuery = {
            $or: [
                { name: { $regex: searchTerm, $options: 'i' } },
                { description: { $regex: searchTerm, $options: 'i' } },
                { category: { $regex: searchTerm, $options: 'i' } },
                { "Model Name": { $regex: searchTerm, $options: 'i' } },
                { "Company Name": { $regex: searchTerm, $options: 'i' } }
            ]
        };
        const accessoriesQuery = {
            $or: [
                { name: { $regex: searchTerm, $options: 'i' } },
                { brand: { $regex: searchTerm, $options: 'i' } },
                { category: { $regex: searchTerm, $options: 'i' } },
                { description: { $regex: searchTerm, $options: 'i' } },
                { acc_id: { $regex: searchTerm, $options: 'i' } },
            ]
        };
        const groceryQuery = {
            $or: [
                { name: { $regex: searchTerm, $options: 'i' } },
                { category: { $regex: searchTerm, $options: 'i' } },
                { description: { $regex: searchTerm, $options: 'i' } }
            ]
        };

        // Apply category filter to each query if present
        let filteredMobileQuery = { ...mobileQuery };
        let filteredAccessoriesQuery = { ...accessoriesQuery };
        let filteredGroceryQuery = { ...groceryQuery };
        if (categoryFilter) {
            if (["mobile", "mobiles", "product", "products"].includes(categoryFilter)) {
                filteredMobileQuery = { $and: [mobileQuery, { category: { $regex: categoryFilter, $options: 'i' } }] };
            } else if (["accessory", "accessories"].includes(categoryFilter)) {
                filteredAccessoriesQuery = { $and: [accessoriesQuery, { category: { $regex: categoryFilter, $options: 'i' } }] };
            } else if (["grocery", "groceries"].includes(categoryFilter)) {
                filteredGroceryQuery = { $and: [groceryQuery, { category: { $regex: categoryFilter, $options: 'i' } }] };
            } else {
                // For custom categories, try to match in all
                filteredMobileQuery = { $and: [mobileQuery, { category: { $regex: categoryFilter, $options: 'i' } }] };
                filteredAccessoriesQuery = { $and: [accessoriesQuery, { category: { $regex: categoryFilter, $options: 'i' } }] };
                filteredGroceryQuery = { $and: [groceryQuery, { category: { $regex: categoryFilter, $options: 'i' } }] };
            }
        }

        // Search in all collections concurrently
        const [products, accessories, groceries] = await Promise.all([
            db.collection('Products').find(filteredMobileQuery).toArray(),
            db.collection('Accessories').find(filteredAccessoriesQuery).toArray(),
            db.collection('Grocery').find(filteredGroceryQuery).toArray()
        ]);

        // Transform products (mobiles)
        const transformedProducts = products.map(item => ({
            _id: item._id,
            name: item["Model Name"] || item.name,
            price: parseInt(item["Price"]?.replace(/[^0-9]/g, '') || item.price),
            image_url: item["Image URL"] || item.image,
            category: item.category || 'Mobiles',
            type: 'product',
            route: `/products/${item._id}`,
            description: `${item["Company Name"] || ''} ${item["Model Name"] || ''}`.trim()
        }));

        // Transform accessories
        const transformedAccessories = accessories.map(item => ({
            _id: item._id,
            id: item.id,
            acc_id: item.acc_id,
            name: item.name,
            price: item.price,
            image_url: item.image_url,
            category: item.category || 'Accessories',
            type: 'accessory',
            route: `/accessories/${ item.id}`,
            description: item.description || ''
        }));

        // Transform groceries
        const transformedGroceries = groceries.map(item => ({
            _id: item._id,
            name: item.name,
            price: item.price,
            image_url: item.image_url || item.image,
            category: item.category || 'Groceries',
            type: 'grocery',
            route: `/groceries/${item._id}`,
            description: item.description || ''
        }));

        // Combine and paginate
        const allResults = [
            ...transformedProducts,
            ...transformedAccessories,
            ...transformedGroceries
        ];
        const sortedResults = allResults.sort((a, b) => {
            const aNameMatch = a.name.toLowerCase().includes(searchTerm.toLowerCase());
            const bNameMatch = b.name.toLowerCase().includes(searchTerm.toLowerCase());
            if (aNameMatch && !bNameMatch) return -1;
            if (!aNameMatch && bNameMatch) return 1;
            return 0;
        });
        const paginatedResults = sortedResults.slice(skip, skip + limit);

        res.json({
            results: paginatedResults,
            totalCount: sortedResults.length,
            currentPage: page,
            totalPages: Math.ceil(sortedResults.length / limit),
            categories: {
                products: products.length,
                accessories: accessories.length,
                groceries: groceries.length
            }
        });
    } catch (err) {
        console.error('Global search error:', err);
        res.status(500).json({ 
            error: 'Failed to perform global search',
            details: err.message 
        });
    }
});

// GET /api/categories - Get all unique categories from all collections
router.get('/categories', async (req, res) => {
    try {
        const db = await connectDB();
        const productCategories = await db.collection('Products').distinct('category');
        const productBrands = await db.collection('Products').distinct('Company Name');
        const accessoryCategories = await db.collection('Accessories').distinct('category');
        const groceryCategories = await db.collection('Grocery').distinct('category');

        // Combine and deduplicate
        const allCategories = [
            ...productCategories,
            ...accessoryCategories,
            ...groceryCategories
        ].filter(Boolean);
        const uniqueCategories = Array.from(new Set(allCategories));

        res.json({
            categories: uniqueCategories,
            brands: Array.from(new Set(productBrands.filter(Boolean)))
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch categories', details: err.message });
    }
});

export default router; 