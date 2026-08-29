import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet default icon path issue with Vite
import L from 'leaflet'
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Recenter helper component
function RecenterMap({ center, zoom }) {
  const map = useMap()
  if (center) map.setView(center, zoom || map.getZoom())
  return null
}

/**
 * SmartMap — base map component using Leaflet + OpenStreetMap
 * Do NOT embed OpenStreetMap as an iframe. This renders tiles directly.
 */
export default function SmartMap({
  center = [19.7157, 74.4704],  // Default: Kopargaon
  zoom = 12,
  height = '400px',
  recenter = false,
  children,
  className = '',
}) {
  return (
    <div style={{ height }} className={`rounded-lg overflow-hidden border border-gray-200 ${className}`}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        scrollWheelZoom={true}
      >
        {/* OpenStreetMap tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {recenter && center && <RecenterMap center={center} zoom={zoom} />}

        {children}
      </MapContainer>
    </div>
  )
}
