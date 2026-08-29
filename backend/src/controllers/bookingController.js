const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const { db } = require('../config/db');
const { BOOKING_TYPE, PARCEL_STATUS, PAYMENT_STATUS, URGENCY, FARE, AVG_SPEED_KMH } = require('../config/constants');

// Resilience system
const operationJournal = require('../resilience/operationJournal');
const healthMonitor = require('../resilience/healthMonitor');
const recoveryQueue = require('../resilience/recoveryQueue');

const generateParcelId = (origin) => {
  const prefix = (origin || 'GEN').substring(0, 3).toUpperCase();
  const count = db.prepare("SELECT COUNT(*) as c FROM bookings WHERE booking_type = 'CARGO'").get().c + 1;
  return `SY-${prefix}-${String(count).padStart(4, '0')}`;
};

const calcFare = ({ bookingType, seats, weightKg, distanceKm, urgency }) => {
  if (bookingType === BOOKING_TYPE.PASSENGER)
    return Math.round(FARE.BASE + (distanceKm || 50) * FARE.DISTANCE_RATE) * (seats || 1);
  const mul = urgency === URGENCY.HIGH ? 1 + FARE.HIGH_SURCHARGE :
              urgency === URGENCY.MEDIUM ? 1 + FARE.MEDIUM_SURCHARGE : 1;
  return Math.round((FARE.BASE + (weightKg || 0) * FARE.PER_KG + (distanceKm || 50) * FARE.DISTANCE_RATE) * mul);
};

// POST /api/bookings
const createBooking = async (req, res) => {
  try {
    const {
      busId, bookingType, fromStop, toStop, fromStopId, toStopId,
      seats, goodsType, weightKg, urgency, specialInstructions,
    } = req.body;

    if (!busId || !bookingType || !fromStop || !toStop)
      return res.status(400).json({ error: 'busId, bookingType, fromStop, toStop required' });

    // Use SQLite's immediate transaction for atomic capacity reservation
    const txn = db.transaction(() => {
      const bus = db.prepare(
        `SELECT b.*, r.distance_km FROM buses b
         LEFT JOIN routes r ON b.route_id = r.id
         WHERE b.id = ? AND b.is_active = 1`
      ).get(busId);

      if (!bus) throw Object.assign(new Error('Bus not found'), { status: 404 });
      if (['CANCELLED','COMPLETED'].includes(bus.status))
        throw Object.assign(new Error('Bus not available for booking'), { status: 400 });

      let parcelId = null, qrData = null;
      const distKm = parseFloat(bus.distance_km) || 50;

      if (bookingType === BOOKING_TYPE.PASSENGER) {
        const numSeats  = parseInt(seats) || 1;
        const available = bus.seat_capacity - bus.current_occupancy;
        if (numSeats > available)
          throw Object.assign(new Error(`Only ${available} seat(s) available. Requested ${numSeats}.`), { status: 409 });

        db.prepare('UPDATE buses SET current_occupancy = current_occupancy + ? WHERE id = ?')
          .run(numSeats, busId);

      } else if (bookingType === BOOKING_TYPE.CARGO) {
        const wkg = parseFloat(weightKg) || 0;
        if (wkg <= 0) throw Object.assign(new Error('weightKg must be > 0'), { status: 400 });

        const avail = parseFloat(bus.cargo_capacity_kg) - parseFloat(bus.booked_cargo_kg);
        if (wkg > avail)
          throw Object.assign(new Error(`Insufficient cargo. Available: ${avail.toFixed(1)} kg, Requested: ${wkg} kg`), { status: 409 });

        db.prepare('UPDATE buses SET booked_cargo_kg = booked_cargo_kg + ? WHERE id = ?').run(wkg, busId);
        parcelId = generateParcelId(fromStop);
        qrData   = JSON.stringify({ parcelId, busNumber: bus.bus_number, from: fromStop, to: toStop,
                                     goods: goodsType, weight: wkg });
      } else {
        throw Object.assign(new Error('Invalid bookingType'), { status: 400 });
      }

      const estimatedCost = calcFare({ bookingType, seats: parseInt(seats)||1,
                                        weightKg: parseFloat(weightKg)||0, distanceKm: distKm, urgency });
      const bookingId = uuidv4();

      db.prepare(
        `INSERT INTO bookings
           (id, user_id, bus_id, booking_type, from_stop, to_stop, from_stop_id, to_stop_id,
            seats, goods_type, weight_kg, urgency, estimated_cost, payment_status,
            status, parcel_id, qr_data, special_instructions)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).run(
        bookingId, req.user.id, busId, bookingType, fromStop, toStop,
        fromStopId || null, toStopId || null,
        parseInt(seats) || 0, goodsType || null, parseFloat(weightKg) || 0,
        urgency || URGENCY.LOW, estimatedCost,
        PAYMENT_STATUS.COMPLETED, 'CONFIRMED', parcelId, qrData, specialInstructions || null
      );

      if (bookingType === BOOKING_TYPE.CARGO) {
        db.prepare(
          `INSERT INTO parcel_status_history (id, booking_id, old_status, new_status, updated_by)
           VALUES (?,?,NULL,?,?)`
        ).run(uuidv4(), bookingId, PARCEL_STATUS.BOOKED, req.user.id);
      }

      return db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
    });

    const booking = txn();

    // ═══ RESILIENCE: Journal booking creation ═══
    try {
      const systemState = healthMonitor.getState();
      const eventId = `booking_${booking.id}`;
      const journalPayload = {
        bookingData: {
          user_id: req.user.id,
          bus_id: busId,
          booking_type: bookingType,
          from_stop: fromStop,
          to_stop: toStop,
          from_stop_id: fromStopId,
          to_stop_id: toStopId,
          seats: parseInt(seats) || 0,
          goods_type: goodsType,
          weight_kg: parseFloat(weightKg) || 0,
          urgency: urgency,
          total_amount: estimatedCost,
          status: 'CONFIRMED'
        }
      };

      if (systemState === 'OFFLINE') {
        // Queue for later journaling
        recoveryQueue.enqueue('booking_create', journalPayload, eventId);
      } else {
        // Journal immediately
        operationJournal.log('booking_create', journalPayload, eventId);
      }
    } catch (resilErr) {
      // Never break existing flow
      console.error('[Resilience] Journal error:', resilErr.message);
    }
    // ═══ END RESILIENCE ═══

    // Generate QR
    let qrCodeDataUrl = null;
    if (booking.qr_data) {
      try { qrCodeDataUrl = await QRCode.toDataURL(booking.qr_data, { width: 200, margin: 2 }); } catch (_) {}
    }

    // Realtime
    const io = req.app.get('io');
    if (io) {
      io.to(`bus:${busId}`).emit('bus:occupancy', { busId });
      io.to('admin').emit('booking:created', { bookingId: booking.id, busId, bookingType });
    }

    res.status(201).json({ message: 'Booking confirmed', booking: { ...booking, qr_code: qrCodeDataUrl } });
  } catch (err) {
    console.error('Create booking error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Booking failed' });
  }
};

// GET /api/bookings/:id
const getBookingById = async (req, res) => {
  try {
    const booking = db.prepare(
      `SELECT bk.*, b.bus_number, r.name as route_name, r.origin, r.destination,
              u.name as user_name, u.mobile as user_mobile
       FROM bookings bk
       JOIN buses b  ON bk.bus_id  = b.id
       LEFT JOIN routes r ON b.route_id = r.id
       JOIN users u  ON bk.user_id = u.id
       WHERE bk.id = ?`
    ).get(req.params.id);

    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (req.user.role !== 'ADMIN' && req.user.role !== 'DRIVER' && booking.user_id !== req.user.id)
      return res.status(403).json({ error: 'Access denied' });

    const history = db.prepare(
      `SELECT psh.*, u.name as updated_by_name FROM parcel_status_history psh
       LEFT JOIN users u ON psh.updated_by = u.id
       WHERE psh.booking_id = ? ORDER BY psh.timestamp`
    ).all(booking.id);

    let qrCodeDataUrl = null;
    if (booking.qr_data) {
      try { qrCodeDataUrl = await QRCode.toDataURL(booking.qr_data, { width: 200, margin: 2 }); } catch (_) {}
    }

    res.json({ booking: { ...booking, qr_code: qrCodeDataUrl, history } });
  } catch (err) {
    console.error('Get booking error:', err);
    res.status(500).json({ error: 'Failed to get booking' });
  }
};

// GET /api/bookings/me
const getMyBookings = async (req, res) => {
  try {
    const bookings = db.prepare(
      `SELECT bk.id, bk.booking_type, bk.from_stop, bk.to_stop, bk.seats,
              bk.goods_type, bk.weight_kg, bk.urgency, bk.estimated_cost,
              bk.status, bk.payment_status, bk.parcel_id, bk.created_at, bk.bus_id,
              b.bus_number, r.name as route_name, r.origin, r.destination,
              b.current_latitude, b.current_longitude, b.status as bus_status,
              b.gps_status, b.last_gps_update
       FROM bookings bk
       JOIN buses b ON bk.bus_id = b.id
       LEFT JOIN routes r ON b.route_id = r.id
       WHERE bk.user_id = ?
       ORDER BY bk.created_at DESC`
    ).all(req.user.id);
    res.json({ bookings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
};

// GET /api/bookings/parcel/:parcelId
const trackParcel = async (req, res) => {
  try {
    const booking = db.prepare(
      `SELECT bk.*, b.bus_number, b.current_latitude, b.current_longitude,
              b.gps_status, b.last_gps_update, b.status as bus_status,
              r.name as route_name, r.origin, r.destination,
              u.name as farmer_name
       FROM bookings bk
       JOIN buses b ON bk.bus_id = b.id
       LEFT JOIN routes r ON b.route_id = r.id
       JOIN users u ON bk.user_id = u.id
       WHERE bk.parcel_id = ?`
    ).get(req.params.parcelId);

    if (!booking) return res.status(404).json({ error: 'Parcel not found' });

    const history = db.prepare(
      `SELECT psh.*, u.name as updated_by_name FROM parcel_status_history psh
       LEFT JOIN users u ON psh.updated_by = u.id
       WHERE psh.booking_id = ? ORDER BY psh.timestamp`
    ).all(booking.id);

    let qrCodeDataUrl = null;
    if (booking.qr_data) {
      try { qrCodeDataUrl = await QRCode.toDataURL(booking.qr_data, { width: 200, margin: 2 }); } catch (_) {}
    }

    res.json({ booking: { ...booking, qr_code: qrCodeDataUrl, history } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to track parcel' });
  }
};

module.exports = { createBooking, getBookingById, getMyBookings, trackParcel };
