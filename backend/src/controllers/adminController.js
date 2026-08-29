const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/db');
const { computeGpsStatus } = require('./gpsController');

const enrichBus = (b) => ({
  ...b,
  gps_status:        computeGpsStatus(b),
  available_seats:   (b.seat_capacity || 0) - (b.current_occupancy || 0),
  available_cargo_kg: parseFloat(b.cargo_capacity_kg || 0) - parseFloat(b.booked_cargo_kg || 0),
});

// GET /api/admin/dashboard
const getDashboard = async (req, res) => {
  try {
    const busStat = db.prepare(`
      SELECT COUNT(*) as total,
        SUM(CASE WHEN status='IN_TRANSIT' THEN 1 ELSE 0 END) as running,
        SUM(CASE WHEN status='SCHEDULED'  THEN 1 ELSE 0 END) as scheduled,
        SUM(CASE WHEN status='BREAKDOWN'  THEN 1 ELSE 0 END) as breakdown,
        SUM(CASE WHEN status='CANCELLED'  THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN status='AT_STOP'    THEN 1 ELSE 0 END) as at_stop
      FROM buses WHERE is_active = 1
    `).get();

    const gpsStat = db.prepare(`
      SELECT
        SUM(CASE WHEN gps_status='CONNECTED'  THEN 1 ELSE 0 END) as connected,
        SUM(CASE WHEN gps_status='STALE'      THEN 1 ELSE 0 END) as stale,
        SUM(CASE WHEN gps_status='OFFLINE'    THEN 1 ELSE 0 END) as offline,
        SUM(CASE WHEN gps_status='SIMULATION' THEN 1 ELSE 0 END) as simulation
      FROM buses WHERE is_active = 1
    `).get();

    const bkStat = db.prepare(`
      SELECT COUNT(*) as total_bookings,
        SUM(CASE WHEN booking_type='PASSENGER' THEN 1 ELSE 0 END) as passenger_bookings,
        SUM(CASE WHEN booking_type='CARGO'     THEN 1 ELSE 0 END) as cargo_bookings,
        SUM(CASE WHEN status='CONFIRMED' THEN estimated_cost ELSE 0 END) as total_revenue
      FROM bookings WHERE date(created_at) = date('now')
    `).get();

    const pendingReports = db.prepare(`
      SELECT dr.id, dr.report_type, dr.message, dr.status, dr.timestamp,
             b.bus_number, u.name as driver_name
      FROM driver_reports dr
      JOIN buses b ON dr.bus_id = b.id
      JOIN users u ON dr.driver_id = u.id
      WHERE dr.status = 'PENDING'
      ORDER BY dr.timestamp DESC LIMIT 5
    `).all();

    res.json({ buses: busStat, gps: gpsStat, bookings: bkStat, pendingReports });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
};

// GET /api/admin/buses
const getAllBuses = async (req, res) => {
  try {
    const buses = db.prepare(`
      SELECT b.*, r.name as route_name, r.origin, r.destination, r.distance_km,
             u.id as driver_user_id, u.name as driver_name, u.mobile as driver_mobile
      FROM buses b
      LEFT JOIN routes r ON b.route_id = r.id
      LEFT JOIN users  u ON b.driver_id = u.id
      WHERE b.is_active = 1 ORDER BY b.bus_number
    `).all();
    res.json({ buses: buses.map(enrichBus) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch buses' });
  }
};

// POST /api/admin/buses
const createBus = async (req, res) => {
  try {
    const { busNumber, routeId, driverId, seatCapacity, cargoCapacityKg, departureTime, arrivalTime } = req.body;
    if (!busNumber) return res.status(400).json({ error: 'busNumber required' });

    const id = uuidv4();
    db.prepare(
      `INSERT INTO buses (id, bus_number, route_id, driver_id, seat_capacity, cargo_capacity_kg, departure_time, arrival_time)
       VALUES (?,?,?,?,?,?,?,?)`
    ).run(id, busNumber, routeId || null, driverId || null, seatCapacity || 50, cargoCapacityKg || 500, departureTime || null, arrivalTime || null);

    res.status(201).json({ message: 'Bus created', bus: db.prepare('SELECT * FROM buses WHERE id = ?').get(id) });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Bus number already exists' });
    res.status(500).json({ error: 'Failed to create bus' });
  }
};

// PUT /api/admin/buses/:id
const updateBus = async (req, res) => {
  try {
    const { routeId, driverId, seatCapacity, cargoCapacityKg, status, departureTime, arrivalTime } = req.body;
    const existing = db.prepare('SELECT * FROM buses WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Bus not found' });

    db.prepare(`
      UPDATE buses SET
        route_id        = ?,
        driver_id       = ?,
        seat_capacity   = ?,
        cargo_capacity_kg = ?,
        status          = ?,
        departure_time  = ?,
        arrival_time    = ?,
        updated_at      = datetime('now')
      WHERE id = ?
    `).run(
      routeId        ?? existing.route_id,
      driverId       ?? existing.driver_id,
      seatCapacity   ?? existing.seat_capacity,
      cargoCapacityKg?? existing.cargo_capacity_kg,
      status         ?? existing.status,
      departureTime  ?? existing.departure_time,
      arrivalTime    ?? existing.arrival_time,
      req.params.id
    );

    res.json({ message: 'Bus updated', bus: db.prepare('SELECT * FROM buses WHERE id = ?').get(req.params.id) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update bus' });
  }
};

// GET /api/admin/reports
const getReports = async (req, res) => {
  try {
    const { status } = req.query;
    const where = status ? 'WHERE dr.status = ?' : '';
    const params = status ? [status] : [];
    const reports = db.prepare(`
      SELECT dr.*, b.bus_number, u.name as driver_name, u.mobile as driver_mobile
      FROM driver_reports dr
      JOIN buses b ON dr.bus_id  = b.id
      JOIN users u ON dr.driver_id = u.id
      ${where} ORDER BY dr.timestamp DESC LIMIT 50
    `).all(...params);
    res.json({ reports });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
};

// PUT /api/admin/reports/:id/acknowledge
const acknowledgeReport = async (req, res) => {
  try {
    db.prepare(`
      UPDATE driver_reports SET status='ACKNOWLEDGED', acknowledged_by=?, acknowledged_at=datetime('now')
      WHERE id = ?
    `).run(req.user.id, req.params.id);

    const io = req.app.get('io');
    if (io) io.to('admin').emit('report:acknowledged', { reportId: req.params.id });

    res.json({ message: 'Acknowledged' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to acknowledge' });
  }
};

// GET /api/admin/users
const getUsers = async (req, res) => {
  try {
    const users = db.prepare(
      'SELECT id, name, mobile, email, role, is_active, created_at FROM users ORDER BY role, name'
    ).all();
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// GET /api/admin/bookings
const getAllBookings = async (req, res) => {
  try {
    const { type } = req.query;
    const where  = type ? "WHERE bk.booking_type = ?" : '';
    const params = type ? [type] : [];
    const bookings = db.prepare(`
      SELECT bk.*, b.bus_number, r.name as route_name, u.name as user_name
      FROM bookings bk
      JOIN buses b ON bk.bus_id = b.id
      LEFT JOIN routes r ON b.route_id = r.id
      JOIN users u ON bk.user_id = u.id
      ${where} ORDER BY bk.created_at DESC LIMIT 100
    `).all(...params);
    res.json({ bookings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
};

// DELETE /api/admin/buses/:id  (soft delete — sets is_active = 0)
const deleteBus = async (req, res) => {
  try {
    const bus = db.prepare('SELECT id, bus_number FROM buses WHERE id = ?').get(req.params.id);
    if (!bus) return res.status(404).json({ error: 'Bus not found' });

    // Check for active confirmed bookings today
    const activeBookings = db.prepare(
      `SELECT COUNT(*) as c FROM bookings
       WHERE bus_id = ? AND status = 'CONFIRMED' AND date(created_at) = date('now')`
    ).get(req.params.id);

    if (activeBookings.c > 0) {
      return res.status(409).json({
        error: `Cannot delete ${bus.bus_number} — it has ${activeBookings.c} active booking(s) today. Cancel those first.`,
      });
    }

    db.prepare("UPDATE buses SET is_active = 0, updated_at = datetime('now') WHERE id = ?")
      .run(req.params.id);

    res.json({ message: `Bus ${bus.bus_number} deleted successfully` });
  } catch (err) {
    console.error('Delete bus error:', err);
    res.status(500).json({ error: 'Failed to delete bus' });
  }
};

module.exports = { getDashboard, getAllBuses, createBus, updateBus, deleteBus, getReports, acknowledgeReport, getUsers, getAllBookings };
