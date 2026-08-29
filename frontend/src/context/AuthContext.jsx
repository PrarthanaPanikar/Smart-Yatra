import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import { connectSocket, disconnectSocket } from '../services/socketService'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  // Restore session from localStorage
  useEffect(() => {
    const token = localStorage.getItem('sy_token')
    const savedUser = localStorage.getItem('sy_user')
    if (token && savedUser) {
      try {
        const parsed = JSON.parse(savedUser)
        setUser(parsed)
        connectSocket(token)
      } catch (_) {
        localStorage.removeItem('sy_token')
        localStorage.removeItem('sy_user')
      }
    }
    setLoading(false)
  }, [])

  const login = useCallback(async (mobile, password) => {
    const res = await api.post('/auth/login', { mobile, password })
    const { token, user: userData } = res.data
    localStorage.setItem('sy_token', token)
    localStorage.setItem('sy_user', JSON.stringify(userData))
    setUser(userData)
    connectSocket(token)
    return userData
  }, [])

  const register = useCallback(async (data) => {
    const res = await api.post('/auth/register', data)
    const { token, user: userData } = res.data
    localStorage.setItem('sy_token', token)
    localStorage.setItem('sy_user', JSON.stringify(userData))
    setUser(userData)
    connectSocket(token)
    return userData
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('sy_token')
    localStorage.removeItem('sy_user')
    setUser(null)
    disconnectSocket()
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get('/auth/me')
      const userData = res.data.user
      localStorage.setItem('sy_user', JSON.stringify(userData))
      setUser(userData)
      return userData
    } catch (_) {}
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
