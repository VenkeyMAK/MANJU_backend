const mongoose = require('mongoose');

const grocerySchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, required: true },
  image_url: { type: String, required: true },
  stock: { type: Number, default: 0 },
  brand: { type: String },
  rating: { type: Number, default: 0 },
  rating_count: { type: String, default: '0' },
  original_price: { type: Number },
  discount: { type: Number },
  main_category: { type: String, default: 'groceries' },
}, {
  timestamps: true,
  collection: 'groceries' // Explicitly set collection name
});

const Grocery = mongoose.model('Grocery', grocerySchema);

module.exports = Grocery;
