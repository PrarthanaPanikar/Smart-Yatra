import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'

const stopIcon = (isPickup = false, isDest = false) => L.divIcon({
  className: '',
  html: `<div style="
    width:14px;height:14px;
    background:${isPickup ? '#16a34a' : isDest ? '#dc2626' : '#f59e0b'};
    border:2px solid white;border-radius:50%;
    box-shadow:0 1px 4px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  popupAnchor: [0, -10],
})

export function StopMarker({ stop }) {
  return (
    <Marker position={[stop.latitude, stop.longitude]} icon={stopIcon()}>
      <Popup>
        <p className="text-sm font-medium">{stop.name}</p>
        <p className="text-xs text-gray-500">Stop #{stop.sequence}</p>
      </Popup>
    </Marker>
  )
}

export function PickupMarker({ position, label = 'Pickup Point' }) {
  return (
    <Marker position={position} icon={stopIcon(true, false)}>
      <Popup><p className="text-sm font-medium text-green-700">📦 {label}</p></Popup>
    </Marker>
  )
}

export function DestinationMarker({ position, label = 'Destination' }) {
  return (
    <Marker position={position} icon={stopIcon(false, true)}>
      <Popup><p className="text-sm font-medium text-red-700">📍 {label}</p></Popup>
    </Marker>
  )
}
