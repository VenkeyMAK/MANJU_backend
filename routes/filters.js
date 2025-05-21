import express from 'express';
import dbPromise from '../db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const db = await dbPromise;
    const collection = db.collection('products');
    const brands = await collection.distinct('name');
    const memories = await collection.distinct('memory');
    const displays = await collection.distinct('display');
    const batteries = await collection.distinct('battery');
    res.json({ brands, memories, displays, batteries });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch filters' });
  }
});

export default router;