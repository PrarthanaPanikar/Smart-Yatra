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
import ReportBox from '../../components/passenger/ReportBox'

export default function PassengerDashboard() {
  const { location, error: locError, loading: locLoading, requestLocation } = useDeviceLocation()
  const [nearbyBuses, setNearbyBuses] = useState([])
  const [myBookings, setMyBookings]   = useState([])
  const [loading, setLoading]         = useState(false)

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

  useEffect(() => {
    api.get('/bookings/me')
      .then(r => setMyBookings((r.data.bookings || []).filter(b => b.booking_type === 'PASSENGER').slice(0, 3)))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return
    const handler = (data) => {
      setNearbyBuses(prev => prev.map(b =>
        b.id === data.busId
          ? { ...b, current_latitude: data.latitude, current_longitude: data.longitude,
              gps_status: data.gpsStatus, last_gps_update: data.timestamp }
          : b
      ))
    }
    socket.on('bus:location', handler)
    socket.on('bus:occupancy', (data) => {
      setNearbyBuses(prev => prev.map(b =>
        b.id === data.busId
          ? { ...b, current_occupancy: data.currentOccupancy, available_seats: data.availableSeats }
          : b
      ))
    })
    return () => {
      socket.off('bus:location', handler)
      socket.off('bus:occupancy')
    }
  }, [])

  // ETA helper
  const getETA = (bus) => {
    if (!bus.distance_km) return '—'
    const hrs = parseFloat(bus.distance_km) / 40
    if (hrs < 1) return `${Math.round(hrs * 60)} min`
    return `${hrs.toFixed(1)} hrs`
  }

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Passenger Dashboard</h1>
        <Link to="/passenger/book"
          className="bg-purple-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-purple-700">
          🎫 Book Seat
        </Link>
      </div>

      {/* Location */}
      <div className={`rounded-xl p-4 border ${location ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-700 mb-1">Your Location</p>
            {locLoading && <p className="text-sm text-gray-500">Getting location…</p>}
            {locError && <p className="text-sm text-red-600">⚠ {locError}</p>}
            {location && (
              <p className="text-sm text-purple-700">
                {location.lat.toFixed(4)}, {location.lng.toFixed(4)} · ±{Math.round(location.accuracy)}m
              </p>
            )}
          </div>
          {!location && !locLoading && (
            <button onClick={requestLocation}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700">
              📍 Share Location
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <h2 className="font-bold text-gray-800 mb-3">Live Buses Near You</h2>
          <SmartMap
            center={location ? [location.lat, location.lng] : [19.7157, 74.4704]}
            zoom={11}
            height="360px"
            recenter={!!location}
          >
            {location && <UserMarker position={[location.lat, location.lng]} accuracy={location.accuracy} />}
            {nearbyBuses.map(b => <BusMarker key={b.id} bus={b} />)}
          </SmartMap>
        </div>

        <div className="bg-white rounded-xl border shadow-sm p-4">
          <h2 className="font-bold text-gray-800 mb-3">
            Available Buses {nearbyBuses.length > 0 && `(${nearbyBuses.length})`}
          </h2>
          {loading && <LoadingSpinner size="sm" text="Finding buses…" />}
          {!loading && !location && (
            <div className="text-center py-8 text-gray-400">
              <p className="text-2xl mb-2">📍</p>
              <p>Share your location to see nearby buses</p>
            </div>
          )}
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {nearbyBuses.map(b => (
              <div key={b.id} className="border rounded-xl p-3 hover:border-purple-300 transition-colors">
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
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center bg-purple-50 rounded p-1">
                    <p className="text-gray-400">Seats Free</p>
                    <p className="font-bold text-purple-700">{b.available_seats}</p>
                  </div>
                  <div className="text-center bg-blue-50 rounded p-1">
                    <p className="text-gray-400">ETA</p>
                    <p className="font-bold text-blue-700">{getETA(b)}</p>
                  </div>
                  <div className="text-center bg-gray-50 rounded p-1">
                    <p className="text-gray-400">Departs</p>
                    <p className="font-bold">{b.departure_time || '—'}</p>
                  </div>
                </div>
                <Link
                  to={`/passenger/book?busId=${b.id}`}
                  className="mt-3 block w-full text-center bg-purple-600 text-white text-xs font-semibold py-2 rounded-lg hover:bg-purple-700"
                >
                  Book Seat on {b.bus_number}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent tickets */}
      {myBookings.length > 0 && (
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-800">Recent Tickets</h2>
            <Link to="/passenger/bookings" className="text-sm text-purple-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {myBookings.map(bk => (
              <div key={bk.id} className="flex items-center justify-between p-3 rounded-lg bg-purple-50 border border-purple-100">
                <div>
                  <p className="font-semibold text-sm">{bk.bus_number} · {bk.seats} seat(s)</p>
                  <p className="text-xs text-gray-500">{bk.from_stop} → {bk.to_stop}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-purple-700">₹{bk.estimated_cost}</span>
                  <StatusBadge type="bus" status={bk.status} size="xs" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Challenge #2 — Passenger Information Report Box */}
      <ReportBox buses={nearbyBuses} />
    </div>
  )
}
