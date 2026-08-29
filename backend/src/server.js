require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const server = http.createServer(app);

// ── Socket.IO ──────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Make io accessible in controllers via req.app.get('io')
app.set('io', io);

// ── Security ───────────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false,   // allow Leaflet tiles
  contentSecurityPolicy: false,
}));

// ── CORS ───────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// ── Body parsing ───────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Rate limiting ──────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Try again later.' },
});
app.use('/api', apiLimiter);

// GPS endpoint has its own higher limit (frequent updates)
const gpsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120, // 2/sec
});
app.use('/api/gps/location', gpsLimiter);

// ── Routes ─────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/gps',           require('./routes/gps'));
app.use('/api/buses',         require('./routes/buses'));
app.use('/api/bookings',      require('./routes/bookings'));
app.use('/api/driver',        require('./routes/driver'));
app.use('/api/admin',         require('./routes/admin'));
app.use('/api/parcels',       require('./routes/parcels'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/recovery',      require('./routes/recovery')); // Resilience system

// ── Health check ───────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'SmartYatra API',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Error handler
app.use(errorHandler);

// ── Socket.IO setup ────────────────────────────────────────
const { setupSocket } = require('./socket/socketHandler');
setupSocket(io);

// ── Resilience System Setup ────────────────────────────────
const healthMonitor = require('./resilience/healthMonitor');
const recoveryEngine = require('./resilience/recoveryEngine');
const backupManager = require('./resilience/backupManager');

// Connect recovery engine to Socket.IO for broadcasting
recoveryEngine.setIO(io);

// Start health monitoring (check every 5 seconds)
healthMonitor.startMonitoring(5000);

// Listen for state changes and broadcast to clients
healthMonitor.onStateChange((status) => {
  io.emit('system:health', status);
  console.log(`[System] Health state: ${status.state}`);
  
  // Auto-recovery on OFFLINE state
  if (status.state === 'OFFLINE' && !recoveryEngine.recovering) {
    console.log('[System] Auto-recovery triggered');
    recoveryEngine.startRecovery().catch(err => {
      console.error('[System] Auto-recovery failed:', err.message);
    });
  }
});

// Create initial backup on startup
backupManager.createBackup('manual').catch(err => {
  console.error('[System] Initial backup failed:', err.message);
});

console.log('✓ Resilience system initialized');

// ── Start ──────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log('');
  console.log('🚌 SmartYatra Backend Started');
  console.log(`   Port    : ${PORT}`);
  console.log(`   Env     : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   API     : http://localhost:${PORT}/api`);
  console.log(`   Health  : http://localhost:${PORT}/api/health`);
  console.log(`   Recovery: http://localhost:${PORT}/api/recovery/health`);
  console.log('');
});

module.exports = { app, server, io };
