import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const DEMO_ACCOUNTS = [
  { role: 'ADMIN',     mobile: '9000000001', label: 'Admin',       colour: 'bg-blue-50 border-blue-200 text-blue-700' },
  { role: 'DRIVER',    mobile: '9000000002', label: 'Driver',      colour: 'bg-green-50 border-green-200 text-green-700' },
  { role: 'FARMER',    mobile: '9000000005', label: 'Farmer',      colour: 'bg-amber-50 border-amber-200 text-amber-700' },
  { role: 'PASSENGER', mobile: '9000000007', label: 'Passenger',   colour: 'bg-purple-50 border-purple-200 text-purple-700' },
]

const ROLE_REDIRECT = {
  ADMIN: '/admin', DRIVER: '/driver', FARMER: '/farmer', PASSENGER: '/passenger',
}

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm]     = useState({ mobile: '', password: '' })
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(form.mobile, form.password)
      navigate(ROLE_REDIRECT[user.role] || '/')
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  const fillDemo = (mobile) => setForm({ mobile, password: 'demo1234' })

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center text-white mb-8">
          <div className="text-6xl mb-4">🚌</div>
          <h1 className="text-3xl font-bold">SmartYatra</h1>
          <p className="text-blue-200 mt-2">Smart Public Transport Platform</p>
          <p className="text-xs text-blue-300 mt-1">Passenger · Farmer Cargo · GPS Tracking · Admin</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Sign In</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
              <input
                type="tel"
                value={form.mobile}
                onChange={e => setForm(p => ({ ...p, mobile: e.target.value }))}
                placeholder="9000000001"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder="demo1234"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold
                         py-3 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="mt-4 text-center text-sm">
            <span className="text-gray-500">No account? </span>
            <Link to="/register" className="text-blue-600 hover:underline font-medium">Register</Link>
          </div>

          {/* Demo accounts */}
          <div className="mt-6 pt-5 border-t">
            <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">
              Demo Accounts (password: demo1234)
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map(acc => (
                <button
                  key={acc.role}
                  onClick={() => fillDemo(acc.mobile)}
                  className={`text-xs border rounded-lg px-3 py-2 font-medium text-left transition-colors hover:opacity-80 ${acc.colour}`}
                >
                  <span className="block font-bold">{acc.label}</span>
                  <span className="text-xs opacity-70">{acc.mobile}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
