import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import StatusBadge from '../common/StatusBadge'

const GPS_ICON_COLOUR = {
  CONNECTED:  '#16a34a',
  STALE:      '#d97706',
  OFFLINE:    '#dc2626',
  SIMULATION: '#7c3aed',
}

const createBusIcon = (gpsStatus, busNumber) => {
  const colour = GPS_ICON_COLOUR[gpsStatus] || '#64748b'
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 42 42">
      <circle cx="21" cy="21" r="20" fill="${colour}" opacity="0.15"/>
      <circle cx="21" cy="21" r="14" fill="${colour}"/>
      <text x="21" y="26" text-anchor="middle" font-size="16" fill="white">🚌</text>
    </svg>`
  return L.divIcon({
    className: 'bus-marker-icon',
    html: svg,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    popupAnchor: [0, -22],
  })
}

export default function BusMarker({ bus, onClick }) {
  if (!bus.current_latitude || !bus.current_longitude) return null

  const icon = createBusIcon(bus.gps_status, bus.bus_number)
  const lastUpdate = bus.last_gps_update
    ? Math.round((Date.now() - new Date(bus.last_gps_update).getTime()) / 1000)
    : null

  return (
    <Marker
      position={[bus.current_latitude, bus.current_longitude]}
      icon={icon}
      eventHandlers={{ click: () => onClick?.(bus) }}
    >
      <Popup minWidth={220}>
        <div className="text-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-bold text-base">{bus.bus_number}</span>
            <StatusBadge type="bus" status={bus.status} size="xs" />
          </div>
          <p className="text-gray-600 mb-1">{bus.route_name || `${bus.origin} → ${bus.destination}`}</p>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-xs">
            <span className="text-gray-500">GPS</span>
            <StatusBadge type="gps" status={bus.gps_status} size="xs" />

            <span className="text-gray-500">Seats</span>
            <span>{bus.current_occupancy}/{bus.seat_capacity}
              <span className="text-green-600 ml-1">({bus.available_seats} free)</span>
            </span>

            <span className="text-gray-500">Cargo</span>
            <span>{parseFloat(bus.booked_cargo_kg || 0).toFixed(0)}/{parseFloat(bus.cargo_capacity_kg || 0).toFixed(0)} kg
              <span className="text-green-600 ml-1">({parseFloat(bus.available_cargo_kg || 0).toFixed(0)} free)</span>
            </span>

            {bus.gps_speed && <>
              <span className="text-gray-500">Speed</span>
              <span>{Math.round(bus.gps_speed)} km/h</span>
            </>}

            {lastUpdate !== null && <>
              <span className="text-gray-500">Updated</span>
              <span>{lastUpdate}s ago</span>
            </>}
          </div>

          {bus.gps_status === 'SIMULATION' && (
            <div className="mt-2 px-2 py-1 bg-purple-50 rounded text-xs text-purple-700 border border-purple-200">
              📡 GPS SOURCE: Demo Simulation
            </div>
          )}
        </div>
      </Popup>
    </Marker>
  )
}
