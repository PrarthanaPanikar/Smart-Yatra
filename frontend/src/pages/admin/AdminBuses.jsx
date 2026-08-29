import { useState, useEffect } from 'react'
import api from '../../services/api'
import StatusBadge from '../../components/common/StatusBadge'
import LoadingSpinner from '../../components/common/LoadingSpinner'

// ── Shared field definitions ────────────────────────────────────────────────
const TEXT_FIELDS = [
  { key: 'busNumber',      label: 'Bus Number',        type: 'text',   ph: 'BUS-004',  required: true },
  { key: 'seatCapacity',   label: 'Seat Capacity',     type: 'number', ph: '50' },
  { key: 'cargoCapacityKg',label: 'Cargo Capacity (kg)', type: 'number', ph: '500' },
  { key: 'departureTime',  label: 'Departure Time',    type: 'time',   ph: '' },
  { key: 'arrivalTime',    label: 'Arrival Time',      type: 'time',   ph: '' },
]

const STATUSES = ['SCHEDULED','IN_TRANSIT','AT_STOP','DELAYED','BREAKDOWN','CANCELLED','COMPLETED']

const EMPTY_FORM = {
  busNumber: '', routeId: '', driverId: '',
  seatCapacity: 50, cargoCapacityKg: 500,
  departureTime: '', arrivalTime: '', status: 'SCHEDULED',
}

// ── Small reusable modal ────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-800">{title}</h2>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
            ×
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

// ── Confirm delete dialog ───────────────────────────────────────────────────
function DeleteConfirm({ bus, onConfirm, onCancel, loading }) {
  return (
    <Modal title="Delete Bus" onClose={onCancel}>
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <div>
          <p className="text-lg font-bold text-gray-800">Delete {bus.bus_number}?</p>
          <p className="text-sm text-gray-500 mt-1">
            {bus.origin} → {bus.destination}
            {bus.driver_name ? ` · Driver: ${bus.driver_name}` : ''}
          </p>
          <p className="text-sm text-red-600 mt-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            This will deactivate the bus. Active bookings today will block deletion.
          </p>
        </div>
        <div className="flex gap-3 justify-center pt-2">
          <button onClick={onCancel} disabled={loading}
            className="px-6 py-2.5 rounded-xl border font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
            {loading && <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>}
            {loading ? 'Deleting…' : 'Yes, Delete'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Bus form (shared by Add + Edit) ────────────────────────────────────────
function BusForm({ form, setForm, routes, drivers, onSubmit, onCancel, isEdit, loading, error }) {
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {TEXT_FIELDS.map(field => (
          <div key={field.key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>
            <input
              type={field.type}
              value={form[field.key]}
              onChange={e => f(field.key, e.target.value)}
              placeholder={field.ph}
              required={field.required}
              disabled={isEdit && field.key === 'busNumber'} // Bus number can't be changed
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                         disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
            />
            {isEdit && field.key === 'busNumber' && (
              <p className="text-xs text-gray-400 mt-0.5">Bus number cannot be changed</p>
            )}
          </div>
        ))}

        {/* Route */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Route</label>
          <select value={form.routeId} onChange={e => f('routeId', e.target.value)}
            className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">— Select route —</option>
            {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>

        {/* Driver */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Driver</label>
          <select value={form.driverId} onChange={e => f('driverId', e.target.value)}
            className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">— Unassigned —</option>
            {drivers.map(d => <option key={d.id} value={d.id}>{d.name} ({d.mobile})</option>)}
          </select>
        </div>

        {/* Status (edit only) */}
        {isEdit && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select value={form.status} onChange={e => f('status', e.target.value)}
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400">
        * Cargo capacity is a demo prototype value. Not official MSRTC specification.
      </p>

      <div className="flex gap-3 pt-2 border-t">
        <button type="submit" disabled={loading}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold
                     px-6 py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50">
          {loading && <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>}
          {loading ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? '💾 Save Changes' : '+ Create Bus')}
        </button>
        <button type="button" onClick={onCancel} disabled={loading}
          className="px-6 py-2.5 rounded-xl border font-semibold text-gray-700 hover:bg-gray-50 text-sm disabled:opacity-50">
          Cancel
        </button>
      </div>
    </form>
  )
}

// ── Main component ──────────────────────────────────────────────────────────
export default function AdminBuses() {
  const [buses,   setBuses]   = useState([])
  const [routes,  setRoutes]  = useState([])
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)

  // Modal state
  const [showAdd,    setShowAdd]    = useState(false)
  const [editBus,    setEditBus]    = useState(null)  // bus object being edited
  const [deleteBus,  setDeleteBus]  = useState(null)  // bus object to delete

  // Form state
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [formError,  setFormError]  = useState('')
  const [formLoading,setFormLoading]= useState(false)

  // Toast
  const [toast, setToast] = useState(null)
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // Load data
  useEffect(() => {
    Promise.all([
      api.get('/admin/buses'),
      api.get('/buses/routes'),
      api.get('/admin/users'),
    ]).then(([bRes, rRes, uRes]) => {
      setBuses(bRes.data.buses || [])
      setRoutes(rRes.data.routes || [])
      setDrivers((uRes.data.users || []).filter(u => u.role === 'DRIVER'))
    }).finally(() => setLoading(false))
  }, [])

  // ── Open edit modal ─────────────────────────────────────────────────────
  const openEdit = (bus) => {
    setEditBus(bus)
    setForm({
      busNumber:      bus.bus_number,
      routeId:        bus.route_id   || '',
      driverId:       bus.driver_user_id || '',
      seatCapacity:   bus.seat_capacity,
      cargoCapacityKg:parseFloat(bus.cargo_capacity_kg),
      departureTime:  bus.departure_time || '',
      arrivalTime:    bus.arrival_time   || '',
      status:         bus.status,
    })
    setFormError('')
  }

  const closeModals = () => {
    setShowAdd(false)
    setEditBus(null)
    setDeleteBus(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setFormLoading(false)
  }

  // ── CREATE ───────────────────────────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault()
    setFormError('')
    setFormLoading(true)
    try {
      const res = await api.post('/admin/buses', form)
      const newBus = res.data.bus

      // Enrich with route/driver names for display
      const route  = routes.find(r => r.id === form.routeId)
      const driver = drivers.find(d => d.id === form.driverId)
      setBuses(prev => [...prev, {
        ...newBus,
        route_name:      route?.name       || '',
        origin:          route?.origin     || '',
        destination:     route?.destination|| '',
        driver_name:     driver?.name      || '',
        driver_user_id:  driver?.id        || '',
        available_seats: newBus.seat_capacity - (newBus.current_occupancy || 0),
        available_cargo_kg: parseFloat(newBus.cargo_capacity_kg) - parseFloat(newBus.booked_cargo_kg || 0),
      }])
      showToast(`✅ ${newBus.bus_number} created successfully`)
      closeModals()
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to create bus')
    } finally {
      setFormLoading(false)
    }
  }

  // ── UPDATE ───────────────────────────────────────────────────────────────
  const handleUpdate = async (e) => {
    e.preventDefault()
    setFormError('')
    setFormLoading(true)
    try {
      await api.put(`/admin/buses/${editBus.id}`, {
        routeId:        form.routeId        || null,
        driverId:       form.driverId       || null,
        seatCapacity:   parseInt(form.seatCapacity),
        cargoCapacityKg:parseFloat(form.cargoCapacityKg),
        status:         form.status,
        departureTime:  form.departureTime  || null,
        arrivalTime:    form.arrivalTime    || null,
      })

      const route  = routes.find(r => r.id === form.routeId)
      const driver = drivers.find(d => d.id === form.driverId)

      setBuses(prev => prev.map(b => b.id === editBus.id ? {
        ...b,
        route_id:          form.routeId,
        driver_user_id:    form.driverId,
        seat_capacity:     parseInt(form.seatCapacity),
        cargo_capacity_kg: parseFloat(form.cargoCapacityKg),
        status:            form.status,
        departure_time:    form.departureTime || null,
        arrival_time:      form.arrivalTime   || null,
        route_name:        route?.name        || b.route_name,
        origin:            route?.origin      || b.origin,
        destination:       route?.destination || b.destination,
        driver_name:       driver?.name       || (form.driverId ? b.driver_name : ''),
        available_seats:   parseInt(form.seatCapacity) - (b.current_occupancy || 0),
        available_cargo_kg:parseFloat(form.cargoCapacityKg) - parseFloat(b.booked_cargo_kg || 0),
      } : b))

      showToast(`✅ ${editBus.bus_number} updated successfully`)
      closeModals()
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to update bus')
    } finally {
      setFormLoading(false)
    }
  }

  // ── DELETE ───────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    setFormLoading(true)
    try {
      await api.delete(`/admin/buses/${deleteBus.id}`)
      setBuses(prev => prev.filter(b => b.id !== deleteBus.id))
      showToast(`🗑 ${deleteBus.bus_number} deleted`)
      closeModals()
    } catch (err) {
      setFormLoading(false)
      showToast(err.response?.data?.error || 'Failed to delete bus', 'error')
      closeModals()
    }
  }

  // ── Quick status change (from table dropdown) ─────────────────────────
  const handleStatusChange = async (busId, status) => {
    try {
      await api.put(`/admin/buses/${busId}`, { status })
      setBuses(prev => prev.map(b => b.id === busId ? { ...b, status } : b))
    } catch (_) { showToast('Failed to update status', 'error') }
  }

  if (loading) return <LoadingSpinner size="lg" text="Loading fleet…" />

  return (
    <div className="p-4 max-w-7xl mx-auto">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-xl text-white text-sm font-medium
          transition-all ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Fleet Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">{buses.length} bus{buses.length !== 1 ? 'es' : ''} registered</p>
        </div>
        <button
          onClick={() => { setForm(EMPTY_FORM); setFormError(''); setShowAdd(true) }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white
                     px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Bus
        </button>
      </div>

      {/* Buses table */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Bus', 'Route', 'Driver', 'Seats', 'Cargo (kg)', 'Status', 'GPS', 'Departs', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {buses.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                    <p className="text-3xl mb-2">🚌</p>
                    <p>No buses registered yet. Click + Add Bus to get started.</p>
                  </td>
                </tr>
              ) : buses.map((b) => (
                <tr key={b.id} className="hover:bg-blue-50/30 transition-colors">
                  {/* Bus number */}
                  <td className="px-4 py-3">
                    <span className="font-bold text-blue-700">{b.bus_number}</span>
                  </td>

                  {/* Route */}
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {b.origin && b.destination
                      ? `${b.origin} → ${b.destination}`
                      : <span className="text-gray-300 italic">No route</span>}
                  </td>

                  {/* Driver */}
                  <td className="px-4 py-3 text-gray-600">
                    {b.driver_name || <span className="text-gray-300">—</span>}
                  </td>

                  {/* Seats */}
                  <td className="px-4 py-3">
                    <span className="font-medium">{b.current_occupancy}/{b.seat_capacity}</span>
                    <span className="text-green-600 text-xs ml-1">({b.available_seats} free)</span>
                  </td>

                  {/* Cargo */}
                  <td className="px-4 py-3">
                    <span className="font-medium">
                      {parseFloat(b.booked_cargo_kg || 0).toFixed(0)}/{parseFloat(b.cargo_capacity_kg || 0).toFixed(0)}
                    </span>
                    <span className="text-green-600 text-xs ml-1">
                      ({parseFloat(b.available_cargo_kg || 0).toFixed(0)} free)
                    </span>
                  </td>

                  {/* Status badge */}
                  <td className="px-4 py-3">
                    <StatusBadge type="bus" status={b.status} size="xs" />
                  </td>

                  {/* GPS badge */}
                  <td className="px-4 py-3">
                    <StatusBadge type="gps" status={b.gps_status} size="xs" />
                  </td>

                  {/* Departs */}
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {b.departure_time || '—'}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {/* Quick status change */}
                      <select
                        value={b.status}
                        onChange={e => handleStatusChange(b.id, e.target.value)}
                        title="Change status"
                        className="text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
                      >
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>

                      {/* Edit */}
                      <button
                        onClick={() => openEdit(b)}
                        title="Edit bus"
                        className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-100 transition-colors"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5
                               m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => setDeleteBus(b)}
                        title="Delete bus"
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-100 transition-colors"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858
                               L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── ADD Modal ──────────────────────────────────────────────────────── */}
      {showAdd && (
        <Modal title="Register New Bus" onClose={closeModals}>
          <BusForm
            form={form} setForm={setForm}
            routes={routes} drivers={drivers}
            onSubmit={handleCreate} onCancel={closeModals}
            isEdit={false} loading={formLoading} error={formError}
          />
        </Modal>
      )}

      {/* ── EDIT Modal ─────────────────────────────────────────────────────── */}
      {editBus && (
        <Modal title={`Edit Bus — ${editBus.bus_number}`} onClose={closeModals}>
          <BusForm
            form={form} setForm={setForm}
            routes={routes} drivers={drivers}
            onSubmit={handleUpdate} onCancel={closeModals}
            isEdit={true} loading={formLoading} error={formError}
          />
        </Modal>
      )}

      {/* ── DELETE Confirm ─────────────────────────────────────────────────── */}
      {deleteBus && (
        <DeleteConfirm
          bus={deleteBus}
          onConfirm={handleDelete}
          onCancel={closeModals}
          loading={formLoading}
        />
      )}
    </div>
  )
}
