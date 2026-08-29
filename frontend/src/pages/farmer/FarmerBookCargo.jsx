import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../services/api'
import useDeviceLocation from '../../hooks/useDeviceLocation'
import { QRCodeSVG } from 'qrcode.react'
import SmartMap from '../../components/map/SmartMap'
import BusMarker from '../../components/map/BusMarker'
import UserMarker from '../../components/map/UserMarker'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const GOODS = ['Tomatoes','Onion','Wheat','Sugarcane','Milk','Vegetables','Fertilizer','Seeds','Other']
const URGENCY = ['LOW','MEDIUM','HIGH']
const URGENCY_SURCHARGE = { LOW: 0, MEDIUM: 15, HIGH: 30 }

const STEPS = ['Find Buses','Select Bus','Confirm Booking','Booking Confirmed']

export default function FarmerBookCargo() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { location, requestLocation, loading: locLoading } = useDeviceLocation()

  const [step, setStep]         = useState(0)
  const [form, setForm]         = useState({
    origin: '', destination: '', goodsType: 'Tomatoes',
    weightKg: '', urgency: 'LOW', specialInstructions: '',
  })
  const [buses, setBuses]       = useState([])
  const [selectedBus, setSelectedBus] = useState(null)
  const [booking, setBooking]   = useState(null)
  const [searching, setSearching] = useState(false)
  const [booking_loading, setBookingLoading] = useState(false)
  const [error, setError]       = useState('')

  // Pre-select bus if passed via URL
  useEffect(() => {
    const busId = searchParams.get('busId')
    if (busId && step === 0) {
      api.get(`/buses/${busId}`).then(r => {
        setSelectedBus(r.data.bus)
        setStep(1)
      }).catch(() => {})
    }
  }, [])

  const searchBuses = async () => {
    if (!form.origin || !form.destination || !form.weightKg) {
      setError('Please fill origin, destination, and weight')
      return
    }
    setError('')
    setSearching(true)
    try {
      const params = new URLSearchParams({
        origin: form.origin,
        destination: form.destination,
        weightKg: form.weightKg,
        urgency: form.urgency,
        ...(location ? { lat: location.lat, lng: location.lng } : {}),
      })
      const res = await api.get(`/buses/recommend?${params}`)
      setBuses(res.data.buses || [])
      setStep(1)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to find buses')
    } finally {
      setSearching(false)
    }
  }

  const selectBus = (bus) => {
    setSelectedBus(bus)
    setStep(2)
  }

  const confirmBooking = async () => {
    setError('')
    setBookingLoading(true)
    try {
      const res = await api.post('/bookings', {
        busId: selectedBus.id,
        bookingType: 'CARGO',
        fromStop: form.origin,
        toStop: form.destination,
        goodsType: form.goodsType,
        weightKg: parseFloat(form.weightKg),
        urgency: form.urgency,
        specialInstructions: form.specialInstructions,
      })
      setBooking(res.data.booking)
      setStep(3)
    } catch (err) {
      setError(err.response?.data?.error || 'Booking failed')
    } finally {
      setBookingLoading(false)
    }
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2 whitespace-nowrap">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold
              ${i < step ? 'bg-green-500 text-white' :
                i === step ? 'bg-amber-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
              {i < step ? '✓' : i + 1}
            </div>
            <span className={`text-sm font-medium ${i === step ? 'text-amber-700' : 'text-gray-400'}`}>{s}</span>
            {i < STEPS.length - 1 && <span className="text-gray-300">›</span>}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Step 0: Search form */}
      {step === 0 && (
        <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
          <h2 className="text-xl font-bold text-gray-800">Find Available Buses</h2>

          {/* Location */}
          <div className={`p-3 rounded-lg text-sm ${location ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
            {location
              ? <span className="text-green-700">📍 Location: {location.lat.toFixed(4)}, {location.lng.toFixed(4)} · ±{Math.round(location.accuracy)}m</span>
              : <button onClick={requestLocation} className="text-amber-700 underline">
                  {locLoading ? 'Getting location…' : '📍 Share your location for better recommendations'}
                </button>
            }
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Location *</label>
              <input value={form.origin} onChange={e => f('origin', e.target.value)}
                placeholder="e.g. Kopargaon" required
                className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Destination *</label>
              <input value={form.destination} onChange={e => f('destination', e.target.value)}
                placeholder="e.g. Nashik" required
                className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Goods Type</label>
              <select value={form.goodsType} onChange={e => f('goodsType', e.target.value)}
                className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                {GOODS.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg) *</label>
              <input type="number" min="1" step="0.1" value={form.weightKg}
                onChange={e => f('weightKg', e.target.value)}
                placeholder="e.g. 40"
                className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Urgency</label>
              <div className="flex gap-2">
                {URGENCY.map(u => (
                  <button key={u} type="button" onClick={() => f('urgency', u)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors
                      ${form.urgency === u
                        ? u === 'HIGH' ? 'bg-red-600 text-white border-red-600'
                          : u === 'MEDIUM' ? 'bg-yellow-500 text-white border-yellow-500'
                          : 'bg-green-600 text-white border-green-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                    {u}
                    {URGENCY_SURCHARGE[u] > 0 && <span className="text-xs opacity-80"> +{URGENCY_SURCHARGE[u]}%</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button onClick={searchBuses} disabled={searching}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-4 rounded-xl text-lg transition-colors disabled:opacity-50">
            {searching ? <LoadingSpinner size="sm" /> : '🔍 Find Available Buses'}
          </button>
        </div>
      )}

      {/* Step 1: Bus selection */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">
              {buses.length > 0 ? `${buses.length} Recommended Bus(es)` : 'Select Bus'}
            </h2>
            <button onClick={() => setStep(0)} className="text-sm text-amber-600 hover:underline">← Change search</button>
          </div>

          {buses.length === 0 ? (
            <div className="bg-white rounded-xl border shadow-sm p-8 text-center">
              <p className="text-gray-500">No buses match your criteria. Try different origin/destination.</p>
            </div>
          ) : buses.map((bus) => (
            <div key={bus.id} className="bg-white rounded-xl border shadow-sm p-5 hover:border-amber-300 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-xl text-gray-800">{bus.bus_number}</span>
                    {bus.score && (
                      <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                        {bus.score}/100 match
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600">{bus.origin} → {bus.destination}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-amber-700">₹{bus.estimated_cost}</p>
                  <p className="text-xs text-gray-400">Estimated fare</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="bg-green-50 rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-400">Available Cargo</p>
                  <p className="font-bold text-green-700">{parseFloat(bus.available_cargo_kg).toFixed(0)} kg</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-400">ETA (est.)</p>
                  <p className="font-bold text-blue-700">{bus.eta_hours}h</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-400">Departs</p>
                  <p className="font-bold">{bus.departure_time || 'See sched.'}</p>
                </div>
              </div>

              {bus.reasons?.length > 0 && (
                <div className="bg-amber-50 rounded-lg p-3 mb-3">
                  <p className="text-xs font-semibold text-amber-700 mb-1">Why this bus?</p>
                  {bus.reasons.map((r, i) => (
                    <p key={i} className="text-xs text-amber-600">✓ {r}</p>
                  ))}
                </div>
              )}

              <button onClick={() => selectBus(bus)}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-xl transition-colors">
                Select This Bus → Book {form.weightKg}kg
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Step 2: Confirm */}
      {step === 2 && selectedBus && (
        <div className="bg-white rounded-xl border shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">Confirm Booking</h2>
            <button onClick={() => setStep(1)} className="text-sm text-amber-600 hover:underline">← Change bus</button>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2 text-sm">
            {[
              ['Bus', selectedBus.bus_number],
              ['Route', `${selectedBus.origin} → ${selectedBus.destination}`],
              ['Pickup', form.origin],
              ['Destination', form.destination],
              ['Goods', form.goodsType],
              ['Weight', `${form.weightKg} kg`],
              ['Urgency', form.urgency],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-gray-500">{k}</span>
                <span className="font-semibold">{v}</span>
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between">
              <span className="text-gray-500">Estimated Fare</span>
              <span className="font-bold text-amber-700 text-lg">
                ₹{selectedBus.estimated_cost || '—'}
              </span>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
            💳 Demo Payment — In this prototype, payment is auto-completed for demonstration purposes.
            No real transaction occurs.
          </div>

          <button onClick={confirmBooking} disabled={booking_loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl text-lg transition-colors disabled:opacity-50">
            {booking_loading ? 'Processing…' : '✅ Confirm & Pay (Demo)'}
          </button>
        </div>
      )}

      {/* Step 3: Confirmed */}
      {step === 3 && booking && (
        <div className="bg-white rounded-xl border shadow-sm p-6 space-y-5 text-center">
          <div className="text-5xl">🎉</div>
          <h2 className="text-2xl font-bold text-green-700">Booking Confirmed!</h2>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-left space-y-1">
            {[
              ['Parcel ID', booking.parcel_id],
              ['Goods', booking.goods_type],
              ['Weight', `${booking.weight_kg} kg`],
              ['From', booking.from_stop],
              ['To', booking.to_stop],
              ['Cost (est.)', `₹${booking.estimated_cost}`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-gray-500">{k}</span>
                <span className="font-semibold">{v}</span>
              </div>
            ))}
          </div>

          {/* QR Code */}
          {booking.qr_code ? (
            <div className="flex flex-col items-center gap-3">
              <p className="font-semibold text-gray-700">Parcel QR Code</p>
              <img src={booking.qr_code} alt="QR Code" className="w-48 h-48 border rounded-xl p-2" />
              <p className="font-mono font-bold text-xl text-amber-700">{booking.parcel_id}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <p className="font-semibold text-gray-700">Parcel QR Code</p>
              <QRCodeSVG
                value={booking.parcel_id || 'SMARTYATRA'}
                size={180}
                level="H"
              />
              <p className="font-mono font-bold text-xl text-amber-700">{booking.parcel_id}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => navigate(`/farmer/track/${booking.parcel_id}`)}
              className="flex-1 bg-amber-600 text-white font-bold py-3 rounded-xl hover:bg-amber-700">
              📍 Track Parcel
            </button>
            <button onClick={() => { setStep(0); setForm({ origin:'',destination:'',goodsType:'Tomatoes',weightKg:'',urgency:'LOW',specialInstructions:'' }); setBuses([]); setSelectedBus(null); setBooking(null) }}
              className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-200">
              Book Another
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
