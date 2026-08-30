/**
 * ReportBox.jsx — Challenge #2
 * Compact passenger information-report card.
 * Matches existing SmartYatra purple/gray UI style.
 * Does NOT modify any booking, GPS, or bus state.
 */
import { useState, useEffect } from 'react'
import api from '../../services/api'

const REPORT_TYPES = [
  { value: 'BUS_CANCELLATION',       label: '🚫 Bus Cancellation' },
  { value: 'BUS_DELAY',              label: '⏱ Bus Delay' },
  { value: 'BUS_BREAKDOWN',          label: '🔧 Bus Breakdown' },
  { value: 'ROUTE_CLOSED',           label: '🛑 Route Closed / Blocked' },
  { value: 'ROUTE_DIVERSION',        label: '↪ Route Diversion' },
  { value: 'INCORRECT_BUS_INFO',     label: '❓ Incorrect Bus Information' },
  { value: 'INCORRECT_CAPACITY_INFO',label: '💺 Incorrect Seat / Capacity Info' },
  { value: 'OTHER',                  label: '📝 Other' },
]

const STATUS_CONFIG = {
  PENDING_VERIFICATION: { label: '🟡 Pending Verification', cls: 'bg-yellow-50 border-yellow-200 text-yellow-800' },
  VERIFIED:             { label: '🟢 Verified',              cls: 'bg-green-50  border-green-200  text-green-800'  },
  FALSE_CLAIM:          { label: '🔴 False / Contradicted',  cls: 'bg-red-50    border-red-200    text-red-800'    },
  UNVERIFIED:           { label: '🟡 Unverified',            cls: 'bg-gray-50   border-gray-200   text-gray-700'  },
}

export default function ReportBox({ buses = [] }) {
  const [open, setOpen]         = useState(false)
  const [form, setForm]         = useState({ busId: '', reportType: '', message: '' })
  const [submitting, setSubmit] = useState(false)
  const [success, setSuccess]   = useState(null)
  const [error, setError]       = useState('')
  const [myReports, setMyReports] = useState([])
  const [showHistory, setShowHistory] = useState(false)

  // Load past reports
  useEffect(() => {
    api.get('/reports/mine').then(r => setMyReports(r.data.reports || [])).catch(() => {})
  }, [success])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.reportType || !form.message.trim()) {
      setError('Please select a report type and enter a message.')
      return
    }
    setError('')
    setSubmit(true)
    try {
      const res = await api.post('/reports', {
        busId:      form.busId      || undefined,
        reportType: form.reportType,
        message:    form.message.trim(),
      })
      setSuccess(res.data)
      setForm({ busId: '', reportType: '', message: '' })
      setOpen(false)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit. Try again.')
    } finally {
      setSubmit(false)
    }
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const pendingCount = myReports.filter(r => r.status === 'PENDING_VERIFICATION').length

  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">📢</span>
          <div>
            <p className="font-bold text-gray-800">Report Information</p>
            <p className="text-xs text-gray-500">Have you heard something about a bus or route?</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="bg-yellow-100 text-yellow-700 text-xs font-semibold px-2 py-0.5 rounded-full">
              {pendingCount} pending
            </span>
          )}
          <svg className={`h-5 w-5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expandable body */}
      {open && (
        <div className="border-t px-5 py-4 space-y-4">

          {/* Success banner */}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800 flex items-start gap-2">
              <span className="text-lg shrink-0">✅</span>
              <div>
                <p className="font-semibold">Report submitted — Reference: <span className="font-mono">{success.reportId?.slice(0,8)}…</span></p>
                <p className="text-xs mt-0.5">Your report is under review. It will not change the bus status until verified by an admin.</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Disclaimer */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
            ⚠ Reports are sent for admin review only. They do <strong>not</strong> automatically change any bus or route status.
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Bus selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bus <span className="text-gray-400 font-normal">(optional)</span></label>
              <select value={form.busId} onChange={e => f('busId', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                <option value="">— Select bus —</option>
                {buses.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.bus_number}{b.origin && b.destination ? ` (${b.origin} → ${b.destination})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Report type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Report Type <span className="text-red-500">*</span></label>
              <select value={form.reportType} onChange={e => f('reportType', e.target.value)}
                required
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                <option value="">— Select type —</option>
                {REPORT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                value={form.message}
                onChange={e => f('message', e.target.value)}
                rows={3}
                maxLength={500}
                required
                placeholder='e.g. "Someone told me BUS-001 has been cancelled today."'
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />
              <p className="text-xs text-gray-400 text-right">{form.message.length}/500</p>
            </div>

            <button type="submit" disabled={submitting}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting && <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>}
              {submitting ? 'Submitting…' : '📤 Submit Report'}
            </button>
          </form>

          {/* My past reports */}
          {myReports.length > 0 && (
            <div>
              <button onClick={() => setShowHistory(!showHistory)}
                className="text-sm text-purple-600 hover:underline flex items-center gap-1">
                <span>{showHistory ? '▲ Hide' : '▼ Show'} my past reports ({myReports.length})</span>
              </button>

              {showHistory && (
                <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                  {myReports.map(r => {
                    const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.PENDING_VERIFICATION
                    return (
                      <div key={r.id} className={`border rounded-xl p-3 text-xs ${cfg.cls}`}>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="font-semibold">{r.report_type.replace(/_/g, ' ')}</span>
                          <span className="font-medium whitespace-nowrap">{cfg.label}</span>
                        </div>
                        {r.bus_number && <p className="text-gray-600">Bus: {r.bus_number}</p>}
                        <p className="mt-1 text-gray-700 italic">"{r.message}"</p>
                        {r.verification_result && (
                          <p className="mt-1 text-gray-600">Reason: {r.verification_reason}</p>
                        )}
                        <p className="mt-1 text-gray-400">{new Date(r.created_at).toLocaleString('en-IN')}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
