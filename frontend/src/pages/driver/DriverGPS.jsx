import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import { gpsManager } from '../../services/gpsService'
import SmartMap from '../../components/map/SmartMap'
import UserMarker from '../../components/map/UserMarker'
import BusMarker from '../../components/map/BusMarker'

const STATUS_CONFIG = {
  IDLE:        { colour: 'bg-gray-100 text-gray-600', label: 'GPS Idle',         dot: 'bg-gray-400' },
  REQUESTING:  { colour: 'bg-yellow-100 text-yellow-700', label: 'Requesting GPS…', dot: 'bg-yellow-500 animate-pulse' },
  CONNECTED:   { colour: 'bg-green-100 text-green-700', label: 'GPS CONNECTED',  dot: 'bg-green-500 gps-pulse' },
  ERROR:       { colour: 'bg-red-100 text-red-700',   label: 'GPS Error',        dot: 'bg-red-500' },
  SIMULATION:  { colour: 'bg-purple-100 text-purple-700', label: 'SIMULATION MODE', dot: 'bg-purple-500 animate-pulse' },
}

export default function DriverGPS() {
  const { user } = useAuth()
  const [bus, setBus]           = useState(null)
  const [gpsData, setGpsData]   = useState(null)
  const [status, setStatus]     = useState('IDLE')
  const [error, setError]       = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [useSimulation, setUseSimulation] = useState(false)
  const [mapCenter, setMapCenter] = useState(null)
  const updateCountRef = useRef(0)

  useEffect(() => {
    api.get('/driver/bus')
      .then(r => setBus(r.data.bus))
      .catch(() => {})
    return () => { gpsManager.stop() }
  }, [])

  const startGPS = () => {
    if (!bus?.id) return
    setError('')
    updateCountRef.current = 0

    const callbacks = {
      onLocation: (loc) => {
        setGpsData(loc)
        setMapCenter([loc.latitude, loc.longitude])
        updateCountRef.current++
      },
      onError: (msg) => {
        setError(msg)
        setIsRunning(false)
      },
      onStatusChange: (s) => {
        setStatus(s)
        if (s === 'IDLE' || s === 'ERROR') setIsRunning(false)
      },
    }

    if (useSimulation) {
      gpsManager.startSimulation(bus.id, callbacks)
    } else {
      gpsManager.startReal(bus.id, callbacks)
    }
    setIsRunning(true)
  }

  const stopGPS = () => {
    gpsManager.stop()
    setIsRunning(false)
    setStatus('IDLE')
    setGpsData(null)
  }

  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.IDLE

  if (!bus) return (
    <div className="p-8 text-center">
      <p className="text-xl text-gray-500">No bus assigned. Contact admin.</p>
    </div>
  )

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">GPS Tracker</h1>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${cfg.colour}`}>
          <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`}></span>
          {cfg.label}
        </div>
      </div>

      {/* Bus info */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-green-800 text-lg">{bus.bus_number}</p>
            <p className="text-green-600">{bus.route_name}</p>
          </div>
          <div className="text-right text-sm text-green-700">
            <p>GPS SOURCE:</p>
            <p className="font-bold">{useSimulation ? 'Demo Simulation' : 'Driver Device'}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          ⚠ {error}
          {error.includes('permission') && (
            <p className="mt-1 text-xs">
              Enable location: Browser → Settings → Privacy → Location → Allow for this site.
              Note: GPS requires HTTPS in production.
            </p>
          )}
        </div>
      )}

      {/* Simulation warning */}
      {status === 'SIMULATION' && (
        <div className="bg-purple-50 border border-purple-300 text-purple-800 px-4 py-3 rounded-xl text-sm font-semibold text-center">
          ⚠ SIMULATION MODE — Location data is NOT from a real device.
          This is a demo fallback only.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Controls */}
        <div className="bg-white rounded-xl border shadow-sm p-5 space-y-4">
          <h2 className="font-bold text-gray-700">GPS Controls</h2>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <input type="checkbox" id="useSimulation" checked={useSimulation}
              onChange={e => setUseSimulation(e.target.checked)}
              disabled={isRunning}
              className="w-4 h-4 text-purple-600" />
            <div>
              <label htmlFor="useSimulation" className="text-sm font-medium text-gray-700">
                Use Simulation (fallback)
              </label>
              <p className="text-xs text-gray-400">Only if real GPS is unavailable</p>
            </div>
          </div>

          {!isRunning ? (
            <button onClick={startGPS}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl text-lg transition-colors">
              📡 START GPS
            </button>
          ) : (
            <button onClick={stopGPS}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl text-lg transition-colors">
              ⏹ STOP GPS
            </button>
          )}

          <p className="text-xs text-gray-400 text-center">
            {!useSimulation && 'Browser will request location permission when you start GPS.'}
          </p>

          {/* GPS readings */}
          {gpsData && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 border">
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  ['Latitude',  gpsData.latitude?.toFixed(6)],
                  ['Longitude', gpsData.longitude?.toFixed(6)],
                  ['Accuracy',  gpsData.accuracy ? `±${Math.round(gpsData.accuracy)}m` : 'N/A'],
                  ['Speed',     gpsData.speed ? `${Math.round(gpsData.speed)} km/h` : 'N/A'],
                  ['Heading',   gpsData.heading ? `${Math.round(gpsData.heading)}°` : 'N/A'],
                  ['Updates',   updateCountRef.current],
                ].map(([k, v]) => (
                  <div key={k} className="bg-white rounded-lg p-2 text-center border">
                    <p className="text-xs text-gray-400">{k}</p>
                    <p className="font-bold text-gray-800 text-sm">{v}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 text-center">
                Last update: {new Date(gpsData.timestamp).toLocaleTimeString()}
              </p>
              {gpsData.accuracy > 50 && (
                <p className="text-xs text-yellow-600 text-center">⚠ GPS accuracy is currently low</p>
              )}
            </div>
          )}
        </div>

        {/* Map */}
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <h2 className="font-bold text-gray-700 mb-3">Live Position</h2>
          <SmartMap
            center={mapCenter || [19.7157, 74.4704]}
            zoom={14}
            height="380px"
            recenter={!!mapCenter}
          >
            {gpsData && (
              <UserMarker
                position={[gpsData.latitude, gpsData.longitude]}
                accuracy={gpsData.accuracy}
                label={`${bus.bus_number} — ${useSimulation ? 'SIMULATION' : 'Live GPS'}`}
              />
            )}
          </SmartMap>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">How GPS works:</p>
        <ol className="list-decimal list-inside space-y-1 text-xs">
          <li>Click START GPS — browser requests location permission</li>
          <li>Click Allow — real device coordinates are read</li>
          <li>Coordinates sent to backend every ~3 seconds</li>
          <li>Admin and passengers see your bus moving in realtime</li>
          <li>Click STOP GPS to stop transmission</li>
        </ol>
        <p className="text-xs mt-2 text-blue-600">
          ⚠ GPS requires HTTPS in production. Works on localhost for development.
          For mobile demo: open this page on your phone browser.
        </p>
      </div>
    </div>
  )
}
