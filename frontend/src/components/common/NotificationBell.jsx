import { useState, useEffect } from 'react'
import { getSocket } from '../../services/socketService'
import api from '../../services/api'

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    api.get('/notifications').then(r => setNotifications(r.data.notifications || [])).catch(() => {})

    const socket = getSocket()
    if (socket) {
      socket.on('notification:new', (n) => {
        setNotifications(prev => [n, ...prev])
      })
    }
    return () => { socket?.off('notification:new') }
  }, [])

  const unread = notifications.filter(n => !n.is_read).length

  const markAllRead = async () => {
    await api.put('/notifications/read-all').catch(() => {})
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-full hover:bg-white/10 transition-colors"
        aria-label="Notifications"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border z-50 text-gray-800">
          <div className="flex items-center justify-between p-3 border-b">
            <span className="font-semibold text-sm">Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">No notifications</p>
            ) : notifications.slice(0, 15).map(n => (
              <div key={n.id}
                className={`px-4 py-3 border-b text-sm ${!n.is_read ? 'bg-blue-50' : ''}`}>
                <p className="font-medium">{n.title}</p>
                <p className="text-gray-600 text-xs mt-0.5">{n.message}</p>
                <p className="text-gray-400 text-xs mt-1">
                  {new Date(n.created_at).toLocaleTimeString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
