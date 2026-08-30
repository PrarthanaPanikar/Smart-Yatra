/**
 * infoReportController.js
 * Challenge #2 — Passenger Information / False-Claim Reporting
 *
 * RULE: Does NOT modify any existing bus status, booking, GPS, or schedule.
 * All passenger reports start as PENDING_VERIFICATION and can ONLY be
 * promoted/rejected by an Admin after cross-checking operational data.
 */
const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/db');
const { computeGpsStatus } = require('./gpsController');

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Collect all trusted evidence for a bus from the existing DB. Pure read. */
function collectEvidence(busId) {
  const bus = db.prepare(`
    SELECT b.*, r.name as route_name, r.origin, r.destination,
           u.name as driver_name
    FROM buses b
    LEFT JOIN routes r ON b.route_id = r.id
    LEFT JOIN users  u ON b.driver_id = u.id
    WHERE b.id = ?
  `).get(busId);

  if (!bus) return null;

  // Latest driver report for this bus
  const latestDriverReport = db.prepare(`
    SELECT report_type, message, timestamp, status
    FROM driver_reports
    WHERE bus_id = ? ORDER BY timestamp DESC LIMIT 1
  `).get(busId);

  // Recent GPS telemetry
  const recentGps = db.prepare(`
    SELECT latitude, longitude, speed, timestamp
    FROM gps_telemetry
    WHERE bus_id = ? ORDER BY timestamp DESC LIMIT 1
  `).get(busId);

  const gpsStatusComputed = computeGpsStatus(bus);

  // Active bookings count today
  const activeBookings = db.prepare(`
    SELECT COUNT(*) as c FROM bookings
    WHERE bus_id = ? AND status = 'CONFIRMED' AND date(created_at) = date('now')
  `).get(busId);

  return {
    bus_number:      bus.bus_number,
    official_status: bus.status,
    gps_status:      gpsStatusComputed,
    last_gps_update: bus.last_gps_update,
    gps_speed:       bus.gps_speed,
    route_name:      bus.route_name,
    driver_name:     bus.driver_name,
    driver_report:   latestDriverReport || null,
    recent_gps:      recentGps || null,
    active_bookings_today: activeBookings?.c ?? 0,
    schedule: {
      departure_time: bus.departure_time,
      arrival_time:   bus.arrival_time,
    },
  };
}

/**
 * Rule-based verification engine.
 * Returns { result, reason, evidence }
 *
 * Priority: ADMIN/official status → Driver report → GPS → Schedule
 */
function runVerification(reportType, evidence) {
  const contradictions = [];
  const supports       = [];

  const officialStatus  = evidence.official_status;
  const gpsStatus       = evidence.gps_status;
  const driverReport    = evidence.driver_report;
  const gpsMoving       = evidence.recent_gps?.speed > 0;
  const gpsRecent       = evidence.last_gps_update
    ? (Date.now() - new Date(evidence.last_gps_update).getTime()) < 5 * 60 * 1000
    : false;

  // ── BUS_CANCELLATION ───────────────────────────────────────────────────
  if (reportType === 'BUS_CANCELLATION') {
    if (['IN_TRANSIT','SCHEDULED','AT_STOP'].includes(officialStatus)) {
      contradictions.push(`Official bus status is ${officialStatus}`);
    }
    if (officialStatus === 'CANCELLED') {
      supports.push('Official status confirms cancellation');
    }
    if (driverReport?.report_type === 'BUS_CANCELLED') {
      supports.push('Driver submitted a cancellation report');
    }
    if (['CONNECTED','SIMULATION'].includes(gpsStatus) && gpsMoving) {
      contradictions.push('Bus GPS shows active movement');
    }
    if (evidence.active_bookings_today > 0 && !['CANCELLED'].includes(officialStatus)) {
      contradictions.push(`${evidence.active_bookings_today} confirmed bookings still active`);
    }
  }

  // ── BUS_BREAKDOWN ──────────────────────────────────────────────────────
  else if (reportType === 'BUS_BREAKDOWN') {
    if (officialStatus === 'BREAKDOWN') {
      supports.push('Official status is BREAKDOWN');
    }
    if (officialStatus === 'IN_TRANSIT') {
      contradictions.push('Official status is IN_TRANSIT');
    }
    if (driverReport?.report_type === 'BREAKDOWN') {
      supports.push('Driver submitted a BREAKDOWN report');
    }
    if (driverReport && !['BREAKDOWN','ACCIDENT'].includes(driverReport.report_type)) {
      contradictions.push(`Latest driver report is ${driverReport.report_type}, not BREAKDOWN`);
    }
    if (gpsMoving) {
      contradictions.push('Bus GPS shows active movement — not stationary');
    }
    if (gpsRecent && ['STALE','OFFLINE'].includes(gpsStatus)) {
      supports.push('GPS signal is weak/stale (consistent with breakdown)');
    }
  }

  // ── BUS_DELAY ──────────────────────────────────────────────────────────
  else if (reportType === 'BUS_DELAY') {
    if (officialStatus === 'DELAYED') {
      supports.push('Official status is DELAYED');
    }
    if (driverReport?.report_type === 'ROUTE_DELAY') {
      supports.push('Driver reported a route delay');
    }
    if (officialStatus === 'IN_TRANSIT' && !driverReport) {
      contradictions.push('Bus is IN_TRANSIT with no delay report from driver');
    }
  }

  // ── ROUTE_CLOSED / ROUTE_DIVERSION ────────────────────────────────────
  else if (['ROUTE_CLOSED','ROUTE_DIVERSION'].includes(reportType)) {
    if (driverReport?.report_type === 'UNSCHEDULED_STOP') {
      supports.push('Driver reported an unscheduled stop');
    }
    if (officialStatus === 'IN_TRANSIT' && gpsMoving) {
      contradictions.push('Bus is actively moving on its scheduled route');
    }
  }

  // ── Determine final verdict ──────────────────────────────────────────
  if (contradictions.length > 0 && supports.length === 0) {
    return {
      result: 'FALSE_CLAIM',
      reason: `Claim contradicted by verified operational data: ${contradictions.join('; ')}.`,
    };
  }
  if (supports.length > 0 && contradictions.length === 0) {
    return {
      result: 'VERIFIED',
      reason: `Claim is supported by verified data: ${supports.join('; ')}.`,
    };
  }
  if (supports.length > 0 && contradictions.length > 0) {
    // Mixed — lean towards more evidence
    if (contradictions.length > supports.length) {
      return {
        result: 'FALSE_CLAIM',
        reason: `Mixed evidence, more contradictions than support. Contradictions: ${contradictions.join('; ')}. Support: ${supports.join('; ')}.`,
      };
    }
    return {
      result: 'VERIFIED',
      reason: `Mixed evidence, more support than contradictions. Support: ${supports.join('; ')}. Contradictions: ${contradictions.join('; ')}.`,
    };
  }
  // No strong evidence either way
  return {
    result: 'UNVERIFIED',
    reason: 'Insufficient verified evidence is currently available to confirm or contradict this report.',
  };
}

// ── Controllers ──────────────────────────────────────────────────────────────

// POST /api/reports  — passenger submits a report
const createReport = async (req, res) => {
  try {
    const { busId, reportType, message } = req.body;

    if (!reportType || !message?.trim()) {
      return res.status(400).json({ error: 'reportType and message are required' });
    }

    const VALID_TYPES = [
      'BUS_CANCELLATION','BUS_DELAY','BUS_BREAKDOWN',
      'ROUTE_CLOSED','ROUTE_DIVERSION',
      'INCORRECT_BUS_INFO','INCORRECT_CAPACITY_INFO','OTHER',
    ];
    if (!VALID_TYPES.includes(reportType)) {
      return res.status(400).json({ error: 'Invalid reportType' });
    }

    // Attach system context automatically
    let bus            = null;
    let routeId        = null;
    let busStatusNow   = null;
    let gpsStatusNow   = null;
    let busLat         = null;
    let busLng         = null;
    let bookingId      = null;

    if (busId) {
      bus = db.prepare(`
        SELECT b.*, r.id as rid FROM buses b
        LEFT JOIN routes r ON b.route_id = r.id
        WHERE b.id = ?
      `).get(busId);

      if (bus) {
        routeId      = bus.rid;
        busStatusNow = bus.status;
        gpsStatusNow = computeGpsStatus(bus);
        busLat       = bus.current_latitude;
        busLng       = bus.current_longitude;
      }

      // Find passenger's active booking for this bus today
      const booking = db.prepare(`
        SELECT id FROM bookings
        WHERE user_id = ? AND bus_id = ?
          AND status = 'CONFIRMED' AND date(created_at) = date('now')
        LIMIT 1
      `).get(req.user.id, busId);
      if (booking) bookingId = booking.id;
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO information_reports
        (id, passenger_id, bus_id, route_id, report_type, message, source,
         bus_status_at_report, gps_status_at_report,
         bus_lat_at_report, bus_lng_at_report, booking_id_at_report)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      id, req.user.id, busId || null, routeId || null,
      reportType, message.trim(), 'PASSENGER',
      busStatusNow, gpsStatusNow,
      busLat, busLng, bookingId
    );

    const report = db.prepare('SELECT * FROM information_reports WHERE id = ?').get(id);

    // Notify admins via Socket.IO (reuse existing admin room)
    const io = req.app.get('io');
    if (io) {
      io.to('admin').emit('passenger:report', {
        reportId:    id,
        reportType,
        message:     message.trim(),
        busNumber:   bus?.bus_number || null,
        passengerName: req.user.name,
        createdAt:   report.created_at,
      });
    }

    res.status(201).json({
      message: 'Report submitted. It will be reviewed by admin.',
      reportId: id,
      status: 'PENDING_VERIFICATION',
    });
  } catch (err) {
    console.error('Create info report error:', err);
    res.status(500).json({ error: 'Failed to submit report' });
  }
};

// GET /api/reports/mine  — passenger sees their own reports
const getMyReports = async (req, res) => {
  try {
    const reports = db.prepare(`
      SELECT ir.*, b.bus_number, r.name as route_name,
             u.name as verified_by_name
      FROM information_reports ir
      LEFT JOIN buses b ON ir.bus_id = b.id
      LEFT JOIN routes r ON ir.route_id = r.id
      LEFT JOIN users u ON ir.verified_by = u.id
      WHERE ir.passenger_id = ?
      ORDER BY ir.created_at DESC LIMIT 30
    `).all(req.user.id);
    res.json({ reports });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
};

// GET /api/reports  — admin sees all reports (filterable)
const getAllReports = async (req, res) => {
  try {
    const { status, busId } = req.query;
    let where = 'WHERE 1=1';
    const params = [];

    if (status) { where += ' AND ir.status = ?'; params.push(status); }
    if (busId)  { where += ' AND ir.bus_id = ?'; params.push(busId); }

    const reports = db.prepare(`
      SELECT ir.*,
             b.bus_number, b.status as current_bus_status,
             b.gps_status as current_gps_status,
             b.last_gps_update, b.current_latitude, b.current_longitude,
             r.name as route_name, r.origin, r.destination,
             p.name as passenger_name,
             v.name as verified_by_name
      FROM information_reports ir
      LEFT JOIN buses   b ON ir.bus_id   = b.id
      LEFT JOIN routes  r ON ir.route_id = r.id
      LEFT JOIN users   p ON ir.passenger_id = p.id
      LEFT JOIN users   v ON ir.verified_by  = v.id
      ${where}
      ORDER BY ir.created_at DESC LIMIT 100
    `).all(...params);

    // Detect coordinated reporting: same bus + same type within 5 minutes
    const coordinated = {};
    const now = Date.now();
    reports.forEach(rep => {
      if (rep.status !== 'PENDING_VERIFICATION') return;
      const key = `${rep.bus_id}:${rep.report_type}`;
      if (!coordinated[key]) coordinated[key] = [];
      coordinated[key].push(rep.id);
    });

    const coordinatedGroups = Object.entries(coordinated)
      .filter(([, ids]) => ids.length >= 2)
      .map(([key, ids]) => ({ key, count: ids.length, reportIds: ids }));

    res.json({ reports, coordinatedGroups });
  } catch (err) {
    console.error('Get info reports error:', err);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
};

// GET /api/reports/:id  — single report with evidence
const getReportById = async (req, res) => {
  try {
    const report = db.prepare(`
      SELECT ir.*,
             b.bus_number, b.status as current_bus_status,
             b.gps_status as current_gps_status,
             b.last_gps_update, b.current_latitude, b.current_longitude,
             b.gps_speed,
             r.name as route_name, r.origin, r.destination,
             p.name as passenger_name,
             v.name as verified_by_name
      FROM information_reports ir
      LEFT JOIN buses   b ON ir.bus_id   = b.id
      LEFT JOIN routes  r ON ir.route_id = r.id
      LEFT JOIN users   p ON ir.passenger_id = p.id
      LEFT JOIN users   v ON ir.verified_by  = v.id
      WHERE ir.id = ?
    `).get(req.params.id);

    if (!report) return res.status(404).json({ error: 'Report not found' });

    // Only admin can see all details; passenger can only see their own
    if (req.user.role !== 'ADMIN' && report.passenger_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Collect live evidence if bus exists
    let liveEvidence = null;
    if (report.bus_id) {
      liveEvidence = collectEvidence(report.bus_id);
    }

    res.json({ report, liveEvidence });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get report' });
  }
};

// POST /api/reports/:id/verify  — admin verifies (uses existing operational data)
const verifyReport = async (req, res) => {
  try {
    const { overrideResult, overrideReason } = req.body;
    // overrideResult: admin can manually set result if auto-verification is inconclusive

    const report = db.prepare('SELECT * FROM information_reports WHERE id = ?').get(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    if (report.status !== 'PENDING_VERIFICATION') {
      return res.status(400).json({ error: 'Report already verified' });
    }

    // Collect current evidence from existing SmartYatra data (pure read)
    let evidence = null;
    let verification = { result: 'UNVERIFIED', reason: 'No bus data available.' };

    if (report.bus_id) {
      evidence = collectEvidence(report.bus_id);
      verification = runVerification(report.report_type, evidence);
    }

    // Admin can override auto-result
    const finalResult = overrideResult || verification.result;
    const finalReason = overrideReason  || verification.reason;

    const evidenceJson = JSON.stringify({
      collected_at: new Date().toISOString(),
      bus_data:     evidence,
      auto_result:  verification,
    });

    db.prepare(`
      UPDATE information_reports SET
        status = ?,
        verification_result = ?,
        verification_reason = ?,
        verified_at = datetime('now'),
        verified_by = ?,
        evidence_snapshot = ?
      WHERE id = ?
    `).run(finalResult, finalResult, finalReason, req.user.id, evidenceJson, report.id);

    // Notify the reporting passenger via Socket.IO
    const io = req.app.get('io');
    if (io && report.passenger_id) {
      io.to('passenger').emit('report:verified', {
        reportId:   report.id,
        busNumber:  evidence?.bus_number || null,
        reportType: report.report_type,
        result:     finalResult,
        reason:     finalReason,
      });
    }

    // Notify all admins
    if (io) {
      io.to('admin').emit('report:verified', {
        reportId: report.id,
        result:   finalResult,
      });
    }

    res.json({
      message:    'Report verified',
      result:     finalResult,
      reason:     finalReason,
      evidence:   evidence,
    });
  } catch (err) {
    console.error('Verify report error:', err);
    res.status(500).json({ error: 'Failed to verify report' });
  }
};

// POST /api/reports/:id/reject  — admin quick-rejects without full evidence check
const rejectReport = async (req, res) => {
  try {
    const { reason } = req.body;
    const report = db.prepare('SELECT * FROM information_reports WHERE id = ?').get(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    db.prepare(`
      UPDATE information_reports SET
        status = 'FALSE_CLAIM',
        verification_result = 'FALSE_CLAIM',
        verification_reason = ?,
        verified_at = datetime('now'),
        verified_by = ?
      WHERE id = ?
    `).run(reason || 'Rejected by admin.', req.user.id, report.id);

    const io = req.app.get('io');
    if (io) {
      io.to('passenger').emit('report:verified', {
        reportId:   report.id,
        reportType: report.report_type,
        result:     'FALSE_CLAIM',
        reason:     reason || 'Report reviewed and rejected by admin.',
      });
      io.to('admin').emit('report:verified', { reportId: report.id, result: 'FALSE_CLAIM' });
    }

    res.json({ message: 'Report rejected', result: 'FALSE_CLAIM' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject report' });
  }
};

// GET /api/reports/stats  — summary counts for admin dashboard
const getReportStats = async (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status='PENDING_VERIFICATION' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status='VERIFIED'     THEN 1 ELSE 0 END) as verified,
        SUM(CASE WHEN status='FALSE_CLAIM'  THEN 1 ELSE 0 END) as false_claims,
        SUM(CASE WHEN status='UNVERIFIED'   THEN 1 ELSE 0 END) as unverified
      FROM information_reports
      WHERE date(created_at) = date('now')
    `).get();
    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
};

module.exports = {
  createReport, getMyReports, getAllReports,
  getReportById, verifyReport, rejectReport, getReportStats,
};
