const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/db');
const { PARCEL_STATUS, PARCEL_TRANSITIONS } = require('../config/constants');

// Resilience system
const operationJournal = require('../resilience/operationJournal');
const healthMonitor = require('../resilience/healthMonitor');
const recoveryQueue = require('../resilience/recoveryQueue');

// GET /api/driver/bus
const getMyBus = async (req, res) => {
  try {
    const bus = db.prepare(
      `SELECT b.*, r.name as route_name, r.origin, r.destination, r.distance_km
       FROM buses b LEFT JOIN routes r ON b.route_id = r.id
       WHERE b.driver_id = ? AND b.is_active = 1 LIMIT 1`
    ).get(req.user.id);

    if (!bus) return res.status(404).json({ error: 'No bus assigned' });
    bus.available_seats    = bus.seat_capacity - bus.current_occupancy;
    bus.available_cargo_kg = parseFloat(bus.cargo_capacity_kg) - parseFloat(bus.booked_cargo_kg);
    res.json({ bus });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bus' });
  }
};

// GET /api/driver/bookings
const getDriverBookings = async (req, res) => {
  try {
    const bus = db.prepare('SELECT id FROM buses WHERE driver_id = ? AND is_active = 1 LIMIT 1').get(req.user.id);
    if (!bus) return res.status(404).json({ error: 'No bus assigned' });

    const bookings = db.prepare(
      `SELECT bk.id, bk.booking_type, bk.from_stop, bk.to_stop,
              bk.seats, bk.goods_type, bk.weight_kg, bk.urgency,
              bk.status, bk.parcel_id, bk.created_at,
              u.name as passenger_name, u.mobile as passenger_mobile
       FROM bookings bk JOIN users u ON bk.user_id = u.id
       WHERE bk.bus_id = ? AND bk.status = 'CONFIRMED'
         AND date(bk.created_at) = date('now')
       ORDER BY bk.booking_type, bk.created_at`
    ).all(bus.id);

    res.json({ bookings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
};

// POST /api/driver/occupancy
const updateOccupancy = async (req, res) => {
  try {
    const { boarded, exited, stopName } = req.body;

    const bus = db.prepare(
      'SELECT id, bus_number, seat_capacity, current_occupancy FROM buses WHERE driver_id = ? AND is_active = 1 LIMIT 1'
    ).get(req.user.id);
    if (!bus) return res.status(404).json({ error: 'No bus assigned' });

    const boardedN = parseInt(boarded) || 0;
    const exitedN  = parseInt(exited)  || 0;
    const newOcc   = Math.max(0, Math.min(bus.current_occupancy + boardedN - exitedN, bus.seat_capacity));

    db.prepare("UPDATE buses SET current_occupancy = ?, updated_at = datetime('now') WHERE id = ?")
      .run(newOcc, bus.id);

    const io = req.app.get('io');
    if (io) {
      const update = {
        busId: bus.id, busNumber: bus.bus_number,
        currentOccupancy: newOcc, seatCapacity: bus.seat_capacity,
        availableSeats: bus.seat_capacity - newOcc, stopName, boarded: boardedN, exited: exitedN,
      };
      io.to(`bus:${bus.id}`).emit('bus:occupancy', update);
      io.to('admin').emit('bus:occupancy', update);
    }

    res.json({ message: 'Occupancy updated', currentOccupancy: newOcc, availableSeats: bus.seat_capacity - newOcc });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update occupancy' });
  }
};

// POST /api/driver/report
const submitReport = async (req, res) => {
  try {
    const { reportType, message, latitude, longitude } = req.body;
    if (!reportType) return res.status(400).json({ error: 'reportType required' });

    const bus = db.prepare('SELECT id, bus_number FROM buses WHERE driver_id = ? AND is_active = 1 LIMIT 1').get(req.user.id);
    if (!bus) return res.status(404).json({ error: 'No bus assigned' });

    const id = uuidv4();
    db.prepare(
      `INSERT INTO driver_reports (id, driver_id, bus_id, report_type, message, latitude, longitude)
       VALUES (?,?,?,?,?,?,?)`
    ).run(id, req.user.id, bus.id, reportType, message || null, latitude || null, longitude || null);

    if (['BREAKDOWN','BUS_CANCELLED','ACCIDENT'].includes(reportType)) {
      const newStatus = reportType === 'BUS_CANCELLED' ? 'CANCELLED' : 'BREAKDOWN';
      db.prepare("UPDATE buses SET status = ?, updated_at = datetime('now') WHERE id = ?").run(newStatus, bus.id);
    }

    const report = db.prepare('SELECT * FROM driver_reports WHERE id = ?').get(id);

    const io = req.app.get('io');
    if (io) {
      io.to('admin').emit('driver:report', {
        reportId: report.id, busId: bus.id, busNumber: bus.bus_number,
        driverName: req.user.name, reportType, message, latitude, longitude,
        timestamp: report.timestamp,
      });
    }

    const notifId = uuidv4();
    db.prepare(
      `INSERT INTO notifications (id, role, type, title, message, data)
       VALUES (?,?,?,?,?,?)`
    ).run(
      notifId, 'ADMIN', 'DRIVER_REPORT',
      `⚠ ${bus.bus_number} — ${reportType}`,
      `Driver ${req.user.name} reported: ${reportType}${message ? '. ' + message : ''}`,
      JSON.stringify({ busId: bus.id, reportId: id })
    );

    res.status(201).json({ message: 'Report submitted', report });
  } catch (err) {
    console.error('Submit report error:', err);
    res.status(500).json({ error: 'Failed to submit report' });
  }
};

// POST /api/driver/parcel/:bookingId/load
const loadParcel = async (req, res) => {
  try {
    const { actualWeightKg, notes } = req.body;

    const txn = db.transaction(() => {
      const booking = db.prepare(
        `SELECT bk.*, b.driver_id FROM bookings bk
         JOIN buses b ON bk.bus_id = b.id
         WHERE bk.id = ? AND bk.booking_type = 'CARGO'`
      ).get(req.params.bookingId);

      if (!booking) throw Object.assign(new Error('Cargo booking not found'), { status: 404 });
      if (booking.driver_id !== req.user.id)
        throw Object.assign(new Error('Not authorized'), { status: 403 });

      const lastHist = db.prepare(
        'SELECT new_status FROM parcel_status_history WHERE booking_id = ? ORDER BY timestamp DESC LIMIT 1'
      ).get(booking.id);
      const currentStatus = lastHist?.new_status || PARCEL_STATUS.BOOKED;
      const allowed = PARCEL_TRANSITIONS[currentStatus] || [];

      if (!allowed.includes(PARCEL_STATUS.LOADED))
        throw Object.assign(new Error(`Cannot transition from ${currentStatus} to LOADED`), { status: 400 });

      const actualKg      = parseFloat(actualWeightKg) || parseFloat(booking.weight_kg);
      const bookedKg      = parseFloat(booking.weight_kg);
      const weightMismatch = Math.abs(actualKg - bookedKg) > bookedKg * 0.1;

      db.prepare(
        `INSERT INTO parcel_status_history (id, booking_id, old_status, new_status, updated_by, actual_weight_kg, notes)
         VALUES (?,?,?,?,?,?,?)`
      ).run(uuidv4(), booking.id, currentStatus, PARCEL_STATUS.LOADED, req.user.id, actualKg, notes || null);

      db.prepare(
        "UPDATE buses SET loaded_cargo_kg = loaded_cargo_kg + ?, updated_at = datetime('now') WHERE id = ?"
      ).run(actualKg, booking.bus_id);

      return { actualKg, bookedKg, weightMismatch, parcelId: booking.parcel_id };
    });

    const result = txn();

    // ═══ RESILIENCE: Journal parcel load ═══
    try {
      const systemState = healthMonitor.getState();
      const eventId = `parcel_${req.params.bookingId}`;
      const journalPayload = {
        parcelData: {
          booking_id: req.params.bookingId,
          actual_weight: result.actualKg,
          status: PARCEL_STATUS.LOADED
        }
      };

      if (systemState === 'OFFLINE') {
        recoveryQueue.enqueue('parcel_create', journalPayload, eventId);
      } else {
        operationJournal.log('parcel_create', journalPayload, eventId);
      }
    } catch (resilErr) {
      console.error('[Resilience] Parcel journal error:', resilErr.message);
    }
    // ═══ END RESILIENCE ═══

    res.json({
      message: 'Parcel marked as loaded',
      ...result,
      mismatchWarning: result.weightMismatch
        ? `⚠ WEIGHT MISMATCH: Booked ${result.bookedKg}kg, Actual ${result.actualKg}kg` : null,
    });
  } catch (err) {
    console.error('Load parcel error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to load parcel' });
  }
};

// GET /api/driver/reports
const getReports = async (req, res) => {
  try {
    const bus = db.prepare('SELECT id FROM buses WHERE driver_id = ? AND is_active = 1 LIMIT 1').get(req.user.id);
    if (!bus) return res.status(404).json({ error: 'No bus assigned' });
    const reports = db.prepare(
      `SELECT dr.*, u.name as driver_name FROM driver_reports dr
       JOIN users u ON dr.driver_id = u.id
       WHERE dr.bus_id = ? ORDER BY dr.timestamp DESC LIMIT 20`
    ).all(bus.id);
    res.json({ reports });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
};

module.exports = { getMyBus, getDriverBookings, updateOccupancy, submitReport, loadParcel, getReports };
