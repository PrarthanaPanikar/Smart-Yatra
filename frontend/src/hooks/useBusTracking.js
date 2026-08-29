import { useState, useEffect, useCallback } from 'react'
import { getSocket, subscribeToBus, unsubscribeFromBus } from '../services/socketService'

/**
 * useBusTracking — subscribes to realtime updates for one or many buses.
 * Used by Passenger/Farmer to track a specific bus live.
 */
export default function useBusTracking(busIds = []) {
  const [locations, setLocations] = useState({})   // busId → locationData
  const [occupancy, setOccupancy] = useState({})   // busId → occupancyData
  const [gpsStatus, setGpsStatus] = useState({})   // busId → status string

  const handleLocation = useCallback((data) => {
    setLocations(prev => ({ ...prev, [data.busId]: data }))
    setGpsStatus(prev => ({ ...prev, [data.busId]: data.gpsStatus }))
  }, [])

  const handleOccupancy = useCallback((data) => {
    setOccupancy(prev => ({ ...prev, [data.busId]: data }))
  }, [])

  const handleGpsStatus = useCallback((data) => {
    setGpsStatus(prev => ({ ...prev, [data.busId]: data.status }))
  }, [])

  useEffect(() => {
    if (!busIds.length) return

    const socket = getSocket()
    if (!socket) return

    busIds.forEach(id => subscribeToBus(id))

    socket.on('bus:location',   handleLocation)
    socket.on('bus:occupancy',  handleOccupancy)
    socket.on('bus:gps-status', handleGpsStatus)

    return () => {
      busIds.forEach(id => unsubscribeFromBus(id))
      socket.off('bus:location',   handleLocation)
      socket.off('bus:occupancy',  handleOccupancy)
      socket.off('bus:gps-status', handleGpsStatus)
    }
  }, [busIds.join(',')]) // eslint-disable-line

  return { locations, occupancy, gpsStatus }
}
