# 🚌 SmartYatra
### Smart Public Transport + Farmer Cargo Sharing + Real-Time GPS Platform

> **Hackathon Prototype** — Uses existing public buses more efficiently by combining passenger transportation with available cargo capacity for farmers, while providing real-time GPS tracking, intelligent bus recommendations, capacity management, and parcel tracking.

---

## 📦 Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React 18 + Vite | Fast dev, component model |
| Styling | Tailwind CSS | Rapid responsive UI |
| Maps | Leaflet + OpenStreetMap | Free, no API key needed |
| Realtime | Socket.IO (client) | Low-latency bus location push |
| HTTP client | Axios | Interceptors for auth token |
| QR Codes | qrcode.react | Client-side QR generation |
| Backend | Node.js + Express | Same language, fast API |
| Realtime | Socket.IO (server) | GPS broadcast to all clients |
| Database | PostgreSQL + PostGIS | Relational + geospatial queries |
| Auth | JWT + bcryptjs | Stateless, role-based |

---

## 🏗 Project Structure

```
SmartYatra/
├── backend/
│   ├── migrations/
│   │   ├── 001_schema.sql     — Full DB schema
│   │   ├── run.js             — Migration runner
│   │   └── seed.js            — Demo data seeder
│   └── src/
│       ├── config/
│       │   ├── db.js          — PostgreSQL pool
│       │   └── constants.js   — App-wide enums/config
│       ├── controllers/       — Business logic
│       ├── middleware/        — auth.js, errorHandler.js
│       ├── routes/            — Express route files
│       ├── socket/            — Socket.IO handler + staleness checker
│       └── server.js          — Entry point
└── frontend/
    └── src/
        ├── components/
        │   ├── common/        — Navbar, StatusBadge, LoadingSpinner
        │   └── map/           — SmartMap, BusMarker, UserMarker, StopMarker
        ├── context/
        │   └── AuthContext.jsx
        ├── hooks/
        │   ├── useDeviceLocation.js  — Real device GPS
        │   └── useBusTracking.js     — Socket.IO bus subscriptions
        ├── pages/
        │   ├── admin/
        │   ├── driver/
        │   ├── farmer/
        │   └── passenger/
        ├── services/
        │   ├── api.js          — Axios with auth interceptor
        │   ├── gpsService.js   — PhoneGPSProvider + SimulationGPSProvider
        │   └── socketService.js
        └── App.jsx             — Router + protected routes
```

---

## 🚀 Setup Instructions

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ with PostGIS extension
- Git

### 1. Clone & enter project
```bash
cd "c:\Users\My Dell\OneDrive\Desktop\SmartYatra"
```

### 2. Database setup
```sql
-- In psql or pgAdmin:
CREATE DATABASE smartyatra;
-- Connect to smartyatra then:
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### 3. Backend setup
```bash
cd backend
# Edit .env — set your DB password
# DB_PASSWORD=your_actual_postgres_password

npm install
npm run migrate      # Creates all tables
npm run seed         # Inserts demo data
npm run dev          # Start dev server on port 5000
```

### 4. Frontend setup (new terminal)
```bash
cd frontend
npm install
npm run dev          # Start on http://localhost:5173
```

### 5. Open the app
Navigate to: **http://localhost:5173**

---

## 🔑 Environment Variables (backend/.env)

```env
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=smartyatra
DB_USER=postgres
DB_PASSWORD=postgres        # ← change this

JWT_SECRET=smartyatra_jwt_secret_change_in_production_2024
JWT_EXPIRES_IN=7d

FRONTEND_URL=http://localhost:5173

GPS_STALE_THRESHOLD_SECONDS=30
GPS_OFFLINE_THRESHOLD_SECONDS=120
GPS_UPDATE_INTERVAL_MS=3000

BASE_FARE=10
PRICE_PER_KG=2
DISTANCE_RATE=0.5
MEDIUM_URGENCY_SURCHARGE=0.15
HIGH_URGENCY_SURCHARGE=0.30
AVG_BUS_SPEED_KMH=40
```

---

## 🧑‍💻 Demo Accounts (password: `demo1234`)

| Role | Mobile | Name |
|------|--------|------|
| ADMIN | 9000000001 | Admin User |
| DRIVER | 9000000002 | Ramesh Patil (BUS-001, Kopargaon→Nashik) |
| DRIVER | 9000000003 | Suresh More (BUS-002, Kopargaon→Shirdi) |
| DRIVER | 9000000004 | Ganesh Shinde (BUS-003, Kopargaon→Manmad) |
| FARMER | 9000000005 | Manoj Jadhav |
| FARMER | 9000000006 | Sunita Bhoite |
| PASSENGER | 9000000007 | Priya Kulkarni |
| PASSENGER | 9000000008 | Amit Deshmukh |

---

## 📡 GPS Architecture

```
Driver Phone (browser)
    ↓
navigator.geolocation.watchPosition()   ← REAL device GPS
    ↓
PhoneGPSProvider (gpsService.js)
    ↓  throttled to every 3s
POST /api/gps/location
    ↓
Backend validates (driver owns that bus)
    ↓
Updates buses table (current_latitude, gps_status etc.)
Stores gps_telemetry row
    ↓
Socket.IO → io.to('bus:BUS-001').emit('bus:location', data)
         → io.to('admin').emit('bus:location', data)
    ↓
Admin Dashboard — bus marker moves
Farmer Dashboard — nearby bus location updates
Passenger Dashboard — tracked bus moves
```

### GPS Status Rules
| Status | Condition |
|--------|-----------|
| CONNECTED | Update received within 30s |
| STALE | No update for 30–120s |
| OFFLINE | No update for 120s+ |
| SIMULATION | SimulationGPSProvider active |

### GPS Provider Abstraction
- `PhoneGPSProvider` — PRIMARY. Uses `navigator.geolocation.watchPosition()`. Reads REAL device coordinates.
- `SimulationGPSProvider` — FALLBACK only. Clearly labelled "SIMULATION MODE" in UI. Never shown as live.

### HTTPS Note
> Browser Geolocation API requires HTTPS in production.
> `localhost` works for development without HTTPS.
> For hackathon demo on phone: connect phone and laptop to same WiFi, run backend accessible on LAN, serve frontend over HTTPS (use ngrok, or Vite's `--https` flag).

---

## 🔌 API Reference

### Auth
```
POST /api/auth/register    — Create account
POST /api/auth/login       — Login, returns JWT
GET  /api/auth/me          — Current user
```

### GPS
```
POST /api/gps/location         — Driver sends GPS (DRIVER only, must own bus)
GET  /api/gps/bus/:busId       — Current bus location
GET  /api/gps/history/:busId   — Recent telemetry
```

### Buses
```
GET  /api/buses                — All buses
GET  /api/buses/:id            — Single bus
GET  /api/buses/nearby         — ?lat=&lng=&radius=
GET  /api/buses/search         — ?origin=&destination=&weightKg=
GET  /api/buses/recommend      — Smart ranking for farmers
GET  /api/buses/routes         — All routes
GET  /api/buses/routes/:id/stops
```

### Bookings
```
POST /api/bookings             — Create booking (PASSENGER or CARGO)
GET  /api/bookings/me          — My bookings
GET  /api/bookings/:id         — Single booking
GET  /api/bookings/parcel/:id  — Track by parcel ID
```

### Driver
```
GET  /api/driver/bus                       — Assigned bus
GET  /api/driver/bookings                  — Today's bookings
POST /api/driver/occupancy                 — Update passenger count
POST /api/driver/report                    — Submit report
POST /api/driver/parcel/:id/load           — Mark cargo loaded
```

### Admin
```
GET  /api/admin/dashboard
GET  /api/admin/buses
POST /api/admin/buses
PUT  /api/admin/buses/:id
GET  /api/admin/reports
PUT  /api/admin/reports/:id/acknowledge
GET  /api/admin/users
GET  /api/admin/bookings
```

### Parcels
```
GET /api/parcels/:parcelId          — Track parcel
PUT /api/parcels/:bookingId/status  — Update parcel lifecycle
```

---

## 🔴 Realtime Events (Socket.IO)

| Event | Direction | Payload |
|-------|-----------|---------|
| `bus:location` | Server → Client | busId, lat, lng, speed, gpsStatus, timestamp |
| `bus:occupancy` | Server → Client | busId, currentOccupancy, availableSeats |
| `bus:status` | Server → Client | busId, status |
| `bus:gps-status` | Server → Client | busId, status |
| `booking:created` | Server → Admin | bookingId, busId, bookingType |
| `parcel:status` | Server → Client | bookingId, parcelId, newStatus |
| `driver:report` | Server → Admin | reportId, busId, reportType, etc. |
| `subscribe:bus` | Client → Server | busId |
| `subscribe:all-buses` | Client → Server | (admin only) |

---

## 🧭 5-Minute Hackathon Demo Script

### Setup (before demo)
1. Backend running on port 5000
2. Frontend running on port 5173
3. Database migrated and seeded

### Demo Flow

**[0:00] Admin View**
- Open `http://localhost:5173/login` on laptop
- Login: `9000000001 / demo1234` (Admin)
- Show fleet overview — 3 buses, GPS stats
- Show live map — buses at Kopargaon

**[0:45] Driver GPS (Core WOW)**
- On phone: open `http://localhost:5173/login`
- Login: `9000000002 / demo1234` (Driver — BUS-001)
- Tap `/driver/gps`
- Tap **START GPS** → browser asks location permission
- Tap **Allow** → real coordinates appear
- **Admin laptop immediately shows BUS-001 moving!**

**[1:30] Farmer Flow**
- New tab/device: Login as Farmer (`9000000005`)
- Location permission → shows nearby buses
- Book Cargo: Tomatoes, 40kg, Kopargaon→Nashik, HIGH urgency
- System recommends BUS-001 with score + reasons
- Book → Parcel ID generated (SY-KPG-0001)
- QR code shown
- Cargo capacity on BUS-001 decreases immediately

**[2:30] Passenger Flow**
- Login as Passenger (`9000000007`)
- Location → nearby buses shown on map
- Book 2 seats on BUS-002
- Ticket generated with QR
- Track bus — shows live GPS position

**[3:30] Driver — Cargo Verification**
- Driver login → `/driver/cargo`
- Find SY-KPG-0001
- Enter actual weight (42kg) → LOADED
- Weight mismatch warning shown (prototype note)

**[4:00] Admin Reports**
- Driver submits BREAKDOWN report
- Admin dashboard shows ⚠ alert in realtime
- Admin acknowledges → cleared

**[4:45] Wrap-up**
- Show GPS flowing: Phone → Backend → Socket.IO → 3 dashboards simultaneously
- Mention: single backend, single database, 4 connected roles
- Architecture diagram

---

## ⚠ Known Limitations (Hackathon Prototype)

1. **Payment** — Demo only (auto-completed). No real payment gateway.
2. **GPS on HTTP** — Works on `localhost`. Production requires HTTPS for Geolocation API.
3. **Cargo capacity** — Prototype values, not official MSRTC specifications.
4. **Pricing** — Configurable formula. Not official MSRTC tariff.
5. **Routes** — Approximate coordinates. Not official timetable data.
6. **ETA** — Simple distance/speed estimate. No traffic awareness.
7. **No official MSRTC API** — GPS source is driver's device (proof of concept).
8. **Weight verification** — Manual entry only. Not IoT weighing.
9. **Single driver per bus** — No conductor separate login in this build.
10. **No email/SMS** — Notifications are in-app only.

---

## 📱 Testing GPS with Smartphone

1. Connect phone and laptop to the **same WiFi network**
2. Find laptop IP: `ipconfig` → look for IPv4 (e.g., `192.168.1.5`)
3. On phone browser: `http://192.168.1.5:5173`
4. Login as Driver
5. Go to `/driver/gps`
6. Tap START GPS → Allow location
7. Admin map on laptop updates in realtime

**Note:** For phone GPS to work over local IP, you need HTTPS.
Use ngrok for quick HTTPS tunnel:
```bash
npx ngrok http 5173
```
Then open the ngrok HTTPS URL on the phone.

---

## 🧪 Testing GPS on Laptop

Most laptops have GPS via WiFi positioning or dedicated GPS chip.
1. Login as Driver
2. Go to `/driver/gps`
3. Click START GPS
4. Allow browser location
5. Coordinates appear (may be less accurate than phone)
6. Admin map updates

If laptop GPS is unavailable:
1. Check "Use Simulation" checkbox
2. Click START GPS
3. Bus will follow demo route (Kopargaon→Nashik)
4. **UI clearly shows: SIMULATION MODE**

---

## 🌾 Testing Farmer Flow

1. Login as Farmer (`9000000005 / demo1234`)
2. Allow location permission
3. See nearby buses on map
4. Click "Book Cargo"
5. Enter: Pickup=Kopargaon, Destination=Nashik, Goods=Tomatoes, Weight=40kg, Urgency=HIGH
6. Click Find Available Buses
7. System scores and recommends buses
8. Select recommended bus
9. Confirm booking (demo payment auto-completes)
10. Parcel ID generated (SY-KPG-XXXX)
11. QR code shown
12. Verify BUS-001 available cargo decreased

---

## 🚶 Testing Passenger Flow

1. Login as Passenger (`9000000007 / demo1234`)
2. Allow location → see nearby buses
3. Click Book Seat
4. Search: From=Kopargaon, To=Shirdi, Seats=2
5. Select BUS-002
6. Confirm (demo payment)
7. Ticket with QR generated
8. Go to My Tickets → Track Bus
9. Map shows live bus location

---

## 🚌 Testing Driver Flow

1. Login as Driver (`9000000002 / demo1234`)
2. Dashboard shows BUS-001, current occupancy, cargo
3. Go to `/driver/gps` → Start GPS
4. Return to dashboard → Update occupancy at a stop
5. Go to `/driver/cargo` → Mark cargo as loaded
6. Submit a report (e.g. ROUTE_DELAY)
7. Check admin receives it

---

## 🖥 Testing Admin Flow

1. Login as Admin (`9000000001 / demo1234`)
2. Dashboard: fleet stats, GPS connected count
3. Live map: all buses shown with GPS status
4. Click a bus marker → see occupancy, cargo, GPS
5. Fleet page: manage buses, change status
6. Reports page: view/acknowledge driver reports
7. Bookings page: all transactions
