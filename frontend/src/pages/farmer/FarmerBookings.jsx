import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import StatusBadge from '../../components/common/StatusBadge'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { QRCodeSVG } from 'qrcode.react'

export default function FarmerBookings() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    api.get('/bookings/me')
      .then(r => setBookings((r.data.bookings || []).filter(b => b.booking_type === 'CARGO')))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner size="lg" text="Loading bookings…" />

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">My Cargo Bookings</h1>
        <Link to="/farmer/book" className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700">
          + New Booking
        </Link>
      </div>

      {bookings.length === 0 ? (
        <div className="bg-white rounded-xl border shadow-sm p-12 text-center">
          <p className="text-4xl mb-3">📦</p>
          <p className="text-gray-500 mb-4">No cargo bookings yet</p>
          <Link to="/farmer/book" className="bg-amber-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-amber-700">
            Book Your First Cargo
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map(bk => (
            <div key={bk.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
                onClick={() => setExpanded(expanded === bk.id ? null : bk.id)}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-bold text-amber-700">{bk.parcel_id}</span>
                    <StatusBadge type="bus" status={bk.status} size="xs" />
                  </div>
                  <p className="text-sm text-gray-600">{bk.goods_type} · {bk.weight_kg}kg · {bk.from_stop} → {bk.to_stop}</p>
                  <p className="text-xs text-gray-400 mt-0.5">via {bk.bus_number} · {new Date(bk.created_at).toLocaleDateString('en-IN')}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-800">₹{bk.estimated_cost}</p>
                  <p className="text-gray-300 text-lg">{expanded === bk.id ? '▲' : '▼'}</p>
                </div>
              </button>

              {expanded === bk.id && (
                <div className="border-t px-4 py-4 bg-amber-50 flex flex-col md:flex-row gap-4 items-center">
                  <div className="flex-1 text-sm space-y-2">
                    {[
                      ['Bus', bk.bus_number], ['Route', bk.route_name],
                      ['Bus Status', bk.bus_status], ['GPS', bk.gps_status],
                      ['Urgency', bk.urgency], ['Payment', bk.payment_status],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-gray-500">{k}</span>
                        <span className="font-medium">{v}</span>
                      </div>
                    ))}
                    <div className="flex gap-2 pt-2">
                      <Link to={`/farmer/track/${bk.parcel_id}`}
                        className="flex-1 text-center bg-amber-600 text-white text-xs py-2 rounded-lg font-medium hover:bg-amber-700">
                        📍 Track Parcel
                      </Link>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <QRCodeSVG value={bk.parcel_id} size={120} level="H" />
                    <p className="text-xs font-mono text-amber-700">{bk.parcel_id}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
