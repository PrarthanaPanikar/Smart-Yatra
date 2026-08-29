import { useState, useEffect } from 'react'
import api from '../../services/api'
import { getSocket } from '../../services/socketService'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const TYPE_COLOUR = {
  BREAKDOWN: 'bg-red-100 text-red-800',
  ACCIDENT: 'bg-red-200 text-red-900',
  MEDICAL_EMERGENCY: 'bg-orange-100 text-orange-800',
  ROUTE_DELAY: 'bg-yellow-100 text-yellow-800',
  UNSCHEDULED_STOP: 'bg-yellow-100 text-yellow-700',
  BUS_CANCELLED: 'bg-red-100 text-red-700',
  OTHER: 'bg-gray-100 text-gray-700',
}

export default function AdminReports() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('all')

  useEffect(() => {
    const params = filter !== 'all' ? `?status=${filter}` : ''
    api.get(`/admin/reports${params}`)
      .then(r => setReports(r.data.reports || []))
      .finally(() => setLoading(false))

    const socket = getSocket()
    if (socket) {
      socket.on('driver:report', (report) => {
        setReports(prev => [{ ...report, status: 'PENDING' }, ...prev])
      })
      socket.on('report:acknowledged', ({ reportId }) => {
        setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'ACKNOWLEDGED' } : r))
      })
    }
    return () => {
      socket?.off('driver:report')
      socket?.off('report:acknowledged')
    }
  }, [filter])

  const acknowledge = async (id) => {
    try {
      await api.put(`/admin/reports/${id}/acknowledge`)
      setReports(prev => prev.map(r => r.id === id ? { ...r, status: 'ACKNOWLEDGED' } : r))
    } catch (err) { alert('Failed to acknowledge') }
  }

  if (loading) return <LoadingSpinner size="lg" text="Loading reports…" />

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Driver Reports</h1>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">All Reports</option>
          <option value="PENDING">Pending</option>
          <option value="ACKNOWLEDGED">Acknowledged</option>
        </select>
      </div>

      {reports.length === 0 ? (
        <div className="bg-white rounded-xl border shadow-sm p-12 text-center">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-gray-500">No reports matching filter</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map(r => (
            <div key={r.id} className={`bg-white rounded-xl border shadow-sm p-4
              ${r.status === 'PENDING' ? 'border-red-200' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${TYPE_COLOUR[r.report_type] || 'bg-gray-100 text-gray-700'}`}>
                      {r.report_type}
                    </span>
                    <span className="font-bold text-gray-800">{r.bus_number}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                      ${r.status === 'PENDING' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {r.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">Driver: <span className="font-medium">{r.driver_name}</span></p>
                  {r.message && <p className="text-sm text-gray-500 mt-1">"{r.message}"</p>}
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(r.timestamp).toLocaleString('en-IN')}
                    {r.latitude && ` · ${parseFloat(r.latitude).toFixed(4)}, ${parseFloat(r.longitude).toFixed(4)}`}
                  </p>
                </div>
                {r.status === 'PENDING' && (
                  <button
                    onClick={() => acknowledge(r.id)}
                    className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 shrink-0"
                  >
                    Acknowledge
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
