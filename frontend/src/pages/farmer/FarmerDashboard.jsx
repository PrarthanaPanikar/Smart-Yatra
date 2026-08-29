import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import useDeviceLocation from '../../hooks/useDeviceLocation'
import { getSocket, subscribeToBus } from '../../services/socketService'
import SmartMap from '../../components/map/SmartMap'
import BusMarker from '../../components/map/BusMarker'
import UserMarker from '../../components/map/UserMarker'
import StatusBadge from '../../components/common/StatusBadge'
import LoadingSpinner from '../../components/common/LoadingSpinner'

export default function FarmerDashboard() {
  const { location, error: locError, loading: locLoading, requestLocation } = useDeviceLocation()
  const [nearbyBuses, setNearbyBuses] = useState([])
  const [myBookings, setMyBookings]   = useState([])
  const [busLocations, setBusLocations] = useState({})
  const [loading, setLoading] = useState(false)

  // Fetch nearby buses when location available
  useEffect(() => {
    if (!location) return
    setLoading(true)
    api.get(`/buses/nearby?lat=${location.lat}&lng=${location.lng}&radius=80000`)
      .then(r => {
        const buses = r.data.buses || []
        setNearbyBuses(buses)
        buses.forEach(b => subscribeToBus(b.id))
      })
      .finally(() => setLoading(false))
  }, [location])

  // Fetch recent bookings
  useEffect(() => {
    api.get('/bookings/me')
      .then(r => setMyBookings((r.data.bookings || []).filter(b => b.booking_type === 'CARGO').slice(0, 3)))
      .catch(() => {})
  }, [])

  // Realtime bus location updates
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return
    const handler = (data) => {
      setBusLocations(prev => ({ ...prev, [data.busId]: data }))
      setNearbyBuses(prev => prev.map(b =>
        b.id === data.busId
          ? { ...b, current_latitude: data.latitude, current_longitude: data.longitude,
              gps_status: data.gpsStatus, last_gps_update: data.timestamp }
          : b
      ))
    }
    socket.on('bus:location', handler)
    return () => socket.off('bus:location', handler)
  }, [])

  const busesOnMap = nearbyBuses.filter(b => b.current_latitude && b.current_longitude)

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Farmer Dashboard</h1>
        <Link to="/farmer/book"
          className="bg-amber-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-amber-700 transition-colors">
          📦 Book Cargo
        </Link>
      </div>

      {/* Location card */}
      <div className={`rounded-xl p-5 border ${location ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-800 mb-1">Your Location</h2>
            {locLoading && <p className="text-sm text-amber-700">Getting location…</p>}
            {locError && <p className="text-sm text-red-600">⚠ {locError}</p>}
            {location && (
              <div className="text-sm text-green-700 space-y-0.5">
                <p>Lat: <span className="font-mono font-medium">{location.lat.toFixed(5)}</span></p>
                <p>Lng: <span className="font-mono font-medium">{location.lng.toFixed(5)}</span></p>
                <p>Accuracy: <span className="font-medium">±{Math.round(location.accuracy)}m</span></p>
              </div>
            )}
          </div>
          {!location && !locLoading && (
            <button onClick={requestLocation}
              className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700">
              📍 Enable Location
            </button>
          )}
          {location && <span className="text-3xl">✅</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Map */}
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <h2 className="font-bold text-gray-800 mb-3">Nearby Buses (Live)</h2>
          <SmartMap
            center={location ? [location.lat, location.lng] : [19.7157, 74.4704]}
            zoom={11}
            height="360px"
            recenter={!!location}
          >
            {location && (
              <UserMarker
                position={[location.lat, location.lng]}
                accuracy={location.accuracy}
                label="Your Location"
              />
            )}
            {nearbyBuses.map(b => <BusMarker key={b.id} bus={b} />)}
          </SmartMap>
        </div>

        {/* Nearby buses list */}
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <h2 className="font-bold text-gray-800 mb-3">
            Nearby Buses {nearbyBuses.length > 0 && `(${nearbyBuses.length})`}
          </h2>
          {loading && <LoadingSpinner size="sm" text="Finding nearby buses…" />}
          {!loading && !location && (
            <div className="text-center py-8 text-gray-400">
              <p className="text-2xl mb-2">📍</p>
              <p>Enable location to see nearby buses</p>
            </div>
          )}
          {!loading && location && nearbyBuses.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <p>No buses found nearby</p>
            </div>
          )}
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {nearbyBuses.map(b => (
              <div key={b.id} className="border rounded-xl p-3 hover:bg-amber-50 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-gray-800">{b.bus_number}</p>
                    <p className="text-xs text-gray-500">{b.origin} → {b.destination}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge type="gps" status={b.gps_status} size="xs" />
                    <StatusBadge type="bus" status={b.status} size="xs" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs mt-2">
                  <div className="text-center bg-green-50 rounded p-1">
                    <p className="text-gray-400">Cargo Free</p>
                    <p className="font-bold text-green-700">{parseFloat(b.available_cargo_kg||0).toFixed(0)} kg</p>
                  </div>
                  <div className="text-center bg-blue-50 rounded p-1">
                    <p className="text-gray-400">Seats Free</p>
                    <p className="font-bold text-blue-700">{b.available_seats}</p>
                  </div>
                  <div className="text-center bg-gray-50 rounded p-1">
                    <p className="text-gray-400">Distance</p>
                    <p className="font-bold">{b.distance_km ? `${b.distance_km}km` : '—'}</p>
                  </div>
                </div>
                <Link
                  to={`/farmer/book?busId=${b.id}`}
                  className="mt-3 block w-full text-center bg-amber-600 text-white text-xs font-semibold py-2 rounded-lg hover:bg-amber-700"
                >
                  Book Cargo on {b.bus_number}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent cargo bookings */}
      {myBookings.length > 0 && (
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800">Recent Cargo Bookings</h2>
            <Link to="/farmer/bookings" className="text-sm text-amber-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {myBookings.map(bk => (
              <div key={bk.id} className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-100">
                <div>
                  <span className="font-mono font-bold text-amber-700 text-sm">{bk.parcel_id}</span>
                  <p className="text-xs text-gray-500">{bk.goods_type} · {bk.weight_kg}kg · {bk.from_stop} → {bk.to_stop}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge type="bus" status={bk.status} size="xs" />
                  <Link to={`/farmer/track/${bk.parcel_id}`}
                    className="text-xs text-amber-600 hover:underline">Track</Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
