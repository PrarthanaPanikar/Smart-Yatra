import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../services/api'
import useDeviceLocation from '../../hooks/useDeviceLocation'
import { QRCodeSVG } from 'qrcode.react'
import SmartMap from '../../components/map/SmartMap'
import BusMarker from '../../components/map/BusMarker'
import UserMarker from '../../components/map/UserMarker'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import StatusBadge from '../../components/common/StatusBadge'

const STEPS = ['Search','Select Bus','Confirm','Ticket']

export default function PassengerBookSeat() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { location, requestLocation } = useDeviceLocation()

  const [step, setStep]       = useState(0)
  const [form, setForm]       = useState({ origin: '', destination: '', seats: 1 })
  const [buses, setBuses]     = useState([])
  const [selectedBus, setSelectedBus] = useState(null)
  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    const busId = searchParams.get('busId')
    if (busId) {
      api.get(`/buses/${busId}`).then(r => {
        setSelectedBus(r.data.bus)
        setStep(1)
      }).catch(() => {})
    }
  }, [])

  const searchBuses = async () => {
    if (!form.origin || !form.destination) { setError('Enter origin and destination'); return }
    setError('')
    setLoading(true)
    try {
      const params = new URLSearchParams({ origin: form.origin, destination: form.destination })
      const res = await api.get(`/buses/search?${params}`)
      setBuses(res.data.buses || [])
      setStep(1)
    } catch (err) {
      setError(err.response?.data?.error || 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  const confirmBooking = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/bookings', {
        busId: selectedBus.id,
        bookingType: 'PASSENGER',
        fromStop: form.origin || selectedBus.origin,
        toStop: form.destination || selectedBus.destination,
        seats: parseInt(form.seats),
      })
      setBooking(res.data.booking)
      setStep(3)
    } catch (err) {
      setError(err.response?.data?.error || 'Booking failed')
    } finally {
      setLoading(false)
    }
  }

  const fare = selectedBus
    ? Math.round(10 + (parseFloat(selectedBus.distance_km) || 50) * 0.5) * (parseInt(form.seats) || 1)
    : 0

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold
              ${i < step ? 'bg-green-500 text-white' :
                i === step ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
              {i < step ? '✓' : i+1}
            </div>
            <span className={`text-sm ${i === step ? 'text-purple-700 font-medium' : 'text-gray-400'}`}>{s}</span>
            {i < STEPS.length-1 && <span className="text-gray-300">›</span>}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm">{error}</div>
      )}

      {step === 0 && (
        <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
          <h2 className="text-xl font-bold text-gray-800">Search Buses</h2>
          {location ? (
            <p className="text-xs text-purple-600">📍 Location: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}</p>
          ) : (
            <button onClick={requestLocation} className="text-xs text-purple-600 underline">📍 Share location for better results</button>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From *</label>
              <input value={form.origin} onChange={e => setForm(p => ({...p, origin: e.target.value}))}
                placeholder="e.g. Kopargaon" required
                className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To *</label>
              <input value={form.destination} onChange={e => setForm(p => ({...p, destination: e.target.value}))}
                placeholder="e.g. Nashik" required
                className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Number of Seats</label>
              <input type="number" min="1" max="10" value={form.seats}
                onChange={e => setForm(p => ({...p, seats: e.target.value}))}
                className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
          </div>
          <button onClick={searchBuses} disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 rounded-xl text-lg disabled:opacity-50">
            {loading ? <LoadingSpinner size="sm" /> : '🔍 Search Buses'}
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">Available Buses</h2>
            <button onClick={() => setStep(0)} className="text-sm text-purple-600 hover:underline">← Search</button>
          </div>
          {buses.length === 0 ? (
            <div className="bg-white rounded-xl border p-8 text-center text-gray-500">
              No buses found. Try different origin/destination.
            </div>
          ) : buses.map(b => (
            <div key={b.id} className="bg-white rounded-xl border shadow-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold text-xl text-gray-800">{b.bus_number}</p>
                  <p className="text-gray-500">{b.origin} → {b.destination}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge type="bus" status={b.status} size="xs" />
                  <StatusBadge type="gps" status={b.gps_status} size="xs" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="bg-purple-50 rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-400">Seats Free</p>
                  <p className="font-bold text-purple-700">{b.available_seats}/{b.seat_capacity}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-400">Departs</p>
                  <p className="font-bold text-blue-700">{b.departure_time || '—'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-400">Est. Fare/seat</p>
                  <p className="font-bold">₹{Math.round(10 + (parseFloat(b.distance_km)||50)*0.5)}</p>
                </div>
              </div>
              <button
                onClick={() => { setSelectedBus(b); setStep(2) }}
                disabled={b.available_seats < parseInt(form.seats)}
                className="w-full bg-purple-600 text-white font-bold py-3 rounded-xl hover:bg-purple-700 disabled:opacity-40"
              >
                {b.available_seats < parseInt(form.seats)
                  ? `Only ${b.available_seats} seat(s) available`
                  : `Book ${form.seats} Seat(s) →`}
              </button>
            </div>
          ))}
        </div>
      )}

      {step === 2 && selectedBus && (
        <div className="bg-white rounded-xl border shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">Confirm Booking</h2>
            <button onClick={() => setStep(1)} className="text-sm text-purple-600 hover:underline">← Change bus</button>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-2 text-sm">
            {[
              ['Bus', selectedBus.bus_number],
              ['Route', `${selectedBus.origin} → ${selectedBus.destination}`],
              ['From Stop', form.origin || selectedBus.origin],
              ['To Stop', form.destination || selectedBus.destination],
              ['Seats', form.seats],
              ['Estimated Fare', `₹${fare}`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-gray-500">{k}</span>
                <span className="font-semibold">{v}</span>
              </div>
            ))}
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
            💳 Demo Payment — No real transaction. Auto-completed for demonstration.
          </div>
          <button onClick={confirmBooking} disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl text-lg disabled:opacity-50">
            {loading ? 'Processing…' : '✅ Confirm & Pay (Demo)'}
          </button>
        </div>
      )}

      {step === 3 && booking && (
        <div className="bg-white rounded-xl border shadow-sm p-6 space-y-5 text-center">
          <div className="text-5xl">🎫</div>
          <h2 className="text-2xl font-bold text-green-700">Ticket Confirmed!</h2>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-left space-y-2">
            {[
              ['Bus', booking.bus_number || selectedBus?.bus_number],
              ['From', booking.from_stop],
              ['To', booking.to_stop],
              ['Seats', booking.seats],
              ['Fare', `₹${booking.estimated_cost}`],
              ['Status', booking.status],
              ['Booking ID', booking.id?.slice(0,8)+'…'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-gray-500">{k}</span>
                <span className="font-semibold">{v}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center gap-3">
            <p className="text-sm font-semibold text-gray-700">Ticket QR</p>
            <QRCodeSVG value={booking.id || 'TICKET'} size={160} level="H" />
            <p className="text-xs text-gray-400">Show this QR to the conductor</p>
          </div>

          <div className="flex gap-3">
            <button onClick={() => navigate(`/passenger/bookings`)}
              className="flex-1 bg-purple-600 text-white font-bold py-3 rounded-xl hover:bg-purple-700">
              My Tickets
            </button>
            <button onClick={() => { setStep(0); setForm({origin:'',destination:'',seats:1}); setBuses([]); setSelectedBus(null); setBooking(null) }}
              className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-200">
              Book Another
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
