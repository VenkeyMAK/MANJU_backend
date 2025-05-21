import express from 'express';
import Review from '../models/Review.js';
import connectDB from '../db.js';
import auth from '../middleware/auth.js';

const router = express.Router();


router.post('/reviews', auth, async (req, res) => {
  try {
    const db = await connectDB();
    const reviewData = {
      userId: req.user.id,
      productId: req.body.productId,
      rating: req.body.rating,
      title: req.body.title,
      comment: req.body.comment,
      userName: req.body.userName,
      images: req.body.images || [], // Array of image URLs
      videos: req.body.videos || [], // Array of video URLs
      verifiedPurchase: req.body.verifiedPurchase || false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Validate rating
    if (reviewData.rating < 1 || reviewData.rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Validate media files
    if (reviewData.images.length > 5) {
      return res.status(400).json({ error: 'Maximum 5 images allowed per review' });
    }
    if (reviewData.videos.length > 2) {
      return res.status(400).json({ error: 'Maximum 2 videos allowed per review' });
    }
    
    const result = await Review.create(db, reviewData);
    res.status(201).json(result);
  } catch (err) {
    console.error('Error creating review:', err);
    res.status(500).json({ error: 'Failed to create review' });
  }
});

// Get all reviews for a product
router.get('/reviews/product/:productId', async (req, res) => {
  try {
    const db = await connectDB();
    const reviews = await Review.findByProductId(db, req.params.productId);
    res.json(reviews);
  } catch (err) {
    console.error('Error fetching reviews:', err);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Get all reviews by a user (protected route)
router.get('/reviews/user', auth, async (req, res) => {
  try {
    const db = await connectDB();
    const reviews = await Review.findByUserId(db, req.user.id);
    res.json(reviews);
  } catch (err) {
    console.error('Error fetching user reviews:', err);
    res.status(500).json({ error: 'Failed to fetch user reviews' });
  }
});

// Update a review (protected route)
router.put('/reviews/:id', auth, async (req, res) => {
  try {
    const db = await connectDB();
    const review = await Review.findById(db, req.params.id);
    
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    if (review.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to update this review' });
    }
    
    const updateData = {
      rating: req.body.rating,
      title: req.body.title,
      comment: req.body.comment,
      images: req.body.images,
      videos: req.body.videos,
      updatedAt: new Date()
    };

    // Validate rating
    if (updateData.rating && (updateData.rating < 1 || updateData.rating > 5)) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Validate media files
    if (updateData.images && updateData.images.length > 5) {
      return res.status(400).json({ error: 'Maximum 5 images allowed per review' });
    }
    if (updateData.videos && updateData.videos.length > 2) {
      return res.status(400).json({ error: 'Maximum 2 videos allowed per review' });
    }
    
    const result = await Review.update(db, req.params.id, updateData);
    res.json(result);
  } catch (err) {
    console.error('Error updating review:', err);
    res.status(500).json({ error: 'Failed to update review' });
  }
});

// Delete a review (protected route)
router.delete('/reviews/:id', auth, async (req, res) => {
  try {
    const db = await connectDB();
    const review = await Review.findById(db, req.params.id);
    
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    if (review.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this review' });
    }
    
    await Review.delete(db, req.params.id);
    res.json({ message: 'Review deleted successfully' });
  } catch (err) {
    console.error('Error deleting review:', err);
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

export default router;