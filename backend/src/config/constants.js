require('dotenv').config();

module.exports = {
  ROLES: {
    ADMIN: 'ADMIN',
    FARMER: 'FARMER',
    PASSENGER: 'PASSENGER',
    DRIVER: 'DRIVER',
  },

  GPS_STATUS: {
    CONNECTED: 'CONNECTED',
    STALE: 'STALE',
    OFFLINE: 'OFFLINE',
    SIMULATION: 'SIMULATION',
  },

  BUS_STATUS: {
    SCHEDULED: 'SCHEDULED',
    IN_TRANSIT: 'IN_TRANSIT',
    AT_STOP: 'AT_STOP',
    DELAYED: 'DELAYED',
    BREAKDOWN: 'BREAKDOWN',
    CANCELLED: 'CANCELLED',
    COMPLETED: 'COMPLETED',
  },

  BOOKING_TYPE: {
    PASSENGER: 'PASSENGER',
    CARGO: 'CARGO',
  },

  BOOKING_STATUS: {
    PENDING: 'PENDING',
    CONFIRMED: 'CONFIRMED',
    CANCELLED: 'CANCELLED',
    COMPLETED: 'COMPLETED',
  },

  PARCEL_STATUS: {
    REQUESTED: 'REQUESTED',
    MATCHED: 'MATCHED',
    BOOKED: 'BOOKED',
    LOADED: 'LOADED',
    IN_TRANSIT: 'IN_TRANSIT',
    DELIVERED: 'DELIVERED',
    CANCELLED: 'CANCELLED',
  },

  // Valid parcel status transitions
  PARCEL_TRANSITIONS: {
    REQUESTED: ['MATCHED', 'CANCELLED'],
    MATCHED: ['BOOKED', 'CANCELLED'],
    BOOKED: ['LOADED', 'CANCELLED'],
    LOADED: ['IN_TRANSIT'],
    IN_TRANSIT: ['DELIVERED'],
    DELIVERED: [],
    CANCELLED: [],
  },

  DRIVER_REPORT_TYPES: [
    'BREAKDOWN',
    'ACCIDENT',
    'MEDICAL_EMERGENCY',
    'ROUTE_DELAY',
    'UNSCHEDULED_STOP',
    'BUS_CANCELLED',
    'PASSENGER_BOARDING',
    'OTHER',
  ],

  GOODS_TYPES: [
    'Tomatoes', 'Onion', 'Wheat', 'Sugarcane', 'Milk',
    'Vegetables', 'Fertilizer', 'Seeds', 'Other',
  ],

  URGENCY: {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
  },

  PAYMENT_STATUS: {
    PENDING: 'PENDING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    REFUNDED: 'REFUNDED',
  },

  // Fare config (fallback if env not set)
  FARE: {
    BASE: parseFloat(process.env.BASE_FARE) || 10,
    PER_KG: parseFloat(process.env.PRICE_PER_KG) || 2,
    DISTANCE_RATE: parseFloat(process.env.DISTANCE_RATE) || 0.5,
    MEDIUM_SURCHARGE: parseFloat(process.env.MEDIUM_URGENCY_SURCHARGE) || 0.15,
    HIGH_SURCHARGE: parseFloat(process.env.HIGH_URGENCY_SURCHARGE) || 0.30,
  },

  GPS: {
    STALE_THRESHOLD: parseInt(process.env.GPS_STALE_THRESHOLD_SECONDS) || 30,
    OFFLINE_THRESHOLD: parseInt(process.env.GPS_OFFLINE_THRESHOLD_SECONDS) || 120,
    UPDATE_INTERVAL: parseInt(process.env.GPS_UPDATE_INTERVAL_MS) || 3000,
  },

  AVG_SPEED_KMH: parseFloat(process.env.AVG_BUS_SPEED_KMH) || 40,
};
