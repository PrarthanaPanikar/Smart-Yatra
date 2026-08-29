const jwt = require('jsonwebtoken');
const { db } = require('../config/db');
const { GPS } = require('../config/constants');

let stalenessInterval = null;

const setupSocket = (io) => {
  // Auth middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = db.prepare('SELECT id, name, role FROM users WHERE id = ? AND is_active = 1').get(decoded.userId);
      if (!user) return next(new Error('User not found'));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const { id: userId, name, role } = socket.user;
    console.log(`Socket: ${name} (${role}) connected [${socket.id}]`);

    socket.join(role.toLowerCase());
    if (role === 'ADMIN') socket.join('admin');

    socket.on('subscribe:bus',     (busId) => socket.join(`bus:${busId}`));
    socket.on('unsubscribe:bus',   (busId) => socket.leave(`bus:${busId}`));
    socket.on('subscribe:booking', (id)    => socket.join(`booking:${id}`));
    socket.on('subscribe:all-buses', ()    => { if (role === 'ADMIN') socket.join('admin'); });
    
    // Resilience system subscriptions
    socket.on('subscribe:system', () => {
      if (role === 'ADMIN') {
        socket.join('system-events');
        console.log(`[Socket] Admin ${name} subscribed to system events`);
      }
    });

    socket.on('driver:status-update', async ({ busId, status }) => {
      if (role !== 'DRIVER') return;
      const bus = db.prepare('SELECT id, bus_number FROM buses WHERE id = ? AND driver_id = ?').get(busId, userId);
      if (!bus) return;
      db.prepare("UPDATE buses SET status=?, updated_at=datetime('now') WHERE id=?").run(status, busId);
      io.to(`bus:${busId}`).emit('bus:status', { busId, status });
      io.to('admin').emit('bus:status', { busId, status, busNumber: bus.bus_number });
    });

    socket.on('disconnect', () => {
      console.log(`Socket: ${name} disconnected`);
    });
  });

  // GPS staleness checker every 15s
  if (stalenessInterval) clearInterval(stalenessInterval);
  stalenessInterval = setInterval(() => {
    try {
      const staleThreshold  = new Date(Date.now() - GPS.STALE_THRESHOLD  * 1000).toISOString();
      const offlineThreshold= new Date(Date.now() - GPS.OFFLINE_THRESHOLD* 1000).toISOString();

      // Mark stale
      const staled = db.prepare(`
        UPDATE buses SET gps_status='STALE', updated_at=datetime('now')
        WHERE gps_status='CONNECTED' AND last_gps_update < ?
      `).run(staleThreshold);

      // Mark offline
      db.prepare(`
        UPDATE buses SET gps_status='OFFLINE', updated_at=datetime('now')
        WHERE gps_status IN ('CONNECTED','STALE') AND last_gps_update < ?
      `).run(offlineThreshold);

      // Broadcast status changes (fetch affected)
      const offlineBuses = db.prepare(
        "SELECT id, bus_number FROM buses WHERE gps_status='OFFLINE' AND last_gps_update < ?"
      ).all(offlineThreshold);

      offlineBuses.forEach(b => {
        io.to(`bus:${b.id}`).emit('bus:gps-status', { busId: b.id, status: 'OFFLINE' });
        io.to('admin').emit('bus:gps-status', { busId: b.id, busNumber: b.bus_number, status: 'OFFLINE' });
      });
    } catch (err) {
      console.error('Staleness check error:', err.message);
    }
  }, 15000);
};

module.exports = { setupSocket };
