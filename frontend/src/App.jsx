import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Navbar from './components/common/Navbar'
import LoadingSpinner from './components/common/LoadingSpinner'

// Auth pages
import LoginPage    from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'

// Admin
import AdminDashboard    from './pages/admin/AdminDashboard'
import AdminBuses        from './pages/admin/AdminBuses'
import AdminReports      from './pages/admin/AdminReports'
import AdminBookings     from './pages/admin/AdminBookings'
import AdminVerification from './pages/admin/AdminVerification'

// Driver
import DriverDashboard from './pages/driver/DriverDashboard'
import DriverGPS       from './pages/driver/DriverGPS'
import DriverCargo     from './pages/driver/DriverCargo'

// Farmer
import FarmerDashboard  from './pages/farmer/FarmerDashboard'
import FarmerBookCargo  from './pages/farmer/FarmerBookCargo'
import FarmerBookings   from './pages/farmer/FarmerBookings'
import FarmerTrackParcel from './pages/farmer/FarmerTrackParcel'

// Passenger
import PassengerDashboard from './pages/passenger/PassengerDashboard'
import PassengerBookSeat  from './pages/passenger/PassengerBookSeat'
import PassengerBookings  from './pages/passenger/PassengerBookings'

// ── Protected route wrapper ─────────────────────────────────────────────────
const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <LoadingSpinner size="lg" text="Loading SmartYatra…" />
    </div>
  )

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />

  if (roles && !roles.includes(user.role)) {
    const redirect = {
      ADMIN: '/admin', DRIVER: '/driver', FARMER: '/farmer', PASSENGER: '/passenger',
    }[user.role] || '/login'
    return <Navigate to={redirect} replace />
  }

  return children
}

// ── App shell ──────────────────────────────────────────────────────────────
const AppShell = ({ children }) => {
  const { user } = useAuth()
  return (
    <div className="min-h-screen bg-gray-50">
      {user && <Navbar />}
      <main>{children}</main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell>
          <Routes>
            {/* Public */}
            <Route path="/login"    element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Root redirect */}
            <Route path="/" element={<RootRedirect />} />

            {/* Admin */}
            <Route path="/admin" element={
              <ProtectedRoute roles={['ADMIN']}><AdminDashboard /></ProtectedRoute>
            } />
            <Route path="/admin/buses" element={
              <ProtectedRoute roles={['ADMIN']}><AdminBuses /></ProtectedRoute>
            } />
            <Route path="/admin/reports" element={
              <ProtectedRoute roles={['ADMIN']}><AdminReports /></ProtectedRoute>
            } />
            <Route path="/admin/bookings" element={
              <ProtectedRoute roles={['ADMIN']}><AdminBookings /></ProtectedRoute>
            } />
            <Route path="/admin/verification" element={
              <ProtectedRoute roles={['ADMIN']}><AdminVerification /></ProtectedRoute>
            } />

            {/* Driver */}
            <Route path="/driver" element={
              <ProtectedRoute roles={['DRIVER']}><DriverDashboard /></ProtectedRoute>
            } />
            <Route path="/driver/gps" element={
              <ProtectedRoute roles={['DRIVER']}><DriverGPS /></ProtectedRoute>
            } />
            <Route path="/driver/cargo" element={
              <ProtectedRoute roles={['DRIVER']}><DriverCargo /></ProtectedRoute>
            } />

            {/* Farmer */}
            <Route path="/farmer" element={
              <ProtectedRoute roles={['FARMER']}><FarmerDashboard /></ProtectedRoute>
            } />
            <Route path="/farmer/book" element={
              <ProtectedRoute roles={['FARMER']}><FarmerBookCargo /></ProtectedRoute>
            } />
            <Route path="/farmer/bookings" element={
              <ProtectedRoute roles={['FARMER']}><FarmerBookings /></ProtectedRoute>
            } />
            <Route path="/farmer/track/:parcelId" element={
              <ProtectedRoute roles={['FARMER','ADMIN','DRIVER']}><FarmerTrackParcel /></ProtectedRoute>
            } />

            {/* Passenger */}
            <Route path="/passenger" element={
              <ProtectedRoute roles={['PASSENGER']}><PassengerDashboard /></ProtectedRoute>
            } />
            <Route path="/passenger/book" element={
              <ProtectedRoute roles={['PASSENGER']}><PassengerBookSeat /></ProtectedRoute>
            } />
            <Route path="/passenger/bookings" element={
              <ProtectedRoute roles={['PASSENGER']}><PassengerBookings /></ProtectedRoute>
            } />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </AppShell>
      </AuthProvider>
    </BrowserRouter>
  )
}

function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  const map = { ADMIN: '/admin', DRIVER: '/driver', FARMER: '/farmer', PASSENGER: '/passenger' }
  return <Navigate to={map[user.role] || '/login'} replace />
}
