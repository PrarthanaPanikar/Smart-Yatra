import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import { getSocket, subscribeToAllBuses } from '../../services/socketService'
import SmartMap from '../../components/map/SmartMap'
import BusMarker from '../../components/map/BusMarker'
import StatusBadge from '../../components/common/StatusBadge'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const StatCard = ({ label, value, sub, colour }) => (
  <div className={`rounded-xl p-5 border ${colour}`}>
    <p className="text-sm font-medium text-gray-500">{label}</p>
    <p className="text-3xl font-bold mt-1">{value ?? '—'}</p>
    {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
  </div>
)

export default function AdminDashboard() {
  const [stats, setStats]   = useState(null)
  const [buses, setBuses]   = useState([])
  const [reports, setReports] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [passengerReportCount, setPassengerReportCount] = useState(0)

  const fetchData = useCallback(async () => {
    try {
      const [dashRes, busRes, infoStatsRes] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/admin/buses'),
        api.get('/reports/stats').catch(() => ({ data: { stats: { pending: 0 } } })),
      ])
      setStats(dashRes.data)
      setBuses(busRes.data.buses || [])
      setReports(dashRes.data.pendingReports || [])
      setPassengerReportCount(infoStatsRes.data.stats?.pending ?? 0)
    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    subscribeToAllBuses()

    const socket = getSocket()
    if (socket) {
      socket.on('bus:location', (data) => {
        setBuses(prev => prev.map(b =>
          b.id === data.busId
            ? { ...b, current_latitude: data.latitude, current_longitude: data.longitude,
                gps_status: data.gpsStatus, last_gps_update: data.timestamp,
                gps_speed: data.speed }
            : b
        ))
      })
      socket.on('bus:occupancy', (data) => {
        setBuses(prev => prev.map(b =>
          b.id === data.busId
            ? { ...b, current_occupancy: data.currentOccupancy,
                booked_cargo_kg: data.bookedCargoKg ?? b.booked_cargo_kg }
            : b
        ))
      })
      socket.on('bus:status', (data) => {
        setBuses(prev => prev.map(b =>
          b.id === data.busId ? { ...b, status: data.status } : b
        ))
      })
      socket.on('driver:report', (report) => {
        setReports(prev => [report, ...prev.slice(0, 4)])
        fetchData()
      })
      // Challenge #2 — new passenger info reports
      socket.on('passenger:report', () => {
        setPassengerReportCount(n => n + 1)
      })
    }

    return () => {
      socket?.off('bus:location')
      socket?.off('bus:occupancy')
      socket?.off('bus:status')
      socket?.off('driver:report')
      socket?.off('passenger:report')
    }
  }, [fetchData])

  const acknowledgeReport = async (id) => {
    try {
      await api.put(`/admin/reports/${id}/acknowledge`)
      setReports(prev => prev.filter(r => r.id !== id))
    } catch (err) { console.error(err) }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" text="Loading dashboard…" /></div>

  const gpsConnected = buses.filter(b => b.gps_status === 'CONNECTED').length
  const gpsSimulation = buses.filter(b => b.gps_status === 'SIMULATION').length
  const gpsOffline = buses.filter(b => ['OFFLINE','STALE'].includes(b.gps_status)).length

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Fleet Overview</h1>
        <span className="text-xs text-gray-400">Live · updates without refresh</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Buses" value={stats?.buses?.total}
          colour="bg-blue-50 border-blue-100" />
        <StatCard label="In Transit" value={stats?.buses?.running}
          colour="bg-green-50 border-green-100" />
        <StatCard label="GPS Connected" value={gpsConnected + gpsSimulation}
          sub={`${gpsSimulation} simulation`}
          colour="bg-emerald-50 border-emerald-100" />
        <StatCard label="Breakdowns" value={stats?.buses?.breakdown}
          colour="bg-red-50 border-red-100" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Today Bookings" value={stats?.bookings?.total_bookings}
          colour="bg-purple-50 border-purple-100" />
        <StatCard label="Passenger Bookings" value={stats?.bookings?.passenger_bookings}
          colour="bg-indigo-50 border-indigo-100" />
        <StatCard label="Cargo Bookings" value={stats?.bookings?.cargo_bookings}
          colour="bg-amber-50 border-amber-100" />
        <StatCard label="Revenue (Est.)" value={stats?.bookings?.total_revenue ? `₹${Math.round(stats.bookings.total_revenue)}` : '₹0'}
          sub="Demo estimates only"
          colour="bg-teal-50 border-teal-100" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Live Map */}
        <div className="xl:col-span-2 bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-800">Live Fleet Map</h2>
            <div className="flex gap-2 text-xs">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>Connected</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block"></span>Stale</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>Offline</span>
            </div>
          </div>
          <SmartMap height="420px" zoom={10}>
            {buses.map(b => (
              <BusMarker key={b.id} bus={b} onClick={setSelected} />
            ))}
          </SmartMap>
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          {/* Selected bus details */}
          {selected && (
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-800">{selected.bus_number}</h3>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
              </div>
              <p className="text-sm text-gray-500 mb-3">{selected.route_name}</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <StatusBadge type="bus" status={selected.status} size="xs" />
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">GPS</span>
                  <StatusBadge type="gps" status={selected.gps_status} size="xs" />
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Seats</span>
                  <span className="font-medium">{selected.current_occupancy}/{selected.seat_capacity}
                    <span className="text-green-600 ml-1">({selected.available_seats} free)</span>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Cargo</span>
                  <span className="font-medium">
                    {parseFloat(selected.booked_cargo_kg||0).toFixed(0)}/{parseFloat(selected.cargo_capacity_kg||0).toFixed(0)} kg
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Driver</span>
                  <span className="font-medium text-right">{selected.driver_name || 'Not assigned'}</span>
                </div>
                {selected.last_gps_update && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Last GPS</span>
                    <span className="font-medium">
                      {Math.round((Date.now() - new Date(selected.last_gps_update).getTime()) / 1000)}s ago
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Buses list */}
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <h3 className="font-bold text-gray-800 mb-3">All Buses</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {buses.map(b => (
                <button key={b.id} onClick={() => setSelected(b)}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 text-left transition-colors">
                  <div>
                    <p className="font-semibold text-sm">{b.bus_number}</p>
                    <p className="text-xs text-gray-500">{b.origin} → {b.destination}</p>
                  </div>
                  <StatusBadge type="gps" status={b.gps_status} size="xs" />
                </button>
              ))}
            </div>
          </div>

          {/* Pending driver reports */}
          {reports.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <h3 className="font-bold text-red-700 mb-3">⚠ Pending Reports</h3>
              <div className="space-y-2">
                {reports.map(r => (
                  <div key={r.id} className="bg-red-50 rounded-lg p-3 text-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">{r.bus_number} — {r.report_type}</p>
                        <p className="text-xs text-gray-500">{r.driver_name}</p>
                        {r.message && <p className="text-xs text-gray-600 mt-1">{r.message}</p>}
                      </div>
                      <button
                        onClick={() => acknowledgeReport(r.id)}
                        className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 ml-2 shrink-0"
                      >
                        ACK
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Challenge #2 — Passenger Information Reports alert */}
          <div className={`rounded-xl border p-4 ${passengerReportCount > 0 ? 'bg-yellow-50 border-yellow-300' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className={`font-bold text-sm ${passengerReportCount > 0 ? 'text-yellow-800' : 'text-gray-700'}`}>
                📢 Information Verification
              </h3>
              {passengerReportCount > 0 && (
                <span className="bg-yellow-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {passengerReportCount} pending
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mb-3">
              {passengerReportCount > 0
                ? `${passengerReportCount} passenger report(s) awaiting verification`
                : 'No pending passenger reports'}
            </p>
            <Link to="/admin/verification"
              className={`block w-full text-center text-xs font-semibold py-2 rounded-lg transition-colors
                ${passengerReportCount > 0
                  ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
              {passengerReportCount > 0 ? '🔍 Review Reports' : 'View Verification Panel'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
