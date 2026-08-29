import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../../services/api'
import { getSocket, subscribeToBooking, subscribeToBus } from '../../services/socketService'
import SmartMap from '../../components/map/SmartMap'
import BusMarker from '../../components/map/BusMarker'
import StatusBadge from '../../components/common/StatusBadge'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { QRCodeSVG } from 'qrcode.react'

const LIFECYCLE = ['REQUESTED','MATCHED','BOOKED','LOADED','IN_TRANSIT','DELIVERED']

export default function FarmerTrackParcel() {
  const { parcelId } = useParams()
  const [parcel, setParcel] = useState(null)
  const [busLoc, setBusLoc] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')

  const fetchParcel = () => {
    api.get(`/parcels/${parcelId}`)
      .then(r => {
        setParcel(r.data.parcel)
        setBusLoc({
          id: r.data.parcel.bus_id,
          current_latitude: r.data.parcel.current_latitude,
          current_longitude: r.data.parcel.current_longitude,
          gps_status: r.data.parcel.gps_status,
          bus_number: r.data.parcel.bus_number,
          status: r.data.parcel.bus_status,
          last_gps_update: r.data.parcel.last_gps_update,
          origin: r.data.parcel.origin,
          destination: r.data.parcel.destination,
          seat_capacity: 50, current_occupancy: 0,
          cargo_capacity_kg: 500, booked_cargo_kg: 0, available_cargo_kg: 0,
          available_seats: 0,
        })
      })
      .catch(() => setError('Parcel not found'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchParcel()
    const socket = getSocket()
    if (socket) {
      socket.on('bus:location', (data) => {
        setBusLoc(prev => prev ? {
          ...prev,
          current_latitude: data.latitude,
          current_longitude: data.longitude,
          gps_status: data.gpsStatus,
          last_gps_update: data.timestamp,
        } : prev)
      })
      socket.on('parcel:status', (data) => {
        if (data.parcelId === parcelId) fetchParcel()
      })
    }
    return () => {
      socket?.off('bus:location')
      socket?.off('parcel:status')
    }
  }, [parcelId])

  if (loading) return <LoadingSpinner size="lg" text="Loading parcel…" />
  if (error) return (
    <div className="p-8 text-center">
      <p className="text-xl text-red-500">{error}</p>
      <Link to="/farmer/bookings" className="text-amber-600 hover:underline mt-2 block">← My Bookings</Link>
    </div>
  )
  if (!parcel) return null

  const currentStatusIdx = LIFECYCLE.findIndex(s => {
    const lastHistory = parcel.history?.[parcel.history.length - 1]
    return lastHistory?.new_status === s
  })
  const displayStatus = parcel.history?.[parcel.history.length - 1]?.new_status || 'BOOKED'

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Parcel Tracking</h1>
          <p className="text-amber-700 font-mono font-bold text-lg">{parcel.parcel_id}</p>
        </div>
        <Link to="/farmer/bookings" className="text-sm text-amber-600 hover:underline">← My Bookings</Link>
      </div>

      {/* Status lifecycle */}
      <div className="bg-white rounded-xl border shadow-sm p-5">
        <div className="flex items-center justify-between overflow-x-auto gap-1">
          {LIFECYCLE.map((s, i) => {
            const isDone = parcel.history?.some(h => h.new_status === s)
            const isCurrent = s === displayStatus
            return (
              <div key={s} className="flex items-center gap-1 min-w-0">
                <div className={`flex flex-col items-center gap-1 min-w-[64px]`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2
                    ${isDone ? 'bg-green-500 border-green-500 text-white' :
                      isCurrent ? 'bg-amber-500 border-amber-500 text-white' :
                      'bg-white border-gray-200 text-gray-300'}`}>
                    {isDone ? '✓' : i + 1}
                  </div>
                  <p className={`text-xs text-center font-medium
                    ${isCurrent ? 'text-amber-700' : isDone ? 'text-green-600' : 'text-gray-300'}`}>
                    {s.replace('_',' ')}
                  </p>
                </div>
                {i < LIFECYCLE.length - 1 && (
                  <div className={`h-0.5 flex-1 min-w-4 mt-[-14px]
                    ${isDone ? 'bg-green-400' : 'bg-gray-200'}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Details */}
        <div className="bg-white rounded-xl border shadow-sm p-5 space-y-3">
          <h2 className="font-bold text-gray-800">Parcel Details</h2>
          <div className="text-sm space-y-2">
            {[
              ['Goods', parcel.goods_type],
              ['Weight', `${parcel.weight_kg} kg`],
              ['From', parcel.from_stop],
              ['To', parcel.to_stop],
              ['Bus', parcel.bus_number],
              ['Bus Status', parcel.bus_status],
              ['GPS', parcel.gps_status],
              ['Urgency', parcel.urgency],
              ['Booked', new Date(parcel.created_at).toLocaleString('en-IN')],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-gray-500">{k}</span>
                <span className="font-medium">{v}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center pt-3 border-t gap-2">
            <QRCodeSVG value={parcel.parcel_id} size={120} level="H" />
            <p className="text-xs font-mono text-amber-700">{parcel.parcel_id}</p>
          </div>
        </div>

        {/* Map + history */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <h2 className="font-bold text-gray-800 mb-2">Live Bus Location</h2>
            <SmartMap
              center={busLoc?.current_latitude
                ? [busLoc.current_latitude, busLoc.current_longitude]
                : [19.7157, 74.4704]}
              zoom={11}
              height="240px"
              recenter={!!busLoc?.current_latitude}
            >
              {busLoc?.current_latitude && <BusMarker bus={busLoc} />}
            </SmartMap>
            {busLoc?.last_gps_update && (
              <p className="text-xs text-gray-400 mt-1 text-center">
                Last GPS update: {Math.round((Date.now() - new Date(busLoc.last_gps_update).getTime()) / 1000)}s ago
              </p>
            )}
          </div>

          {/* Status history */}
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <h2 className="font-bold text-gray-800 mb-3">Status History</h2>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {(parcel.history || []).map((h, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <div className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold shrink-0">
                    ✓
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{h.new_status}</p>
                    <p className="text-xs text-gray-400">
                      {h.updated_by_name} · {new Date(h.timestamp).toLocaleString('en-IN')}
                      {h.actual_weight_kg && ` · ${h.actual_weight_kg}kg actual`}
                    </p>
                  </div>
                </div>
              ))}
              {(!parcel.history || parcel.history.length === 0) && (
                <p className="text-gray-400 text-sm text-center py-3">No history yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
