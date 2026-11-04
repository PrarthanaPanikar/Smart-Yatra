import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const ROLE_REDIRECT = {
  ADMIN: '/admin', DRIVER: '/driver', FARMER: '/farmer', PASSENGER: '/passenger',
}

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', mobile: '', password: '', role: 'PASSENGER' })
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await register(form)
      navigate(ROLE_REDIRECT[user.role] || '/')
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center text-white mb-8">
          <div className="flex justify-center mb-3">
            <img src="/sky-logo.svg" alt="Smart Kopargaon Yatra" className="h-20 w-20 drop-shadow-xl" />
          </div>
          <h1 className="text-2xl font-bold">Smart Kopargaon Yatra</h1>
          <p className="text-blue-200">Create Account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Register</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { key: 'name',   label: 'Full Name',       type: 'text',     ph: 'Ramesh Patil' },
              { key: 'mobile', label: 'Mobile Number',   type: 'tel',      ph: '9876543210' },
              { key: 'password', label: 'Password',      type: 'password', ph: 'Min 6 characters' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                <input
                  type={f.type}
                  value={form[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.ph}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            ))}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={form.role}
                onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="PASSENGER">Passenger</option>
                <option value="FARMER">Farmer</option>
                <option value="DRIVER">Driver</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold
                         py-3 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <div className="mt-4 text-center text-sm">
            <span className="text-gray-500">Already have an account? </span>
            <Link to="/login" className="text-blue-600 hover:underline font-medium">Sign In</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
