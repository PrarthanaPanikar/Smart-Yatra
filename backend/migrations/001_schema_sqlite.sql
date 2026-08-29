-- SmartYatra SQLite Schema
-- SQLite does not require PostGIS; lat/lng stored as REAL.

PRAGMA foreign_keys = ON;

-- ── Users ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  mobile       TEXT UNIQUE NOT NULL,
  email        TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role         TEXT NOT NULL CHECK(role IN ('ADMIN','FARMER','PASSENGER','DRIVER')),
  is_active    INTEGER DEFAULT 1,
  created_at   TEXT DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now'))
);

-- ── Routes ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS routes (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  origin                TEXT NOT NULL,
  destination           TEXT NOT NULL,
  distance_km           REAL,
  estimated_duration_min INTEGER,
  is_active             INTEGER DEFAULT 1,
  created_at            TEXT DEFAULT (datetime('now'))
);

-- ── Stops ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stops (
  id         TEXT PRIMARY KEY,
  route_id   TEXT REFERENCES routes(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  latitude   REAL NOT NULL,
  longitude  REAL NOT NULL,
  sequence   INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ── Buses ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS buses (
  id                  TEXT PRIMARY KEY,
  bus_number          TEXT UNIQUE NOT NULL,
  route_id            TEXT REFERENCES routes(id),
  driver_id           TEXT REFERENCES users(id),
  seat_capacity       INTEGER NOT NULL DEFAULT 50,
  current_occupancy   INTEGER NOT NULL DEFAULT 0,
  cargo_capacity_kg   REAL NOT NULL DEFAULT 500,
  booked_cargo_kg     REAL NOT NULL DEFAULT 0,
  loaded_cargo_kg     REAL NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'SCHEDULED'
                      CHECK(status IN ('SCHEDULED','IN_TRANSIT','AT_STOP','DELAYED','BREAKDOWN','CANCELLED','COMPLETED')),
  current_latitude    REAL,
  current_longitude   REAL,
  gps_status          TEXT NOT NULL DEFAULT 'OFFLINE'
                      CHECK(gps_status IN ('CONNECTED','STALE','OFFLINE','SIMULATION')),
  gps_accuracy        REAL,
  gps_speed           REAL,
  gps_heading         REAL,
  last_gps_update     TEXT,
  departure_time      TEXT,
  arrival_time        TEXT,
  is_active           INTEGER DEFAULT 1,
  created_at          TEXT DEFAULT (datetime('now')),
  updated_at          TEXT DEFAULT (datetime('now'))
);

-- ── GPS Telemetry ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gps_telemetry (
  id         TEXT PRIMARY KEY,
  bus_id     TEXT NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
  latitude   REAL NOT NULL,
  longitude  REAL NOT NULL,
  accuracy   REAL,
  speed      REAL,
  heading    REAL,
  gps_source TEXT DEFAULT 'DEVICE' CHECK(gps_source IN ('DEVICE','SIMULATION')),
  timestamp  TEXT DEFAULT (datetime('now'))
);

-- ── Bookings ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id                   TEXT PRIMARY KEY,
  user_id              TEXT NOT NULL REFERENCES users(id),
  bus_id               TEXT NOT NULL REFERENCES buses(id),
  booking_type         TEXT NOT NULL CHECK(booking_type IN ('PASSENGER','CARGO')),
  from_stop            TEXT NOT NULL,
  to_stop              TEXT NOT NULL,
  from_stop_id         TEXT REFERENCES stops(id),
  to_stop_id           TEXT REFERENCES stops(id),
  seats                INTEGER DEFAULT 0,
  goods_type           TEXT,
  weight_kg            REAL DEFAULT 0,
  urgency              TEXT DEFAULT 'LOW' CHECK(urgency IN ('LOW','MEDIUM','HIGH')),
  estimated_cost       REAL,
  payment_status       TEXT DEFAULT 'PENDING' CHECK(payment_status IN ('PENDING','COMPLETED','FAILED','REFUNDED')),
  status               TEXT DEFAULT 'CONFIRMED' CHECK(status IN ('PENDING','CONFIRMED','CANCELLED','COMPLETED')),
  parcel_id            TEXT UNIQUE,
  qr_data              TEXT,
  special_instructions TEXT,
  created_at           TEXT DEFAULT (datetime('now')),
  updated_at           TEXT DEFAULT (datetime('now'))
);

-- ── Parcel Status History ──────────────────────────────────
CREATE TABLE IF NOT EXISTS parcel_status_history (
  id              TEXT PRIMARY KEY,
  booking_id      TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  old_status      TEXT,
  new_status      TEXT NOT NULL,
  updated_by      TEXT REFERENCES users(id),
  actual_weight_kg REAL,
  notes           TEXT,
  timestamp       TEXT DEFAULT (datetime('now'))
);

-- ── Driver Reports ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_reports (
  id               TEXT PRIMARY KEY,
  driver_id        TEXT NOT NULL REFERENCES users(id),
  bus_id           TEXT NOT NULL REFERENCES buses(id),
  report_type      TEXT NOT NULL,
  message          TEXT,
  latitude         REAL,
  longitude        REAL,
  status           TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING','ACKNOWLEDGED','RESOLVED')),
  acknowledged_by  TEXT REFERENCES users(id),
  acknowledged_at  TEXT,
  timestamp        TEXT DEFAULT (datetime('now'))
);

-- ── Notifications ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  data       TEXT,
  is_read    INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
