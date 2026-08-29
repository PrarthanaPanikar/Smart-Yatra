const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const { db } = require('../config/db');
const { PARCEL_STATUS, PARCEL_TRANSITIONS } = require('../config/constants');

// GET /api/parcels/:parcelId
const getParcel = async (req, res) => {
  try {
    const booking = db.prepare(
      `SELECT bk.*, b.bus_number, b.current_latitude, b.current_longitude,
              b.gps_status, b.last_gps_update, b.status as bus_status,
              r.name as route_name, r.origin, r.destination,
              u.name as farmer_name, u.mobile as farmer_mobile
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
      try { qrCodeDataUrl = await QRCode.toDataURL(booking.qr_data, { width: 256, margin: 2 }); } catch (_) {}
    }

    res.json({ parcel: { ...booking, qr_code: qrCodeDataUrl, history } });
  } catch (err) {
    console.error('Get parcel error:', err);
    res.status(500).json({ error: 'Failed to get parcel' });
  }
};

// PUT /api/parcels/:bookingId/status
const updateParcelStatus = async (req, res) => {
  try {
    const { newStatus, actualWeightKg, notes } = req.body;

    const txn = db.transaction(() => {
      const booking = db.prepare(
        `SELECT bk.*, b.driver_id FROM bookings bk
         JOIN buses b ON bk.bus_id = b.id
         WHERE bk.id = ? AND bk.booking_type = 'CARGO'`
      ).get(req.params.bookingId);

      if (!booking) throw Object.assign(new Error('Cargo booking not found'), { status: 404 });
      if (req.user.role === 'DRIVER' && booking.driver_id !== req.user.id)
        throw Object.assign(new Error('Not authorized'), { status: 403 });

      const lastHist = db.prepare(
        'SELECT new_status FROM parcel_status_history WHERE booking_id = ? ORDER BY timestamp DESC LIMIT 1'
      ).get(booking.id);
      const currentStatus = lastHist?.new_status || PARCEL_STATUS.BOOKED;
      const allowed = PARCEL_TRANSITIONS[currentStatus] || [];

      if (!allowed.includes(newStatus))
        throw Object.assign(
          new Error(`Invalid transition: ${currentStatus} → ${newStatus}. Allowed: ${allowed.join(', ') || 'none'}`),
          { status: 400 }
        );

      db.prepare(
        `INSERT INTO parcel_status_history (id, booking_id, old_status, new_status, updated_by, actual_weight_kg, notes)
         VALUES (?,?,?,?,?,?,?)`
      ).run(uuidv4(), booking.id, currentStatus, newStatus, req.user.id, actualWeightKg || null, notes || null);

      if (newStatus === PARCEL_STATUS.DELIVERED) {
        const actualKg = parseFloat(actualWeightKg || booking.weight_kg);
        db.prepare(`
          UPDATE buses SET
            booked_cargo_kg = MAX(0, booked_cargo_kg - ?),
            loaded_cargo_kg = MAX(0, loaded_cargo_kg - ?),
            updated_at = datetime('now')
          WHERE id = ?`
        ).run(actualKg, actualKg, booking.bus_id);
        db.prepare("UPDATE bookings SET status='COMPLETED', updated_at=datetime('now') WHERE id = ?").run(booking.id);
      }

      if (newStatus === PARCEL_STATUS.IN_TRANSIT) {
        db.prepare("UPDATE buses SET status='IN_TRANSIT', updated_at=datetime('now') WHERE id = ?").run(booking.bus_id);
      }

      return { parcelId: booking.parcel_id, currentStatus, newStatus };
    });

    const result = txn();

    const io = req.app.get('io');
    if (io) {
      io.to(`booking:${req.params.bookingId}`).emit('parcel:status', {
        bookingId: req.params.bookingId,
        ...result,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({ message: `Parcel status updated to ${newStatus}`, ...result });
  } catch (err) {
    console.error('Update parcel status error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to update parcel status' });
  }
};

module.exports = { getParcel, updateParcelStatus };
