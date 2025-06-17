import UserProfile from '../models/UserProfile.js';
import dbPromise from '../db.js';
import { ObjectId } from 'mongodb';

// Profile Controllers
export const getProfile = async (req, res) => {
  try {
    const db = await dbPromise();
    let profile = await db.collection('userprofiles').findOne({ userId: req.user.id });
    
    // If no profile exists, create one
    if (!profile) {
      profile = {
        userId: req.user.id,
        name: '',
        email: '',
        phone: '',
        addresses: [],
        orders: [],
        wishlist: [],
        createdAt: new Date()
      };
      await db.collection('userprofiles').insertOne(profile);
    }
    
    res.json(profile);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      message: 'Failed to get profile',
      error: error.message
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const db = await dbPromise();
    const result = await db.collection('userprofiles').findOneAndUpdate(
      { userId: req.user.id },
      { 
        $set: { 
          ...req.body,
          updatedAt: new Date() 
        } 
      },
      { 
        upsert: true,
        returnDocument: 'after'
      }
    );

    if (!result.value && !result) {
      return res.status(400).json({ message: 'Failed to update profile' });
    }

    res.json(result);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ 
      message: 'Failed to update profile',
      error: error.message
    });
  }
};

// Address Controllers
export const addAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const db = await dbPromise();

    // Check if profile exists
    let profile = await db.collection('userprofiles').findOne({ userId });

    // Create profile if it doesn't exist
    if (!profile) {
      profile = {
        userId,
        name: '',
        email: '',
        phone: '',
        addresses: [],
        orders: [],
        wishlist: [],
        createdAt: new Date()
      };
      await db.collection('userprofiles').insertOne(profile);
    }

    // Create new address with ObjectId
    const newAddress = {
      _id: new ObjectId(),
      ...req.body,
      createdAt: new Date()
    };

    const result = await db.collection('userprofiles').findOneAndUpdate(
      { userId },
      { $push: { addresses: newAddress } },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(400).json({ message: 'Failed to add address' });
    }

    res.json(result.value.addresses);
  } catch (error) {
    console.error('Add address error:', error);
    res.status(500).json({
      message: 'Failed to add address',
      error: error.message
    });
  }
};

export const updateAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const addressId = req.params.addressId;
    const db = await dbPromise();
    
    const result = await db.collection('userprofiles').findOneAndUpdate(
      { 
        userId, 
        'addresses._id': new ObjectId(addressId) 
      },
      { 
        $set: { 
          'addresses.$': {
            _id: new ObjectId(addressId),
            ...req.body,
            updatedAt: new Date()
          }
        } 
      },
      { returnDocument: 'after' }
    );

    if (!result.value && !result) {
      return res.status(400).json({ message: 'Failed to update address' });
    }

    res.json(result);
  } catch (error) {
    console.error('Update address error:', error);
    res.status(500).json({ 
      message: 'Failed to update address',
      error: error.message
    });
  }
};

export const deleteAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const addressId = req.params.addressId;
    const db = await dbPromise();
    
    const result = await db.collection('userprofiles').findOneAndUpdate(
      { userId },
      { $pull: { addresses: { _id: new ObjectId(addressId) } } },
      { returnDocument: 'after' }
    );

    if (!result.value && !result) {
      return res.status(400).json({ message: 'Failed to delete address' });
    }

    res.json(result);
  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({ 
      message: 'Failed to delete address',
      error: error.message
    });
  }
};

export const getAddresses = async (req, res) => {
  try {
    const userId = req.user.id;
    const db = await dbPromise();
    
    const profile = await db.collection('userprofiles').findOne({ userId });
    res.json(profile?.addresses || []);
  } catch (error) {
    console.error('Get addresses error:', error);
    res.status(500).json({ 
      message: 'Failed to get addresses',
      error: error.message
    });
  }
};

// Orders Controllers
export const getOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const db = await dbPromise();
    const profile = await db.collection('userprofiles').findOne({ userId });
    res.json(profile?.orders || []);
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      message: 'Failed to get orders',
      error: error.message
    });
  }
};

// Wishlist Controllers
export const addToWishlist = async (req, res) => {
  try {
    const userId = req.user.id;
    const db = await dbPromise();

    // Defensive: ensure id is present and mapped, and productId is removed
    let product = { ...req.body };
    if (!product.id && product._id) {
      product.id = product._id;
    }
    if ('productId' in product) {
      delete product.productId;
    }

    // Only add if id is present and not null/undefined
    if (!product.id) {
      return res.status(400).json({ message: 'Product id is required for wishlist' });
    }

    await db.collection('userprofiles').updateOne(
      { userId },
      { $addToSet: { wishlist: { ...product, addedAt: new Date() } } },
      { upsert: true }
    );
    const updatedProfile = await db.collection('userprofiles').findOne({ userId });
    res.json(updatedProfile.wishlist);
  } catch (error) {
    console.error('Add to wishlist error:', error);
    res.status(500).json({ 
      message: 'Failed to add to wishlist',
      error: error.message
    });
  }
};

export const removeFromWishlist = async (req, res) => {
  try {
    const userId = req.user.id;
    const db = await dbPromise();
    // Remove by product.id
    await db.collection('userprofiles').updateOne(
      { userId },
      { $pull: { wishlist: { id: req.params.productId } } }
    );
    const updatedProfile = await db.collection('userprofiles').findOne({ userId });
    res.json(updatedProfile.wishlist);
  } catch (error) {
    res.status(500).json({ message: 'Failed to remove from wishlist', error: error.message });
  }
};


export const addOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const db = await dbPromise();

    // Ensure product details are included in the order
    const newOrder = {
      _id: new ObjectId(),
      ...req.body, // Should include product details
      createdAt: new Date()
    };

    const result = await db.collection('userprofiles').findOneAndUpdate(
      { userId },
      { $push: { orders: newOrder } },
      { returnDocument: 'after', upsert: true }
    );

    if (!result.value) {
      return res.status(400).json({ message: 'Failed to add order' });
    }

    res.json({ success: true, order: newOrder });
  } catch (error) {
    console.error('Add order error:', error);
    res.status(500).json({
      message: 'Failed to add order',
      error: error.message
    });
  }
};

export const getWishlist = async (req, res) => {
  try {
    const userId = req.user.id;
    const db = await dbPromise();
    const profile = await db.collection('userprofiles').findOne({ userId });
    res.json(profile?.wishlist || []);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get wishlist', error: error.message });
  }
};

// Cart Controllers
export const getCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const db = await dbPromise();
    const profile = await db.collection('userprofiles').findOne({ userId });

    if (!profile) {
      return res.json([]);
    }

    // Combine all cart items from different categories
    const productCart = (profile.cart || []).map(item => ({ ...item, category: 'products' }));
    const accessoriesCart = (profile.accessoriesCart || []).map(item => ({ ...item, category: 'accessories' }));
    const groceriesCart = (profile.groceriesCart || []).map(item => ({ ...item, category: 'groceries' }));

    const allCartItems = [...productCart, ...accessoriesCart, ...groceriesCart];

    if (allCartItems.length === 0) {
      return res.json([]);
    }

    // Get all unique product IDs from all carts
    const productIds = [...new Set(allCartItems.map(item => item.productId).filter(id => id))];
    const objectProductIds = productIds.map(id => {
        try {
            return new ObjectId(id);
        } catch {
            return null;
        }
    }).filter(id => id !== null);

    // Fetch all product details from all collections in parallel
    const [products, accessories, groceries] = await Promise.all([
      db.collection('Products').find({ _id: { $in: objectProductIds } }).toArray(),
      db.collection('Accessories').find({ _id: { $in: objectProductIds } }).toArray(),
      db.collection('Groceries').find({ _id: { $in: objectProductIds } }).toArray()
    ]);

    const allProductsMap = new Map();
    [...products, ...accessories, ...groceries].forEach(p => allProductsMap.set(p._id.toString(), p));

    // Map cart items with full product details
    const cartWithDetails = allCartItems.map(item => {
      const productDetail = allProductsMap.get(item.productId.toString());
      
      return {
        ...item,
        product: productDetail
          ? {
              id: productDetail._id.toString(),
              _id: productDetail._id.toString(),
              name: productDetail["Model Name"] || productDetail.name || "N/A",
              description: productDetail.description || "N/A",
              price: parseFloat(String(productDetail["Price"] || productDetail.price || '0').replace(/[^0-9.-]+/g, "")) || 0,
              imageUrl: productDetail["Image URL"] || productDetail.imageUrl || "https://via.placeholder.com/150?text=No+Image",
              category: item.category, // Carry over the category
          }
          : {
              id: item.productId,
              _id: item.productId,
              name: "Product not found",
              description: "The product associated with this item could not be found.",
              price: 0,
              imageUrl: "https://via.placeholder.com/150?text=Not+Found",
              category: item.category,
            }
      };
    });

    res.json(cartWithDetails);
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ message: 'Failed to get cart', error: error.message });
  }
};

export const addToCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const db = await dbPromise();
    const { productId, quantity = 1, ...rest } = req.body;

    // Defensive: ensure productId is present
    if (!productId) {
      return res.status(400).json({ message: 'Product id is required for cart' });
    }

    // Find user profile or create if not exists
    let profile = await db.collection('userprofiles').findOne({ userId });
    if (!profile) {
      profile = {
        userId,
        name: '',
        email: '',
        phone: '',
        addresses: [],
        orders: [],
        wishlist: [],
        cart: [],
        createdAt: new Date()
      };
      await db.collection('userprofiles').insertOne(profile);
    }

    // Check if product already in cart
    const existingCartItem = (profile.cart || []).find(item => item.productId === productId);
    let updatedCart;
    if (existingCartItem) {
      updatedCart = (profile.cart || []).map(item =>
        item.productId === productId
          ? { ...item, quantity: item.quantity + quantity }
          : item
      );
    } else {
      updatedCart = [
        ...(profile.cart || []),
        { _id: new ObjectId(), productId, quantity, ...rest, addedAt: new Date() }
      ];
    }

    await db.collection('userprofiles').updateOne(
      { userId },
      { $set: { cart: updatedCart } }
    );
    res.json(updatedCart);
  } catch (error) {
    res.status(500).json({ message: 'Failed to add to cart', error: error.message });
  }
};

export const updateCartItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const cartItemId = req.params.itemId;
    const { quantity } = req.body;
    const db = await dbPromise();

    const profile = await db.collection('userprofiles').findOne({ userId });
    if (!profile || !profile.cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    const updatedCart = profile.cart.map(item =>
      item._id && item._id.toString() === cartItemId
        ? { ...item, quantity }
        : item
    );

    await db.collection('userprofiles').updateOne(
      { userId },
      { $set: { cart: updatedCart } }
    );
    res.json(updatedCart);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update cart item', error: error.message });
  }
};

export const removeFromCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const cartItemId = req.params.itemId;
    const db = await dbPromise();

    const profile = await db.collection('userprofiles').findOne({ userId });
    if (!profile || !profile.cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    const updatedCart = profile.cart.filter(item => !(item._id && item._id.toString() === cartItemId));

    await db.collection('userprofiles').updateOne(
      { userId },
      { $set: { cart: updatedCart } }
    );
    res.json(updatedCart);
  } catch (error) {
    res.status(500).json({ message: 'Failed to remove from cart', error: error.message });
  }
};

export const clearCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const db = await dbPromise();

    await db.collection('userprofiles').updateOne(
      { userId },
      { $set: { cart: [] } }
    );
    res.json([]);
  } catch (error) {
    res.status(500).json({ message: 'Failed to clear cart', error: error.message });
  }
};

// Accessories Cart Controllers
export const getAccessoriesCart = async (req, res) => {
  try {
    const db = await dbPromise();
    const profile = await UserProfile.findOne(db, { userId: req.user.id });
    
    if (!profile) {
      return res.json([]);
    }

    const cartItems = profile.accessoriesCart || [];
    if (cartItems.length === 0) {
      return res.json([]);
    }

    // Return cart items with their stored product data
    const cartWithDetails = cartItems.map(item => ({
      _id: item._id,
      productId: item.productId,
      quantity: item.quantity,
      category: 'accessories',
      product: item.product || {
        id: item.productId,
        name: "N/A",
        description: "N/A",
        price: 0,
        imageUrl: "https://via.placeholder.com/150?text=No+Image",
        brand: "N/A",
        category: "accessories"
      }
    }));

    res.json(cartWithDetails);
  } catch (error) {
    console.error('Get accessories cart error:', error);
    res.status(500).json({ message: 'Failed to get accessories cart', error: error.message });
  }
};

export const addToAccessoriesCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const db = await dbPromise();
    const { productId, quantity = 1, product } = req.body;

    // Defensive: ensure productId is present
    if (!productId) {
      return res.status(400).json({ message: 'Product id is required for cart' });
    }

    // Find user profile or create if not exists
    let profile = await UserProfile.findOne(db, { userId });
    if (!profile) {
      profile = {
        userId,
        name: '',
        email: '',
        phone: '',
        addresses: [],
        orders: [],
        wishlist: [],
        cart: [],
        accessoriesCart: [],
        createdAt: new Date()
      };
      await UserProfile.insertOne(db, profile);
    }

    // Check if product already in cart
    const existingCartItem = (profile.accessoriesCart || []).find(item => item.productId === productId);
    let updatedCart;
    if (existingCartItem) {
      updatedCart = (profile.accessoriesCart || []).map(item =>
        item.productId === productId
          ? { ...item, quantity: item.quantity + quantity }
          : item
      );
    } else {
      // Create new cart item with product details
      const newCartItem = {
        _id: new ObjectId(),
        productId,
        quantity,
        product: {
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          imageUrl: product.imageUrl,
          brand: product.brand,
          category: 'accessories',
          stock: product.stock
        },
        addedAt: new Date()
      };
      updatedCart = [...(profile.accessoriesCart || []), newCartItem];
    }

    await UserProfile.updateOne(
      db,
      { userId },
      { $set: { accessoriesCart: updatedCart } }
    );
    res.json(updatedCart);
  } catch (error) {
    console.error('Add to accessories cart error:', error);
    res.status(500).json({ message: 'Failed to add to accessories cart', error: error.message });
  }
};

export const updateAccessoriesCartItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const cartItemId = req.params.itemId;
    const { quantity } = req.body;
    const db = await dbPromise();

    const profile = await UserProfile.findOne(db, { userId });
    if (!profile || !profile.accessoriesCart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    const updatedCart = profile.accessoriesCart.map(item =>
      item._id && item._id.toString() === cartItemId
        ? { ...item, quantity }
        : item
    );

    await UserProfile.updateOne(
      db,
      { userId },
      { $set: { accessoriesCart: updatedCart } }
    );
    res.json(updatedCart);
  } catch (error) {
    console.error('Update accessories cart item error:', error);
    res.status(500).json({ message: 'Failed to update accessories cart item', error: error.message });
  }
};

export const removeFromAccessoriesCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const cartItemId = req.params.itemId;
    const db = await dbPromise();

    const profile = await UserProfile.findOne(db, { userId });
    if (!profile || !profile.accessoriesCart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    const updatedCart = profile.accessoriesCart.filter(item => !(item._id && item._id.toString() === cartItemId));

    await UserProfile.updateOne(
      db,
      { userId },
      { $set: { accessoriesCart: updatedCart } }
    );
    res.json(updatedCart);
  } catch (error) {
    console.error('Remove from accessories cart error:', error);
    res.status(500).json({ message: 'Failed to remove from accessories cart', error: error.message });
  }
};

export const clearAccessoriesCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const db = await dbPromise();

    await UserProfile.updateOne(
      db,
      { userId },
      { $set: { accessoriesCart: [] } }
    );
    res.json([]);
  } catch (error) {
    console.error('Clear accessories cart error:', error);
    res.status(500).json({ message: 'Failed to clear accessories cart', error: error.message });
  }
};

// Groceries Cart Controllers
export const getGroceriesCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const db = await dbPromise();
    const profile = await UserProfile.findOne(db, { userId });
    res.json(profile?.groceriesCart || []);
  } catch (error) {
    console.error('Get groceries cart error:', error);
    res.status(500).json({ message: 'Failed to get groceries cart', error: error.message });
  }
};

export const addToGroceriesCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, quantity } = req.body;
    const db = await dbPromise();

    const product = await db.collection('Groceries').findOne({ _id: new ObjectId(productId) });
    if (!product) {
      return res.status(404).json({ message: 'Grocery product not found' });
    }

    let profile = await UserProfile.findOne(db, { userId });
    if (!profile) {
      profile = { userId, groceriesCart: [], createdAt: new Date() };
      await UserProfile.insertOne(db, profile);
    }

    const existingCartItem = (profile.groceriesCart || []).find(item => item.productId === productId);
    let updatedCart;
    if (existingCartItem) {
      updatedCart = profile.groceriesCart.map(item =>
        item.productId === productId
          ? { ...item, quantity: item.quantity + quantity }
          : item
      );
    } else {
      const newCartItem = {
        _id: new ObjectId(),
        productId,
        quantity,
        product: { ...product, id: product._id, category: 'groceries' },
        addedAt: new Date()
      };
      updatedCart = [...(profile.groceriesCart || []), newCartItem];
    }

    await UserProfile.updateOne(db, { userId }, { $set: { groceriesCart: updatedCart } });
    res.json(updatedCart);
  } catch (error) {
    console.error('Add to groceries cart error:', error);
    res.status(500).json({ message: 'Failed to add to groceries cart', error: error.message });
  }
};

export const updateGroceriesCartItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const cartItemId = req.params.itemId;
    const { quantity } = req.body;
    const db = await dbPromise();

    const profile = await UserProfile.findOne(db, { userId });
    if (!profile || !profile.groceriesCart) {
      return res.status(404).json({ message: 'Groceries cart not found' });
    }

    const updatedCart = profile.groceriesCart.map(item =>
      item._id && item._id.toString() === cartItemId
        ? { ...item, quantity }
        : item
    );

    await UserProfile.updateOne(db, { userId }, { $set: { groceriesCart: updatedCart } });
    res.json(updatedCart);
  } catch (error) {
    console.error('Update groceries cart item error:', error);
    res.status(500).json({ message: 'Failed to update groceries cart item', error: error.message });
  }
};

export const removeFromGroceriesCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const cartItemId = req.params.itemId;
    const db = await dbPromise();

    const profile = await UserProfile.findOne(db, { userId });
    if (!profile || !profile.groceriesCart) {
      return res.status(404).json({ message: 'Groceries cart not found' });
    }

    const updatedCart = profile.groceriesCart.filter(item => !(item._id && item._id.toString() === cartItemId));

    await UserProfile.updateOne(db, { userId }, { $set: { groceriesCart: updatedCart } });
    res.json(updatedCart);
  } catch (error) {
    console.error('Remove from groceries cart error:', error);
    res.status(500).json({ message: 'Failed to remove from groceries cart', error: error.message });
  }
};

export const clearGroceriesCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const db = await dbPromise();

    await UserProfile.updateOne(db, { userId }, { $set: { groceriesCart: [] } });
    res.json([]);
  } catch (error) {
    console.error('Clear groceries cart error:', error);
    res.status(500).json({ message: 'Failed to clear groceries cart', error: error.message });
  }
};
