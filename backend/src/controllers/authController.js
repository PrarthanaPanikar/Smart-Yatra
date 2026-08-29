const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/db');
const { ROLES } = require('../config/constants');

const generateToken = (userId, role) =>
  jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// POST /api/auth/register
const register = async (req, res) => {
  try {
    const { name, mobile, password, role, email } = req.body;
    if (!name || !mobile || !password || !role)
      return res.status(400).json({ error: 'name, mobile, password, role are required' });
    if (!Object.values(ROLES).includes(role))
      return res.status(400).json({ error: 'Invalid role' });

    // Check duplicate mobile
    const existing = db.prepare('SELECT id FROM users WHERE mobile = ?').get(mobile);
    if (existing) return res.status(409).json({ error: 'Mobile number already registered' });

    const id = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);

    db.prepare(
      `INSERT INTO users (id, name, mobile, email, password_hash, role)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, name, mobile, email || null, passwordHash, role);

    const user = db.prepare('SELECT id, name, mobile, email, role FROM users WHERE id = ?').get(id);
    const token = generateToken(user.id, user.role);

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: { id: user.id, name: user.name, mobile: user.mobile, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('Register error:', err);
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Mobile already registered' });
    res.status(500).json({ error: 'Registration failed' });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { mobile, password } = req.body;
    if (!mobile || !password)
      return res.status(400).json({ error: 'mobile and password are required' });

    const user = db.prepare(
      'SELECT id, name, mobile, email, password_hash, role, is_active FROM users WHERE mobile = ?'
    ).get(mobile);

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (!user.is_active) return res.status(403).json({ error: 'Account inactive' });

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    const token = generateToken(user.id, user.role);

    // Fetch assigned bus for drivers
    let assignedBus = null;
    if (user.role === ROLES.DRIVER) {
      assignedBus = db.prepare(
        `SELECT b.id, b.bus_number, b.status, b.gps_status,
                r.name as route_name, r.origin, r.destination
         FROM buses b
         LEFT JOIN routes r ON b.route_id = r.id
         WHERE b.driver_id = ? AND b.is_active = 1 LIMIT 1`
      ).get(user.id);
    }

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, mobile: user.mobile,
              email: user.email, role: user.role, assignedBus },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const user = db.prepare(
      'SELECT id, name, mobile, email, role, created_at FROM users WHERE id = ?'
    ).get(req.user.id);

    if (!user) return res.status(404).json({ error: 'User not found' });

    let assignedBus = null;
    if (user.role === ROLES.DRIVER) {
      assignedBus = db.prepare(
        `SELECT b.id, b.bus_number, b.status, b.gps_status,
                r.name as route_name, r.origin, r.destination
         FROM buses b LEFT JOIN routes r ON b.route_id = r.id
         WHERE b.driver_id = ? AND b.is_active = 1 LIMIT 1`
      ).get(user.id);
    }

    res.json({ user: { ...user, assignedBus } });
  } catch (err) {
    console.error('getMe error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

module.exports = { register, login, getMe };
