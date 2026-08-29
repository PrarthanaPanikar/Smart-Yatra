const jwt = require('jsonwebtoken');
const { db } = require('../config/db');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer '))
      return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = db.prepare(
      'SELECT id, name, mobile, role, is_active FROM users WHERE id = ?'
    ).get(decoded.userId);

    if (!user || !user.is_active)
      return res.status(401).json({ error: 'User not found or inactive' });

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expired' });
    if (err.name === 'JsonWebTokenError')  return res.status(401).json({ error: 'Invalid token' });
    return res.status(500).json({ error: 'Authentication error' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (!roles.includes(req.user.role))
    return res.status(403).json({ error: `Access denied. Required: ${roles.join(' or ')}` });
  next();
};

module.exports = { authenticate, requireRole };
