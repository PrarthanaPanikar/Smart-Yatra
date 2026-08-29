const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/db');
const { GPS_STATUS, GPS } = require('../config/constants');

const computeGpsStatus = (bus) => {
  if (!bus.last_gps_update) return GPS_STATUS.OFFLINE;
  const secondsAgo = (Date.now() - new Date(bus.last_gps_update).getTime()) / 1000;
  if (bus.gps_status === 'SIMULATION') return GPS_STATUS.SIMULATION;
  if (secondsAgo > GPS.OFFLINE_THRESHOLD) return GPS_STATUS.OFFLINE;
  if (secondsAgo > GPS.STALE_THRESHOLD)  return GPS_STATUS.STALE;
  return GPS_STATUS.CONNECTED;
};

// POST /api/gps/location
const updateLocation = async (req, res) => {
  try {
    const { busId, latitude, longitude, accuracy, speed, heading, timestamp, gpsSource } = req.body;
    if (!busId || latitude == null || longitude == null)
      return res.status(400).json({ error: 'busId, latitude, longitude required' });

    const bus = db.prepare('SELECT id, bus_number, driver_id FROM buses WHERE id = ? AND is_active = 1').get(busId);
    if (!bus) return res.status(404).json({ error: 'Bus not found' });

    // Security: driver can only update their own bus
    if (req.user.role === 'DRIVER' && bus.driver_id !== req.user.id)
      return res.status(403).json({ error: 'Not authorized to update GPS for this bus' });

    const source    = gpsSource === 'SIMULATION' ? 'SIMULATION' : 'DEVICE';
    const gpsStatus = source === 'SIMULATION' ? GPS_STATUS.SIMULATION : GPS_STATUS.CONNECTED;
    const ts        = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();

    db.prepare(
      `UPDATE buses SET
         current_latitude = ?, current_longitude = ?,
         gps_status = ?, gps_accuracy = ?, gps_speed = ?, gps_heading = ?,
         last_gps_update = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(latitude, longitude, gpsStatus, accuracy ?? null, speed ?? null, heading ?? null, ts, busId);

    db.prepare(
      `INSERT INTO gps_telemetry (id, bus_id, latitude, longitude, accuracy, speed, heading, gps_source, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(uuidv4(), busId, latitude, longitude, accuracy ?? null, speed ?? null, heading ?? null, source, ts);

    // Broadcast via Socket.IO
    const io = req.app.get('io');
    if (io) {
      const payload = { busId, busNumber: bus.bus_number, latitude, longitude,
                        accuracy, speed, heading, gpsStatus, gpsSource: source, timestamp: ts };
      io.to(`bus:${busId}`).emit('bus:location', payload);
      io.to('admin').emit('bus:location', payload);
    }

    res.json({ success: true, gpsStatus, timestamp: ts });
  } catch (err) {
    console.error('GPS update error:', err);
    res.status(500).json({ error: 'Failed to update GPS' });
  }
};

// GET /api/gps/bus/:busId
const getBusLocation = async (req, res) => {
  try {
    const bus = db.prepare(
      `SELECT id, bus_number, current_latitude, current_longitude,
              gps_status, gps_accuracy, gps_speed, gps_heading, last_gps_update,
              status, current_occupancy, seat_capacity, booked_cargo_kg, cargo_capacity_kg
       FROM buses WHERE id = ?`
    ).get(req.params.busId);

    if (!bus) return res.status(404).json({ error: 'Bus not found' });
    bus.gps_status = computeGpsStatus(bus);
    res.json({ bus });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get bus location' });
  }
};

// GET /api/gps/history/:busId
const getBusHistory = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const rows = db.prepare(
      `SELECT latitude, longitude, accuracy, speed, heading, gps_source, timestamp
       FROM gps_telemetry WHERE bus_id = ? ORDER BY timestamp DESC LIMIT ?`
    ).all(req.params.busId, limit);
    res.json({ telemetry: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get GPS history' });
  }
};

module.exports = { updateLocation, getBusLocation, getBusHistory, computeGpsStatus };
