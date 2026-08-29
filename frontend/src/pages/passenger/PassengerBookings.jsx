import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import { getSocket, subscribeToBus } from '../../services/socketService'
import StatusBadge from '../../components/common/StatusBadge'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import SmartMap from '../../components/map/SmartMap'
import BusMarker from '../../components/map/BusMarker'
import { QRCodeSVG } from 'qrcode.react'

export default function PassengerBookings() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading]   = useState(true)
  const [tracking, setTracking] = useState(null) // bus being tracked
  const [busLoc, setBusLoc]     = useState({})

  useEffect(() => {
    api.get('/bookings/me')
      .then(r => {
        const bks = (r.data.bookings || []).filter(b => b.booking_type === 'PASSENGER')
        setBookings(bks)
        bks.forEach(bk => { if (bk.bus_id) subscribeToBus(bk.bus_id) })
      })
      .finally(() => setLoading(false))

    const socket = getSocket()
    if (socket) {
      socket.on('bus:location', (data) => {
        setBusLoc(prev => ({ ...prev, [data.busId]: data }))
      })
    }
    return () => { getSocket()?.off('bus:location') }
  }, [])

  if (loading) return <LoadingSpinner size="lg" text="Loading tickets…" />

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">My Tickets</h1>
        <Link to="/passenger/book" className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700">
          + Book Seat
        </Link>
      </div>

      {bookings.length === 0 ? (
        <div className="bg-white rounded-xl border shadow-sm p-12 text-center">
          <p className="text-4xl mb-3">🎫</p>
          <p className="text-gray-500 mb-4">No tickets yet</p>
          <Link to="/passenger/book" className="bg-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-purple-700">
            Book Your First Ticket
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map(bk => {
            const live = busLoc[bk.bus_id]
            return (
              <div key={bk.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-800">{bk.bus_number}</p>
                        <StatusBadge type="bus" status={bk.status} size="xs" />
                      </div>
                      <p className="text-sm text-gray-500">{bk.from_stop} → {bk.to_stop}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{bk.seats} seat(s) · {new Date(bk.created_at).toLocaleDateString('en-IN')}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-purple-700 text-lg">₹{bk.estimated_cost}</p>
                      <StatusBadge type="gps" status={live?.gpsStatus || bk.gps_status} size="xs" />
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => setTracking(tracking === bk.id ? null : bk.id)}
                      className="flex-1 text-center bg-purple-100 text-purple-700 text-sm font-medium py-2 rounded-lg hover:bg-purple-200"
                    >
                      {tracking === bk.id ? 'Hide Map' : '📍 Track Bus'}
                    </button>
                    <div className="flex items-center justify-center w-24 bg-gray-50 rounded-lg p-1">
                      <QRCodeSVG value={bk.id} size={56} level="M" />
                    </div>
                  </div>
                </div>

                {tracking === bk.id && (
                  <div className="border-t">
                    <SmartMap
                      center={live ? [live.latitude, live.longitude] : [19.7157, 74.4704]}
                      zoom={12}
                      height="260px"
                      recenter={!!live}
                    >
                      {live && (
                        <BusMarker bus={{
                          id: bk.bus_id,
                          bus_number: bk.bus_number,
                          current_latitude: live.latitude,
                          current_longitude: live.longitude,
                          gps_status: live.gpsStatus,
                          last_gps_update: live.timestamp,
                          status: bk.bus_status || 'IN_TRANSIT',
                          origin: bk.origin,
                          destination: bk.destination,
                          seat_capacity: 50, current_occupancy: 0,
                          cargo_capacity_kg: 500, booked_cargo_kg: 0,
                          available_cargo_kg: 0, available_seats: 0,
                        }} />
                      )}
                    </SmartMap>
                    <div className="p-3 text-xs text-gray-400 text-center">
                      {live
                        ? `Bus location updated ${Math.round((Date.now()-new Date(live.timestamp).getTime())/1000)}s ago`
                        : 'Waiting for live GPS data from driver…'}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
