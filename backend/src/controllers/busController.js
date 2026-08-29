const { db } = require('../config/db');
const { computeGpsStatus } = require('./gpsController');
const { FARE, AVG_SPEED_KMH } = require('../config/constants');

const enrichBus = (b) => ({
  ...b,
  gps_status:        computeGpsStatus(b),
  available_seats:   (b.seat_capacity || 0) - (b.current_occupancy || 0),
  available_cargo_kg: parseFloat(b.cargo_capacity_kg || 0) - parseFloat(b.booked_cargo_kg || 0),
});

const BUS_JOIN = `
  SELECT b.*, r.id as route_id, r.name as route_name, r.origin, r.destination, r.distance_km,
         u.name as driver_name, u.mobile as driver_mobile
  FROM buses b
  LEFT JOIN routes r ON b.route_id = r.id
  LEFT JOIN users  u ON b.driver_id = u.id
`;

// GET /api/buses
const getAllBuses = async (req, res) => {
  try {
    const buses = db.prepare(`${BUS_JOIN} WHERE b.is_active = 1 ORDER BY b.bus_number`).all();
    res.json({ buses: buses.map(enrichBus) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch buses' });
  }
};

// GET /api/buses/:id
const getBusById = async (req, res) => {
  try {
    const bus = db.prepare(`${BUS_JOIN} WHERE b.id = ?`).get(req.params.id);
    if (!bus) return res.status(404).json({ error: 'Bus not found' });
    res.json({ bus: enrichBus(bus) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bus' });
  }
};

// GET /api/buses/nearby?lat=&lng=&radius=  (radius in metres, default 80km)
const getNearbyBuses = async (req, res) => {
  try {
    const { lat, lng, radius = 80000 } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const radiusKm = parseFloat(radius) / 1000;

    // Rough bounding box filter, then distance sort
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos(userLat * Math.PI / 180));

    const buses = db.prepare(`
      ${BUS_JOIN}
      WHERE b.is_active = 1
        AND b.status NOT IN ('CANCELLED','COMPLETED')
        AND b.current_latitude IS NOT NULL
        AND b.current_latitude  BETWEEN ? AND ?
        AND b.current_longitude BETWEEN ? AND ?
      ORDER BY b.bus_number
    `).all(userLat - latDelta, userLat + latDelta, userLng - lngDelta, userLng + lngDelta);

    const withDist = buses.map(b => {
      const dLat = (b.current_latitude  - userLat) * 111;
      const dLng = (b.current_longitude - userLng) * 111 * Math.cos(userLat * Math.PI / 180);
      const distKm = Math.sqrt(dLat * dLat + dLng * dLng);
      return { ...enrichBus(b), distance_km: distKm.toFixed(1), distance_m: Math.round(distKm * 1000) };
    }).filter(b => b.distance_m <= parseFloat(radius));

    withDist.sort((a, b) => a.distance_m - b.distance_m);
    res.json({ buses: withDist });
  } catch (err) {
    console.error('Nearby buses error:', err);
    res.status(500).json({ error: 'Failed to fetch nearby buses' });
  }
};

// GET /api/buses/search?origin=&destination=&weightKg=
const searchBuses = async (req, res) => {
  try {
    const { origin, destination, weightKg } = req.query;
    let where = "b.is_active = 1 AND b.status NOT IN ('CANCELLED','COMPLETED')";
    const params = [];

    if (origin) {
      where += ` AND (r.origin LIKE ? OR EXISTS (
        SELECT 1 FROM stops s WHERE s.route_id = b.route_id AND s.name LIKE ?))`;
      params.push(`%${origin}%`, `%${origin}%`);
    }
    if (destination) {
      where += ` AND (r.destination LIKE ? OR EXISTS (
        SELECT 1 FROM stops s WHERE s.route_id = b.route_id AND s.name LIKE ?))`;
      params.push(`%${destination}%`, `%${destination}%`);
    }
    if (weightKg) {
      where += ` AND (b.cargo_capacity_kg - b.booked_cargo_kg) >= ?`;
      params.push(parseFloat(weightKg));
    }

    const buses = db.prepare(`${BUS_JOIN} WHERE ${where} ORDER BY b.departure_time`).all(...params);
    res.json({ buses: buses.map(enrichBus) });
  } catch (err) {
    console.error('Search buses error:', err);
    res.status(500).json({ error: 'Failed to search buses' });
  }
};

// GET /api/buses/recommend?origin=&destination=&weightKg=&lat=&lng=&urgency=
const recommendBuses = async (req, res) => {
  try {
    const { origin, destination, weightKg, lat, lng, urgency = 'LOW' } = req.query;
    if (!origin || !destination || !weightKg)
      return res.status(400).json({ error: 'origin, destination, weightKg required' });

    const wkg = parseFloat(weightKg);

    const buses = db.prepare(`
      ${BUS_JOIN}
      WHERE b.is_active = 1
        AND b.status NOT IN ('CANCELLED','COMPLETED')
        AND (b.cargo_capacity_kg - b.booked_cargo_kg) >= ?
        AND (r.origin LIKE ? OR r.destination LIKE ?
             OR EXISTS (SELECT 1 FROM stops s WHERE s.route_id = b.route_id
                        AND (s.name LIKE ? OR s.name LIKE ?)))
      ORDER BY (b.cargo_capacity_kg - b.booked_cargo_kg) DESC
    `).all(wkg, `%${origin}%`, `%${destination}%`, `%${origin}%`, `%${destination}%`);

    const userLat = lat ? parseFloat(lat) : null;
    const userLng = lng ? parseFloat(lng) : null;

    const scored = buses.map(b => {
      const available = parseFloat(b.cargo_capacity_kg) - parseFloat(b.booked_cargo_kg);
      const cargoRatio = Math.min(available / Math.max(wkg * 2, 100), 1);

      const routeMatch =
        ((b.origin || '').toLowerCase().includes(origin.toLowerCase()) ? 0.5 : 0) +
        ((b.destination || '').toLowerCase().includes(destination.toLowerCase()) ? 0.5 : 0);

      let departureFit = 0.5;
      if (b.departure_time) {
        const [h, m] = b.departure_time.split(':').map(Number);
        const dep = h * 60 + m;
        const now = new Date().getHours() * 60 + new Date().getMinutes();
        const diff = dep - now;
        if (diff >= 0 && diff <= 120) departureFit = 1 - diff / 120;
        else if (diff < 0) departureFit = 0.2;
      }

      let pickupScore = 0.5;
      if (userLat && userLng && b.current_latitude && b.current_longitude) {
        const d = Math.sqrt(
          Math.pow((b.current_latitude - userLat) * 111, 2) +
          Math.pow((b.current_longitude - userLng) * 111 * Math.cos(userLat * Math.PI / 180), 2)
        );
        pickupScore = Math.max(0, 1 - d / 50);
      }

      const distKm   = parseFloat(b.distance_km) || 50;
      const etaHours = distKm / AVG_SPEED_KMH;

      const urgencyBonus = urgency === 'HIGH' ? 0.1 : urgency === 'MEDIUM' ? 0.05 : 0;
      const score = routeMatch * 0.30 + cargoRatio * 0.20 + pickupScore * 0.15 +
                    departureFit * 0.15 + (1 - Math.min(etaHours / 5, 1)) * 0.10 +
                    (b.status === 'SCHEDULED' ? 0.10 : 0.05) + urgencyBonus;

      const urgencyMul =
        urgency === 'HIGH' ? 1 + FARE.HIGH_SURCHARGE :
        urgency === 'MEDIUM' ? 1 + FARE.MEDIUM_SURCHARGE : 1;
      const estimatedCost = Math.round(
        (FARE.BASE + wkg * FARE.PER_KG + distKm * FARE.DISTANCE_RATE) * urgencyMul
      );

      const reasons = [];
      if (routeMatch >= 0.5) reasons.push('Destination matches your route');
      reasons.push(`${available.toFixed(0)} kg cargo available`);
      if (pickupScore > 0.7) reasons.push('Close to your location');
      if (departureFit > 0.6) reasons.push('Suitable departure time');

      return {
        ...enrichBus(b), score: Math.min(Math.round(score * 100), 100),
        estimated_cost: estimatedCost, eta_hours: etaHours.toFixed(1), reasons,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    res.json({ buses: scored.slice(0, 5) });
  } catch (err) {
    console.error('Recommend error:', err);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
};

// GET /api/buses/routes
const getRoutes = async (req, res) => {
  try {
    const routes = db.prepare('SELECT * FROM routes WHERE is_active = 1 ORDER BY name').all();
    res.json({ routes });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch routes' });
  }
};

// GET /api/buses/routes/:id/stops
const getRouteStops = async (req, res) => {
  try {
    const stops = db.prepare(
      'SELECT id, name, latitude, longitude, sequence FROM stops WHERE route_id = ? ORDER BY sequence'
    ).all(req.params.id);
    res.json({ stops });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stops' });
  }
};

module.exports = { getAllBuses, getBusById, getNearbyBuses, searchBuses, recommendBuses, getRoutes, getRouteStops };
