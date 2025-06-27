import express from 'express';
import connectDB from '../db.js';

const router = express.Router();

// Unified endpoint for filtering all products
router.get('/all-products', async (req, res) => {
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
            search,
            sortBy = 'default',
            page = 1,
            limit = 20
        } = req.query;

        const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

        // Pipeline to standardize fields from the 'Products' (mobiles) collection
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
                            else: null
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
                    description: '$Description' // Assuming a description field exists
                }
            }
        ];

        // Pipeline to standardize fields from the 'Accessories' collection
        const accessoriesPipeline = [
            {
                $project: {
                    _id: '$id',
                    name: '$name',
                    brand: '$brand',
                    price: '$price',
                    type: 'accessory',
                    category: '$category',
                    imageUrl: '$image_url',
                    description: '$description'
                }
            }
        ];

        // Pipeline to standardize fields from the 'Grocery' collection
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
                    description: '$description'
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
        } else { // 'all' categories
            mainPipeline = productsPipeline.concat([
                { $unionWith: { coll: 'Accessories', pipeline: accessoriesPipeline } },
                { $unionWith: { coll: 'Grocery', pipeline: groceryPipeline } }
            ]);
        }

        const matchConditions = [];
        if (search) {
            const regex = { $regex: search, $options: 'i' };
            matchConditions.push({ $or: [{ name: regex }, { brand: regex }, { description: regex }] });
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

        // Category-specific filters
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

        res.json({
            products,
            totalCount,
            currentPage: parseInt(page, 10),
            totalPages: Math.ceil(totalCount / parseInt(limit, 10))
        });

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
            productsCollection.distinct('Company Name'),
            productsCollection.distinct('RAM'),
            productsCollection.distinct('Processor'),
            accessoriesCollection.distinct('category'),
            groceryCollection.distinct('category'),
        ]);

        res.json({ brands, rams, processors, accessoryTypes, groceryCategories });
    } catch (err) {
        console.error('Failed to fetch filter options:', err);
        res.status(500).json({ error: 'Failed to fetch filter options', details: err.message });
    }
});

export default router;