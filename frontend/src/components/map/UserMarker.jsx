import { Marker, Popup, Circle } from 'react-leaflet'
import L from 'leaflet'

const userIcon = L.divIcon({
  className: 'user-marker-icon',
  html: `<div style="
    width:18px;height:18px;background:#2563eb;border:3px solid white;
    border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -12],
})

export default function UserMarker({ position, accuracy, label = 'Your Location' }) {
  if (!position) return null
  return (
    <>
      {accuracy && (
        <Circle
          center={position}
          radius={accuracy}
          pathOptions={{ color: '#2563eb', fillColor: '#93c5fd', fillOpacity: 0.15, weight: 1 }}
        />
      )}
      <Marker position={position} icon={userIcon}>
        <Popup>
          <div className="text-sm">
            <p className="font-semibold">{label}</p>
            {accuracy && <p className="text-xs text-gray-500">Accuracy: ±{Math.round(accuracy)}m</p>}
          </div>
        </Popup>
      </Marker>
    </>
  )
}
