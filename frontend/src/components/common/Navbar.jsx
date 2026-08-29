import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const ROLE_HOME = {
  ADMIN:     '/admin',
  DRIVER:    '/driver',
  FARMER:    '/farmer',
  PASSENGER: '/passenger',
}

const ROLE_LINKS = {
  ADMIN: [
    { to: '/admin',          label: 'Dashboard' },
    { to: '/admin/buses',    label: 'Fleet' },
    { to: '/admin/reports',  label: 'Reports' },
    { to: '/admin/bookings', label: 'Bookings' },
  ],
  DRIVER: [
    { to: '/driver',     label: 'Dashboard' },
    { to: '/driver/gps', label: '📡 GPS' },
    { to: '/driver/cargo', label: 'Cargo' },
  ],
  FARMER: [
    { to: '/farmer',           label: 'Dashboard' },
    { to: '/farmer/book',      label: 'Book Cargo' },
    { to: '/farmer/bookings',  label: 'My Bookings' },
  ],
  PASSENGER: [
    { to: '/passenger',          label: 'Dashboard' },
    { to: '/passenger/book',     label: 'Book Seat' },
    { to: '/passenger/bookings', label: 'My Tickets' },
  ],
}

const ROLE_COLOUR = {
  ADMIN:     'bg-blue-700',
  DRIVER:    'bg-green-700',
  FARMER:    'bg-amber-700',
  PASSENGER: 'bg-purple-700',
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()

  if (!user) return null

  const links  = ROLE_LINKS[user.role] || []
  const colour = ROLE_COLOUR[user.role] || 'bg-blue-700'
  const home   = ROLE_HOME[user.role] || '/'

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <nav className={`${colour} text-white shadow-lg`}>
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Brand */}
          <Link to={home} className="flex items-center gap-2 font-bold text-lg">
            <span className="text-2xl">🚌</span>
            <span>SmartYatra</span>
            <span className="text-xs opacity-70 font-normal hidden sm:inline">
              [{user.role}]
            </span>
          </Link>

          {/* Links */}
          <div className="hidden md:flex items-center gap-1">
            {links.map(l => (
              <Link
                key={l.to}
                to={l.to}
                className={`px-3 py-2 rounded text-sm font-medium transition-colors
                  ${location.pathname === l.to
                    ? 'bg-white/20'
                    : 'hover:bg-white/10'}`}
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* User info + logout */}
          <div className="flex items-center gap-3">
            <span className="text-sm hidden sm:block opacity-90">{user.name}</span>
            <button
              onClick={handleLogout}
              className="text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="flex gap-1 pb-2 md:hidden overflow-x-auto">
          {links.map(l => (
            <Link
              key={l.to}
              to={l.to}
              className={`whitespace-nowrap px-3 py-1.5 rounded text-sm font-medium
                ${location.pathname === l.to ? 'bg-white/20' : 'hover:bg-white/10'}`}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}
