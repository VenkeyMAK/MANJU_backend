/**
 * Middleware to check if user is an admin
 */
export const isAdmin = (req, res, next) => {
  try {
    // Check if user is authenticated and has admin role
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    next();
  } catch (err) {
    console.error('Error in admin middleware:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Middleware to check if user is the owner of the resource or an admin
 */
export const isOwnerOrAdmin = (req, res, next) => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // If user is admin, grant access
    if (req.user.role === 'admin') {
      return next();
    }

    // If user is the owner of the resource, grant access
    if (req.params.userId && req.params.userId === req.user.id) {
      return next();
    }

    // If no conditions are met, deny access
    res.status(403).json({ success: false, error: 'Access denied' });
  } catch (err) {
    console.error('Error in owner/admin middleware:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
