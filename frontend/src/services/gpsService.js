/**
 * SmartYatra GPS Service
 *
 * Two providers:
 *   PhoneGPSProvider  — REAL device GPS via navigator.geolocation.watchPosition()
 *   SimulationGPSProvider — FALLBACK only, clearly labelled SIMULATION
 *
 * GPS source flows: DEVICE → Backend → Socket.IO → Map
 */

import api from './api'

// ─── PhoneGPSProvider ──────────────────────────────────────────────────────
export class PhoneGPSProvider {
  constructor() {
    this.watchId       = null
    this.lastSent      = 0
    this.busId         = null
    this.onLocation    = null
    this.onError       = null
    this.onStatusChange= null
    this.status        = 'IDLE'   // IDLE | REQUESTING | CONNECTED | ERROR
    this.MIN_INTERVAL  = 3000     // ms between backend sends
  }

  setCallbacks({ onLocation, onError, onStatusChange }) {
    this.onLocation     = onLocation
    this.onError        = onError
    this.onStatusChange = onStatusChange
  }

  _setStatus(s) {
    this.status = s
    this.onStatusChange?.(s)
  }

  start(busId) {
    if (!navigator.geolocation) {
      this._setStatus('ERROR')
      this.onError?.('Geolocation is not supported by this browser.')
      return
    }

    this.busId = busId
    this._setStatus('REQUESTING')

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this._handlePosition(pos),
      (err) => this._handleError(err),
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 10000,
      }
    )
  }

  stop() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId)
      this.watchId = null
    }
    this._setStatus('IDLE')
  }

  _handlePosition(pos) {
    const { latitude, longitude, accuracy, speed, heading } = pos.coords
    const timestamp = new Date(pos.timestamp).toISOString()

    this._setStatus('CONNECTED')

    const locationData = {
      latitude,
      longitude,
      accuracy,
      speed: speed ? Math.round(speed * 3.6) : null,  // m/s → km/h
      heading,
      timestamp,
      gpsSource: 'DEVICE',
    }

    // Notify UI immediately
    this.onLocation?.(locationData)

    // Throttle backend sends
    const now = Date.now()
    if (now - this.lastSent >= this.MIN_INTERVAL) {
      this.lastSent = now
      this._sendToBackend(locationData)
    }
  }

  async _sendToBackend(locationData) {
    if (!this.busId) return
    try {
      await api.post('/gps/location', {
        busId: this.busId,
        ...locationData,
      })
    } catch (err) {
      console.warn('GPS send to backend failed:', err.message)
      // Queue one retry — do NOT flood with old positions
      setTimeout(() => {
        api.post('/gps/location', { busId: this.busId, ...locationData }).catch(() => {})
      }, 5000)
    }
  }

  _handleError(err) {
    this._setStatus('ERROR')
    let message = 'GPS error'
    switch (err.code) {
      case err.PERMISSION_DENIED:
        message = 'Location permission denied. Enable location permission to use live tracking.'
        break
      case err.POSITION_UNAVAILABLE:
        message = 'GPS position unavailable. Ensure GPS is enabled on your device.'
        break
      case err.TIMEOUT:
        message = 'GPS request timed out. Please try again.'
        break
    }
    this.onError?.(message)
  }
}

// ─── SimulationGPSProvider ─────────────────────────────────────────────────
// FALLBACK ONLY — clearly labelled in UI
export class SimulationGPSProvider {
  constructor() {
    this.intervalId    = null
    this.busId         = null
    this.onLocation    = null
    this.onError       = null
    this.onStatusChange= null
    this.status        = 'IDLE'
    this.stepIndex     = 0

    // Demo route: Kopargaon → Nashik approximate waypoints
    this.route = [
      { lat: 19.7157, lng: 74.4704 },
      { lat: 19.7290, lng: 74.4200 },
      { lat: 19.7600, lng: 74.3600 },
      { lat: 19.7900, lng: 74.2800 },
      { lat: 19.8200, lng: 74.2000 },
      { lat: 19.8473, lng: 74.0022 },
      { lat: 19.9100, lng: 73.9200 },
      { lat: 19.9500, lng: 73.8500 },
      { lat: 19.9975, lng: 73.7898 },
    ]
  }

  setCallbacks({ onLocation, onError, onStatusChange }) {
    this.onLocation     = onLocation
    this.onError        = onError
    this.onStatusChange = onStatusChange
  }

  _setStatus(s) {
    this.status = s
    this.onStatusChange?.(s)
  }

  start(busId) {
    this.busId = busId
    this.stepIndex = 0
    this._setStatus('SIMULATION')

    this.intervalId = setInterval(() => {
      const point = this.route[this.stepIndex % this.route.length]
      // Add tiny random jitter to look realistic
      const jitter = () => (Math.random() - 0.5) * 0.002
      const locationData = {
        latitude:  point.lat + jitter(),
        longitude: point.lng + jitter(),
        accuracy:  15 + Math.random() * 10,
        speed:     30 + Math.random() * 20,
        heading:   180 + Math.random() * 30,
        timestamp: new Date().toISOString(),
        gpsSource: 'SIMULATION',
      }

      this.onLocation?.(locationData)
      api.post('/gps/location', { busId: this.busId, ...locationData }).catch(() => {})
      this.stepIndex++
    }, 4000)
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this._setStatus('IDLE')
  }
}

// ─── Singleton GPS manager for drivers ────────────────────────────────────
let _provider = null

export const gpsManager = {
  get provider() { return _provider },

  startReal(busId, callbacks) {
    this.stop()
    _provider = new PhoneGPSProvider()
    _provider.setCallbacks(callbacks)
    _provider.start(busId)
    return _provider
  },

  startSimulation(busId, callbacks) {
    this.stop()
    _provider = new SimulationGPSProvider()
    _provider.setCallbacks(callbacks)
    _provider.start(busId)
    return _provider
  },

  stop() {
    _provider?.stop()
    _provider = null
  },

  get isRunning() {
    return _provider !== null && _provider.status !== 'IDLE' && _provider.status !== 'ERROR'
  },
}
