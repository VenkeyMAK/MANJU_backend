import express from 'express';
import connectDB from '../db.js';
const router = express.Router();

router.get('/mobile-brands', async (req, res) => {
  try {
    const db = await connectDB();
    const products = db.collection('Products');
    // Get all unique brands
    const brands = await products.distinct('Company Name');
    // Static map for brand images
    const brandImages = {
      "Apple": "https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg",
      "Samsung": "https://upload.wikimedia.org/wikipedia/commons/2/24/Samsung_Logo.svg",
      "Xiaomi": "https://upload.wikimedia.org/wikipedia/commons/2/29/Xiaomi_logo.svg",
      "OnePlus": "https://upload.wikimedia.org/wikipedia/commons/6/6e/OnePlus_logo.svg",
      "Realme": "https://upload.wikimedia.org/wikipedia/commons/6/6e/Realme_logo.svg",
      "Oppo": "https://upload.wikimedia.org/wikipedia/commons/5/5e/OPPO_LOGO_2019.svg",
      "Vivo": "https://upload.wikimedia.org/wikipedia/commons/6/6b/Vivo_logo_2019.svg",
      "Google": "https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg",
      "Motorola": "https://upload.wikimedia.org/wikipedia/commons/6/6b/Motorola_logo.svg",
      "Nokia": "https://upload.wikimedia.org/wikipedia/commons/8/8b/Nokia_wordmark.svg",
      "Nothing": "https://upload.wikimedia.org/wikipedia/commons/2/2e/Nothing_Technology_Limited_logo.svg"
    };
    const brandsWithImages = brands.map(name => ({
      name,
      image: brandImages[name] || null
    }));
    res.json({ brands: brandsWithImages });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch mobile brands', details: err.message });
  }
});

export default router; 