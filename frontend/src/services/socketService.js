import { io } from 'socket.io-client'

let socket = null

export const connectSocket = (token) => {
  if (socket?.connected) return socket

  socket = io('/', {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  })

  socket.on('connect', () => {
    console.log('🔌 Socket connected:', socket.id)
  })

  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message)
  })

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason)
  })

  return socket
}

export const getSocket = () => socket

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export const subscribeToBus = (busId) => {
  socket?.emit('subscribe:bus', busId)
}

export const unsubscribeFromBus = (busId) => {
  socket?.emit('unsubscribe:bus', busId)
}

export const subscribeToBooking = (bookingId) => {
  socket?.emit('subscribe:booking', bookingId)
}

export const subscribeToAllBuses = () => {
  socket?.emit('subscribe:all-buses')
}
