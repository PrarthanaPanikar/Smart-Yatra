/**
 * AdminVerification.jsx — Challenge #2
 * Information Verification panel inside Admin portal.
 * Lists passenger-submitted reports and lets admin verify/reject with
 * live evidence from existing operational data.
 */
import { useState, useEffect, useCallback } from 'react'
import api from '../../services/api'
import { getSocket } from '../../services/socketService'
import StatusBadge from '../../components/common/StatusBadge'
import LoadingSpinner from '../../components/common/LoadingSpinner'

// ── Colour config for verification states ───────────────────────────────────
const RESULT_CONFIG = {
  PENDING_VERIFICATION: { icon: '🟡', label: 'Pending',    cls: 'bg-yellow-50 border-yellow-200 text-yellow-800' },
  VERIFIED:             { icon: '🟢', label: 'Verified',   cls: 'bg-green-50  border-green-200  text-green-800'  },
  FALSE_CLAIM:          { icon: '🔴', label: 'False Claim',cls: 'bg-red-50    border-red-200    text-red-800'    },
  UNVERIFIED:           { icon: '🟡', label: 'Unverified', cls: 'bg-gray-50   border-gray-200   text-gray-700'  },
}

const TYPE_LABELS = {
  BUS_CANCELLATION:        'Bus Cancellation',
  BUS_DELAY:               'Bus Delay',
  BUS_BREAKDOWN:           'Bus Breakdown',
  ROUTE_CLOSED:            'Route Closed',
  ROUTE_DIVERSION:         'Route Diversion',
  INCORRECT_BUS_INFO:      'Incorrect Bus Info',
  INCORRECT_CAPACITY_INFO: 'Incorrect Capacity Info',
  OTHER:                   'Other',
}

// ── Evidence pill ────────────────────────────────────────────────────────────
const EvidencePill = ({ label, value, good }) => (
  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
    ${good === true  ? 'bg-green-100 text-green-800' :
      good === false ? 'bg-red-100   text-red-800'   :
                       'bg-gray-100  text-gray-600'}`}>
    <span>{good === true ? '✓' : good === false ? '✗' : '—'}</span>
    <span>{label}: <strong>{value || '—'}</strong></span>
  </div>
)

// ── Report Card ──────────────────────────────────────────────────────────────
function ReportCard({ report, onVerified, coordinated }) {
  const [expanded,    setExpanded]    = useState(false)
  const [liveEvidence, setLiveEvidence] = useState(null)
  const [verifying,   setVerifying]   = useState(false)
  const [rejecting,   setRejecting]   = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showReject,  setShowReject]  = useState(false)

  const loadEvidence = async () => {
    if (!expanded) {
      try {
        const res = await api.get(`/reports/${report.id}`)
        setLiveEvidence(res.data.liveEvidence)
      } catch (_) {}
    }
    setExpanded(!expanded)
  }

  const handleVerify = async () => {
    setVerifying(true)
    try {
      const res = await api.post(`/reports/${report.id}/verify`)
      onVerified(report.id, res.data)
    } catch (err) {
      alert(err.response?.data?.error || 'Verification failed')
    } finally {
      setVerifying(false)
    }
  }

  const handleReject = async () => {
    setRejecting(true)
    try {
      await api.post(`/reports/${report.id}/reject`, { reason: rejectReason || undefined })
      onVerified(report.id, { result: 'FALSE_CLAIM' })
    } catch (err) {
      alert(err.response?.data?.error || 'Rejection failed')
    } finally {
      setRejecting(false)
      setShowReject(false)
    }
  }

  const cfg = RESULT_CONFIG[report.status] || RESULT_CONFIG.PENDING_VERIFICATION
  const isPending = report.status === 'PENDING_VERIFICATION'
  const timeAgo = (() => {
    const secs = Math.round((Date.now() - new Date(report.created_at).getTime()) / 1000)
    if (secs < 60) return `${secs}s ago`
    if (secs < 3600) return `${Math.round(secs/60)}m ago`
    return `${Math.round(secs/3600)}h ago`
  })()

  // Evidence from existing system data
  const ev = liveEvidence
  const gpsActive = ev && ['CONNECTED','SIMULATION'].includes(ev.gps_status)
  const busRunning = ev && ['IN_TRANSIT','SCHEDULED','AT_STOP'].includes(ev.official_status)

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${isPending ? 'border-yellow-300 shadow-sm' : 'border-gray-200'}`}>
      {/* Summary row */}
      <button onClick={loadEvidence} className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 text-left">
        <span className="text-xl mt-0.5">{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2 mb-0.5">
            <span className="font-bold text-gray-800 text-sm">{TYPE_LABELS[report.report_type] || report.report_type}</span>
            {report.bus_number && (
              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">{report.bus_number}</span>
            )}
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.cls}`}>{cfg.label}</span>
            {coordinated && (
              <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full">
                ⚠ {coordinated} similar reports
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600 italic truncate">"{report.message}"</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
            <span>By: {report.passenger_name}</span>
            <span>·</span>
            <span>{timeAgo}</span>
            {report.route_name && <><span>·</span><span>{report.route_name}</span></>}
          </div>
        </div>
        <svg className={`h-4 w-4 text-gray-400 mt-1 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded evidence + actions */}
      {expanded && (
        <div className="border-t bg-gray-50 px-4 py-4 space-y-4">

          {/* Current official data */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
              Live Operational Evidence (from SmartYatra)
            </p>
            {ev ? (
              <div className="flex flex-wrap gap-2">
                <EvidencePill label="Bus Status" value={ev.official_status}
                  good={busRunning} />
                <EvidencePill label="GPS" value={ev.gps_status}
                  good={gpsActive} />
                {ev.gps_speed != null && (
                  <EvidencePill label="Speed" value={`${Math.round(ev.gps_speed)} km/h`}
                    good={ev.gps_speed > 0} />
                )}
                <EvidencePill label="Driver" value={ev.driver_name || 'Not assigned'}
                  good={!!ev.driver_name} />
                {ev.driver_report && (
                  <EvidencePill label="Driver Report" value={ev.driver_report.report_type}
                    good={null} />
                )}
                <EvidencePill label="Active Bookings" value={ev.active_bookings_today}
                  good={ev.active_bookings_today > 0} />
                {ev.schedule?.departure_time && (
                  <EvidencePill label="Scheduled" value={ev.schedule.departure_time} good={null} />
                )}
                {ev.last_gps_update && (
                  <EvidencePill label="GPS last update"
                    value={`${Math.round((Date.now()-new Date(ev.last_gps_update).getTime())/1000)}s ago`}
                    good={null} />
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">
                {report.bus_id ? 'Could not load live evidence.' : 'No bus selected in this report.'}
              </p>
            )}
          </div>

          {/* Context at time of report */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
              Context at Time of Report
            </p>
            <div className="flex flex-wrap gap-2">
              <EvidencePill label="Bus Status then" value={report.bus_status_at_report || '—'} good={null} />
              <EvidencePill label="GPS then" value={report.gps_status_at_report || '—'} good={null} />
            </div>
          </div>

          {/* Verification result (if already done) */}
          {!isPending && report.verification_result && (
            <div className={`border rounded-lg px-4 py-3 text-sm ${RESULT_CONFIG[report.verification_result]?.cls}`}>
              <p className="font-bold mb-1">
                {RESULT_CONFIG[report.verification_result]?.icon} {RESULT_CONFIG[report.verification_result]?.label}
              </p>
              <p className="text-xs">{report.verification_reason}</p>
              <p className="text-xs mt-1 opacity-70">
                Verified by {report.verified_by_name} · {new Date(report.verified_at).toLocaleString('en-IN')}
              </p>
            </div>
          )}

          {/* Action buttons — only for pending */}
          {isPending && (
            <div className="flex flex-wrap gap-2">
              <button onClick={handleVerify} disabled={verifying}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50 transition-colors">
                {verifying
                  ? <><svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg> Verifying…</>
                  : '🔍 Auto-Verify with Evidence'}
              </button>

              <button onClick={() => setShowReject(!showReject)}
                className="flex items-center gap-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
                🔴 Reject
              </button>
            </div>
          )}

          {/* Reject reason input */}
          {showReject && isPending && (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Reason for rejection (optional)"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              />
              <button onClick={handleReject} disabled={rejecting}
                className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
                {rejecting ? 'Rejecting…' : 'Confirm Reject'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function AdminVerification() {
  const [reports,    setReports]    = useState([])
  const [stats,      setStats]      = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [filter,     setFilter]     = useState('PENDING_VERIFICATION')
  const [coordGroups,setCoordGroups]= useState([])
  const [newCount,   setNewCount]   = useState(0)

  const fetchReports = useCallback(async () => {
    try {
      const params = filter !== 'ALL' ? `?status=${filter}` : ''
      const [rRes, sRes] = await Promise.all([
        api.get(`/reports${params}`),
        api.get('/reports/stats'),
      ])
      setReports(rRes.data.reports || [])
      setCoordGroups(rRes.data.coordinatedGroups || [])
      setStats(sRes.data.stats)
      setNewCount(0)
    } catch (_) {}
    finally { setLoading(false) }
  }, [filter])

  useEffect(() => { fetchReports() }, [fetchReports])

  // Listen for new passenger reports via existing Socket.IO connection
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return
    const handler = () => { setNewCount(n => n + 1) }
    socket.on('passenger:report', handler)
    socket.on('report:verified',  fetchReports)
    return () => {
      socket.off('passenger:report', handler)
      socket.off('report:verified',  fetchReports)
    }
  }, [fetchReports])

  const handleVerified = (reportId, data) => {
    setReports(prev => prev.map(r =>
      r.id === reportId
        ? { ...r, status: data.result, verification_result: data.result, verification_reason: data.reason }
        : r
    ))
  }

  // Build coordinated-report lookup by report ID
  const coordLookup = {}
  coordGroups.forEach(g => {
    g.reportIds.forEach(id => { coordLookup[id] = g.count })
  })

  if (loading) return <LoadingSpinner size="lg" text="Loading reports…" />

  const filterOptions = [
    { value: 'PENDING_VERIFICATION', label: `Pending (${stats?.pending ?? 0})` },
    { value: 'VERIFIED',             label: `Verified (${stats?.verified ?? 0})` },
    { value: 'FALSE_CLAIM',          label: `False Claims (${stats?.false_claims ?? 0})` },
    { value: 'UNVERIFIED',           label: `Unverified (${stats?.unverified ?? 0})` },
    { value: 'ALL',                  label: `All (${stats?.total ?? 0})` },
  ]

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Information Verification</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Passenger-submitted reports — cross-verified with live operational data
          </p>
        </div>
        <button onClick={fetchReports}
          className="text-sm text-blue-600 hover:underline flex items-center gap-1">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* New report alert */}
      {newCount > 0 && (
        <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 px-4 py-2.5 rounded-xl text-sm flex items-center justify-between">
          <span>⚠ {newCount} new report{newCount > 1 ? 's' : ''} received</span>
          <button onClick={fetchReports} className="font-semibold hover:underline">Load</button>
        </div>
      )}

      {/* Coordinated detection alert */}
      {coordGroups.length > 0 && filter !== 'VERIFIED' && filter !== 'FALSE_CLAIM' && (
        <div className="bg-orange-50 border border-orange-200 text-orange-800 px-4 py-3 rounded-xl text-sm space-y-1">
          <p className="font-bold">⚠ POTENTIAL COORDINATED REPORTING DETECTED</p>
          {coordGroups.map((g, i) => {
            const [busId, type] = g.key.split(':')
            return (
              <p key={i} className="text-xs">
                {g.count} reports of <strong>{type.replace(/_/g,' ')}</strong> for the same bus in a short window
              </p>
            )
          })}
          <p className="text-xs text-orange-600">Reports are grouped below. Verify against official data before acting.</p>
        </div>
      )}

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Total Today',  value: stats.total,        cls: 'bg-gray-50  border-gray-200'   },
            { label: 'Pending',      value: stats.pending,      cls: 'bg-yellow-50 border-yellow-200' },
            { label: 'Verified',     value: stats.verified,     cls: 'bg-green-50  border-green-200'  },
            { label: 'False Claims', value: stats.false_claims, cls: 'bg-red-50    border-red-200'    },
            { label: 'Unverified',   value: stats.unverified,   cls: 'bg-gray-50   border-gray-200'   },
          ].map(s => (
            <div key={s.label} className={`border rounded-xl p-3 text-center ${s.cls}`}>
              <p className="text-2xl font-bold">{s.value ?? 0}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* How verification works */}
      <details className="bg-blue-50 border border-blue-200 rounded-xl">
        <summary className="px-4 py-3 text-sm font-semibold text-blue-800 cursor-pointer">
          ℹ How Evidence-Based Verification Works
        </summary>
        <div className="px-4 pb-4 text-xs text-blue-700 space-y-1">
          <p>1. Passenger submits a report → status = <strong>PENDING VERIFICATION</strong></p>
          <p>2. Admin clicks "Auto-Verify with Evidence" → system reads <strong>live bus status, GPS, driver reports, and bookings</strong></p>
          <p>3. Evidence is cross-checked against the claim using rule-based logic (no AI required)</p>
          <p>4. Result: <strong>🟢 VERIFIED</strong>, <strong>🔴 FALSE CLAIM</strong>, or <strong>🟡 UNVERIFIED</strong></p>
          <p>5. Passenger receives a notification with the result</p>
          <p className="font-semibold mt-1">A report NEVER automatically changes any official bus status.</p>
        </div>
      </details>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {filterOptions.map(opt => (
          <button key={opt.value} onClick={() => setFilter(opt.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors
              ${filter === opt.value
                ? 'bg-blue-600 text-white'
                : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Reports list */}
      {reports.length === 0 ? (
        <div className="bg-white rounded-xl border shadow-sm p-12 text-center">
          <p className="text-3xl mb-3">✅</p>
          <p className="text-gray-500">No reports matching this filter</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map(r => (
            <ReportCard
              key={r.id}
              report={r}
              onVerified={handleVerified}
              coordinated={coordLookup[r.id] > 1 ? coordLookup[r.id] : null}
            />
          ))}
        </div>
      )}
    </div>
  )
}
