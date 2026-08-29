const GPS_COLOURS = {
  CONNECTED:  'bg-green-100 text-green-800 border-green-200',
  STALE:      'bg-yellow-100 text-yellow-800 border-yellow-200',
  OFFLINE:    'bg-red-100 text-red-800 border-red-200',
  SIMULATION: 'bg-purple-100 text-purple-800 border-purple-200',
}

const BUS_COLOURS = {
  IN_TRANSIT: 'bg-blue-100 text-blue-800 border-blue-200',
  SCHEDULED:  'bg-gray-100 text-gray-700 border-gray-200',
  AT_STOP:    'bg-cyan-100 text-cyan-800 border-cyan-200',
  DELAYED:    'bg-orange-100 text-orange-800 border-orange-200',
  BREAKDOWN:  'bg-red-100 text-red-800 border-red-200',
  CANCELLED:  'bg-red-200 text-red-900 border-red-300',
  COMPLETED:  'bg-green-100 text-green-800 border-green-200',
}

const PARCEL_COLOURS = {
  REQUESTED:  'bg-gray-100 text-gray-700',
  MATCHED:    'bg-blue-100 text-blue-700',
  BOOKED:     'bg-indigo-100 text-indigo-700',
  LOADED:     'bg-cyan-100 text-cyan-700',
  IN_TRANSIT: 'bg-yellow-100 text-yellow-800',
  DELIVERED:  'bg-green-100 text-green-800',
  CANCELLED:  'bg-red-100 text-red-700',
}

export default function StatusBadge({ type = 'gps', status, size = 'sm' }) {
  const map = type === 'gps' ? GPS_COLOURS : type === 'bus' ? BUS_COLOURS : PARCEL_COLOURS
  const cls = map[status] || 'bg-gray-100 text-gray-600'
  const sz  = size === 'xs' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-1'
  return (
    <span className={`inline-flex items-center rounded-full font-medium border ${cls} ${sz}`}>
      {status}
    </span>
  )
}
