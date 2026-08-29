import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import StatusBadge from '../../components/common/StatusBadge'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const REPORT_TYPES = [
  'BREAKDOWN','ACCIDENT','MEDICAL_EMERGENCY','ROUTE_DELAY',
  'UNSCHEDULED_STOP','BUS_CANCELLED','PASSENGER_BOARDING','OTHER',
]

export default function DriverDashboard() {
  const [bus, setBus]         = useState(null)
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [occupancyForm, setOccupancyForm] = useState({ boarded: 0, exited: 0, stopName: '' })
  const [reportForm, setReportForm] = useState({ reportType: '', message: '' })
  const [reportMsg, setReportMsg] = useState('')
  const [occupancyMsg, setOccupancyMsg] = useState('')

  useEffect(() => {
    Promise.all([api.get('/driver/bus'), api.get('/driver/bookings')])
      .then(([busRes, bkRes]) => {
        setBus(busRes.data.bus)
        setBookings(bkRes.data.bookings || [])
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  const updateOccupancy = async (e) => {
    e.preventDefault()
    try {
      const res = await api.post('/driver/occupancy', occupancyForm)
      setBus(prev => ({ ...prev, current_occupancy: res.data.currentOccupancy,
        available_seats: res.data.availableSeats }))
      setOccupancyMsg(`✅ Updated: ${res.data.currentOccupancy}/${bus.seat_capacity} passengers`)
      setOccupancyForm({ boarded: 0, exited: 0, stopName: '' })
    } catch (err) {
      setOccupancyMsg('❌ Failed to update')
    }
  }

  const submitReport = async (e) => {
    e.preventDefault()
    if (!reportForm.reportType) return
    try {
      await api.post('/driver/report', {
        reportType: reportForm.reportType,
        message: reportForm.message,
        latitude: null, longitude: null,
      })
      setReportMsg('✅ Report submitted and admin notified')
      setReportForm({ reportType: '', message: '' })
    } catch (err) {
      setReportMsg('❌ Failed to submit report')
    }
  }

  if (loading) return <LoadingSpinner size="lg" text="Loading driver dashboard…" />

  if (!bus) return (
    <div className="p-8 text-center">
      <p className="text-xl text-gray-500">No bus assigned to your account.</p>
      <p className="text-gray-400 mt-1">Contact admin to get a bus assignment.</p>
    </div>
  )

  const availableCargo = parseFloat(bus.cargo_capacity_kg) - parseFloat(bus.booked_cargo_kg)

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-6">
      {/* Bus header */}
      <div className="bg-gradient-to-r from-green-700 to-green-600 text-white rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold">{bus.bus_number}</h1>
            <p className="text-green-100 text-lg">{bus.route_name}</p>
          </div>
          <div className="text-right space-y-1">
            <StatusBadge type="bus" status={bus.status} />
            <br />
            <StatusBadge type="gps" status={bus.gps_status} />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Passengers', value: `${bus.current_occupancy}/${bus.seat_capacity}`, sub: `${bus.seat_capacity - bus.current_occupancy} seats free` },
            { label: 'Cargo Booked', value: `${parseFloat(bus.booked_cargo_kg).toFixed(0)} kg`, sub: `${availableCargo.toFixed(0)} kg available` },
            { label: 'Departure', value: bus.departure_time || '—', sub: 'Scheduled' },
            { label: 'GPS Status', value: bus.gps_status, sub: bus.last_gps_update ? `${Math.round((Date.now() - new Date(bus.last_gps_update).getTime())/1000)}s ago` : 'No fix' },
          ].map(s => (
            <div key={s.label} className="bg-white/10 rounded-lg p-3">
              <p className="text-xs text-green-200">{s.label}</p>
              <p className="font-bold text-lg">{s.value}</p>
              <p className="text-xs text-green-200">{s.sub}</p>
            </div>
          ))}
        </div>

        <Link to="/driver/gps"
          className="mt-4 inline-flex items-center gap-2 bg-white text-green-700 font-bold px-6 py-3 rounded-xl hover:bg-green-50 transition-colors">
          📡 Open GPS Tracker
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Occupancy update */}
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-4">Update Passenger Count at Stop</h2>
          <form onSubmit={updateOccupancy} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Stop Name</label>
              <input type="text" value={occupancyForm.stopName}
                onChange={e => setOccupancyForm(p => ({ ...p, stopName: e.target.value }))}
                placeholder="e.g. Kopargaon Bus Stand"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-green-700 mb-1">Boarded +</label>
                <input type="number" min="0" value={occupancyForm.boarded}
                  onChange={e => setOccupancyForm(p => ({ ...p, boarded: parseInt(e.target.value)||0 }))}
                  className="w-full border-2 border-green-200 rounded-lg px-3 py-2 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-red-600 mb-1">Exited −</label>
                <input type="number" min="0" value={occupancyForm.exited}
                  onChange={e => setOccupancyForm(p => ({ ...p, exited: parseInt(e.target.value)||0 }))}
                  className="w-full border-2 border-red-200 rounded-lg px-3 py-2 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
            </div>
            <button type="submit" className="w-full bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700">
              Update Occupancy
            </button>
            {occupancyMsg && <p className="text-sm text-center">{occupancyMsg}</p>}
          </form>
        </div>

        {/* Report */}
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-4">Submit Report</h2>
          <form onSubmit={submitReport} className="space-y-3">
            <select value={reportForm.reportType}
              onChange={e => setReportForm(p => ({ ...p, reportType: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              required>
              <option value="">Select report type</option>
              {REPORT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
            </select>
            <textarea value={reportForm.message}
              onChange={e => setReportForm(p => ({ ...p, message: e.target.value }))}
              placeholder="Optional details…"
              rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
            <button type="submit" className="w-full bg-red-600 text-white py-2 rounded-lg font-medium hover:bg-red-700">
              Submit Report → Admin
            </button>
            {reportMsg && <p className="text-sm text-center">{reportMsg}</p>}
          </form>
        </div>
      </div>

      {/* Today's bookings */}
      <div className="bg-white rounded-xl border shadow-sm p-5">
        <h2 className="font-bold text-gray-800 mb-4">Today's Bookings ({bookings.length})</h2>
        {bookings.length === 0 ? (
          <p className="text-gray-400 text-center py-6">No bookings for today</p>
        ) : (
          <div className="space-y-2">
            {bookings.map(bk => (
              <div key={bk.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                      ${bk.booking_type==='CARGO' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                      {bk.booking_type}
                    </span>
                    {bk.parcel_id && <span className="text-xs font-mono text-gray-500">{bk.parcel_id}</span>}
                  </div>
                  <p className="font-medium text-sm mt-1">{bk.passenger_name}</p>
                  <p className="text-xs text-gray-500">{bk.from_stop} → {bk.to_stop}</p>
                  {bk.booking_type === 'CARGO' && (
                    <p className="text-xs text-amber-700">{bk.goods_type} · {bk.weight_kg}kg · {bk.urgency}</p>
                  )}
                </div>
                <div className="text-right">
                  {bk.booking_type === 'PASSENGER'
                    ? <p className="font-bold text-blue-700">{bk.seats} seat(s)</p>
                    : <Link to={`/driver/cargo`}
                        className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-lg hover:bg-amber-200 font-medium">
                        Manage
                      </Link>
                  }
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
