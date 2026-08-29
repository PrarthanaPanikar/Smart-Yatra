import { useState, useEffect } from 'react'
import api from '../../services/api'
import StatusBadge from '../../components/common/StatusBadge'
import LoadingSpinner from '../../components/common/LoadingSpinner'

export default function AdminBookings() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading]   = useState(true)
  const [type, setType]         = useState('all')

  useEffect(() => {
    const params = type !== 'all' ? `?type=${type}` : ''
    api.get(`/admin/bookings${params}`)
      .then(r => setBookings(r.data.bookings || []))
      .finally(() => setLoading(false))
  }, [type])

  if (loading) return <LoadingSpinner size="lg" text="Loading bookings…" />

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">All Bookings</h1>
        <div className="flex gap-2">
          {['all','PASSENGER','CARGO'].map(t => (
            <button key={t} onClick={() => setType(t)}
              className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors
                ${type === t ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
              {t === 'all' ? 'All' : t}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['#','Type','Passenger/Farmer','Bus','From → To','Details','Cost','Status','Date'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bookings.map((bk, i) => (
                <tr key={bk.id} className={`border-b hover:bg-gray-50 ${i%2===0?'':'bg-gray-50/30'}`}>
                  <td className="px-4 py-3 text-xs text-gray-400 font-mono">{bk.parcel_id || bk.id.slice(0,8)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                      ${bk.booking_type==='CARGO' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                      {bk.booking_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">{bk.user_name}</td>
                  <td className="px-4 py-3 font-bold text-blue-700">{bk.bus_number}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{bk.from_stop} → {bk.to_stop}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {bk.booking_type === 'CARGO'
                      ? `${bk.goods_type} · ${bk.weight_kg}kg · ${bk.urgency}`
                      : `${bk.seats} seat(s)`}
                  </td>
                  <td className="px-4 py-3 font-medium">₹{bk.estimated_cost}</td>
                  <td className="px-4 py-3"><StatusBadge type="bus" status={bk.status} size="xs" /></td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(bk.created_at).toLocaleDateString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {bookings.length === 0 && (
            <div className="text-center py-12 text-gray-400">No bookings found</div>
          )}
        </div>
      </div>
    </div>
  )
}
