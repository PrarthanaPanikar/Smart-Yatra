import { useState, useEffect } from 'react'
import api from '../../services/api'
import StatusBadge from '../../components/common/StatusBadge'
import LoadingSpinner from '../../components/common/LoadingSpinner'

export default function DriverCargo() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading]   = useState(true)
  const [loadForms, setLoadForms] = useState({})
  const [messages, setMessages]  = useState({})

  useEffect(() => {
    api.get('/driver/bookings')
      .then(r => setBookings((r.data.bookings || []).filter(b => b.booking_type === 'CARGO')))
      .finally(() => setLoading(false))
  }, [])

  const handleLoad = async (bookingId) => {
    const form = loadForms[bookingId] || {}
    try {
      const res = await api.post(`/driver/parcel/${bookingId}/load`, {
        actualWeightKg: form.actualWeight,
        notes: form.notes,
      })
      setMessages(prev => ({
        ...prev,
        [bookingId]: res.data.mismatchWarning || `✅ Loaded: ${res.data.actualWeightKg}kg`,
      }))
      setBookings(prev => prev.map(b =>
        b.id === bookingId ? { ...b, loaded: true } : b
      ))
    } catch (err) {
      setMessages(prev => ({
        ...prev,
        [bookingId]: `❌ ${err.response?.data?.error || 'Failed to mark loaded'}`,
      }))
    }
  }

  if (loading) return <LoadingSpinner size="lg" text="Loading cargo…" />

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Today's Cargo</h1>

      {bookings.length === 0 ? (
        <div className="bg-white rounded-xl border shadow-sm p-12 text-center">
          <p className="text-4xl mb-3">📦</p>
          <p className="text-gray-500">No cargo bookings for today</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map(bk => (
            <div key={bk.id} className="bg-white rounded-xl border shadow-sm p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-bold text-amber-700">{bk.parcel_id}</span>
                    <StatusBadge type="parcel" status={bk.loaded ? 'LOADED' : 'BOOKED'} size="xs" />
                  </div>
                  <p className="font-semibold text-gray-800">{bk.goods_type}</p>
                  <p className="text-sm text-gray-500">{bk.from_stop} → {bk.to_stop}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    <span className="font-medium">Passenger:</span> {bk.passenger_name} · {bk.passenger_mobile}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-amber-700">{bk.weight_kg} kg</p>
                  <p className="text-xs text-gray-400">booked</p>
                  <p className={`text-xs font-semibold mt-1 ${
                    bk.urgency === 'HIGH' ? 'text-red-600' :
                    bk.urgency === 'MEDIUM' ? 'text-yellow-600' : 'text-gray-500'
                  }`}>{bk.urgency} urgency</p>
                </div>
              </div>

              {!bk.loaded && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-amber-800 mb-3">Mark as Loaded</p>
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className="block text-xs text-amber-700 mb-1">
                        Actual Weight (kg)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        defaultValue={bk.weight_kg}
                        onChange={e => setLoadForms(prev => ({
                          ...prev, [bk.id]: { ...prev[bk.id], actualWeight: e.target.value }
                        }))}
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        placeholder={bk.weight_kg}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-amber-700 mb-1">Notes</label>
                      <input
                        type="text"
                        onChange={e => setLoadForms(prev => ({
                          ...prev, [bk.id]: { ...prev[bk.id], notes: e.target.value }
                        }))}
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        placeholder="Optional"
                      />
                    </div>
                    <button
                      onClick={() => handleLoad(bk.id)}
                      className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700"
                    >
                      ✓ Loaded
                    </button>
                  </div>
                  <p className="text-xs text-amber-600 mt-2">
                    ⚠ Note: Manual weight entry. This is NOT IoT weighing.
                    If actual weight differs significantly from booked weight, a mismatch warning will appear.
                  </p>
                  {messages[bk.id] && (
                    <p className={`text-sm font-medium mt-2 ${
                      messages[bk.id].includes('⚠') ? 'text-orange-600' :
                      messages[bk.id].includes('❌') ? 'text-red-600' : 'text-green-600'
                    }`}>{messages[bk.id]}</p>
                  )}
                </div>
              )}

              {bk.loaded && messages[bk.id] && (
                <p className="text-sm font-medium text-green-600">{messages[bk.id]}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
