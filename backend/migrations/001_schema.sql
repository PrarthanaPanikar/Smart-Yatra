-- SmartYatra Database Schema
-- Requires PostgreSQL with PostGIS extension

-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- USERS
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  mobile VARCHAR(15) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN','FARMER','PASSENGER','DRIVER')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_mobile ON users(mobile);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- =====================================================
-- ROUTES
-- =====================================================
CREATE TABLE IF NOT EXISTS routes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  origin VARCHAR(100) NOT NULL,
  destination VARCHAR(100) NOT NULL,
  distance_km DECIMAL(8,2),
  estimated_duration_min INTEGER,
  geometry GEOMETRY(LINESTRING, 4326),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_routes_origin ON routes(origin);
CREATE INDEX IF NOT EXISTS idx_routes_destination ON routes(destination);

-- =====================================================
-- STOPS
-- =====================================================
CREATE TABLE IF NOT EXISTS stops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  sequence INTEGER NOT NULL,
  location GEOMETRY(POINT, 4326),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stops_route ON stops(route_id);
CREATE INDEX IF NOT EXISTS idx_stops_location ON stops USING GIST(location);

-- =====================================================
-- BUSES
-- =====================================================
CREATE TABLE IF NOT EXISTS buses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bus_number VARCHAR(20) UNIQUE NOT NULL,
  route_id UUID REFERENCES routes(id),
  driver_id UUID REFERENCES users(id),
  seat_capacity INTEGER NOT NULL DEFAULT 50,
  current_occupancy INTEGER NOT NULL DEFAULT 0,
  cargo_capacity_kg DECIMAL(8,2) NOT NULL DEFAULT 500,
  booked_cargo_kg DECIMAL(8,2) NOT NULL DEFAULT 0,
  loaded_cargo_kg DECIMAL(8,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED'
    CHECK (status IN ('SCHEDULED','IN_TRANSIT','AT_STOP','DELAYED','BREAKDOWN','CANCELLED','COMPLETED')),
  current_latitude DECIMAL(10,7),
  current_longitude DECIMAL(10,7),
  current_location GEOMETRY(POINT, 4326),
  gps_status VARCHAR(20) NOT NULL DEFAULT 'OFFLINE'
    CHECK (gps_status IN ('CONNECTED','STALE','OFFLINE','SIMULATION')),
  gps_accuracy DECIMAL(8,2),
  gps_speed DECIMAL(8,2),
  gps_heading DECIMAL(8,2),
  last_gps_update TIMESTAMPTZ,
  departure_time TIME,
  arrival_time TIME,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buses_route ON buses(route_id);
CREATE INDEX IF NOT EXISTS idx_buses_driver ON buses(driver_id);
CREATE INDEX IF NOT EXISTS idx_buses_status ON buses(status);
CREATE INDEX IF NOT EXISTS idx_buses_location ON buses USING GIST(current_location);

-- =====================================================
-- GPS TELEMETRY
-- =====================================================
CREATE TABLE IF NOT EXISTS gps_telemetry (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bus_id UUID NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  accuracy DECIMAL(8,2),
  speed DECIMAL(8,2),
  heading DECIMAL(8,2),
  gps_source VARCHAR(20) DEFAULT 'DEVICE' CHECK (gps_source IN ('DEVICE','SIMULATION')),
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_bus ON gps_telemetry(bus_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_time ON gps_telemetry(timestamp DESC);

-- =====================================================
-- BOOKINGS
-- =====================================================
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  bus_id UUID NOT NULL REFERENCES buses(id),
  booking_type VARCHAR(20) NOT NULL CHECK (booking_type IN ('PASSENGER','CARGO')),
  from_stop VARCHAR(100) NOT NULL,
  to_stop VARCHAR(100) NOT NULL,
  from_stop_id UUID REFERENCES stops(id),
  to_stop_id UUID REFERENCES stops(id),
  seats INTEGER DEFAULT 0,
  goods_type VARCHAR(50),
  weight_kg DECIMAL(8,2) DEFAULT 0,
  urgency VARCHAR(10) DEFAULT 'LOW' CHECK (urgency IN ('LOW','MEDIUM','HIGH')),
  estimated_cost DECIMAL(10,2),
  payment_status VARCHAR(20) DEFAULT 'PENDING'
    CHECK (payment_status IN ('PENDING','COMPLETED','FAILED','REFUNDED')),
  status VARCHAR(20) DEFAULT 'CONFIRMED'
    CHECK (status IN ('PENDING','CONFIRMED','CANCELLED','COMPLETED')),
  parcel_id VARCHAR(30) UNIQUE,
  qr_data TEXT,
  special_instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_bus ON bookings(bus_id);
CREATE INDEX IF NOT EXISTS idx_bookings_type ON bookings(booking_type);
CREATE INDEX IF NOT EXISTS idx_bookings_parcel ON bookings(parcel_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- =====================================================
-- PARCEL STATUS HISTORY
-- =====================================================
CREATE TABLE IF NOT EXISTS parcel_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  old_status VARCHAR(30),
  new_status VARCHAR(30) NOT NULL,
  updated_by UUID REFERENCES users(id),
  actual_weight_kg DECIMAL(8,2),
  notes TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parcel_history_booking ON parcel_status_history(booking_id);

-- =====================================================
-- DRIVER REPORTS
-- =====================================================
CREATE TABLE IF NOT EXISTS driver_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL REFERENCES users(id),
  bus_id UUID NOT NULL REFERENCES buses(id),
  report_type VARCHAR(30) NOT NULL,
  message TEXT,
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACKNOWLEDGED','RESOLVED')),
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_driver ON driver_reports(driver_id);
CREATE INDEX IF NOT EXISTS idx_reports_bus ON driver_reports(bus_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON driver_reports(status);

-- =====================================================
-- NOTIFICATIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20),
  type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_role ON notifications(role);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);

-- =====================================================
-- TRIGGER: auto-update updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_buses_updated_at ON buses;
CREATE TRIGGER update_buses_updated_at BEFORE UPDATE ON buses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bookings_updated_at ON bookings;
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
