-- Challenge #2: Passenger Information Reports
-- Appends to existing SmartYatra schema. Does NOT alter existing tables.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS information_reports (
  id                  TEXT PRIMARY KEY,
  passenger_id        TEXT NOT NULL REFERENCES users(id),
  bus_id              TEXT REFERENCES buses(id),
  route_id            TEXT REFERENCES routes(id),
  report_type         TEXT NOT NULL CHECK(report_type IN (
                        'BUS_CANCELLATION','BUS_DELAY','BUS_BREAKDOWN',
                        'ROUTE_CLOSED','ROUTE_DIVERSION',
                        'INCORRECT_BUS_INFO','INCORRECT_CAPACITY_INFO','OTHER'
                      )),
  message             TEXT NOT NULL,
  source              TEXT NOT NULL DEFAULT 'PASSENGER',

  -- Auto-attached system context at time of report
  bus_status_at_report    TEXT,
  gps_status_at_report    TEXT,
  bus_lat_at_report       REAL,
  bus_lng_at_report       REAL,
  booking_id_at_report    TEXT REFERENCES bookings(id),

  -- Verification lifecycle
  status              TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION'
                      CHECK(status IN ('PENDING_VERIFICATION','VERIFIED','FALSE_CLAIM','UNVERIFIED')),
  verification_result TEXT CHECK(verification_result IN ('VERIFIED','FALSE_CLAIM','UNVERIFIED')),
  verification_reason TEXT,
  verified_at         TEXT,
  verified_by         TEXT REFERENCES users(id),

  -- Evidence snapshot (JSON string, stored at verification time)
  evidence_snapshot   TEXT,

  created_at          TEXT DEFAULT (datetime('now'))
);

-- Index for fast admin queries
CREATE INDEX IF NOT EXISTS idx_info_reports_status    ON information_reports(status);
CREATE INDEX IF NOT EXISTS idx_info_reports_bus       ON information_reports(bus_id);
CREATE INDEX IF NOT EXISTS idx_info_reports_passenger ON information_reports(passenger_id);
CREATE INDEX IF NOT EXISTS idx_info_reports_created   ON information_reports(created_at DESC);
