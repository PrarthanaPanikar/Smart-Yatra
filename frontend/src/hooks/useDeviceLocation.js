import { useState, useEffect, useCallback } from 'react'

/**
 * useDeviceLocation — gets user's actual device GPS.
 * Used by Farmer and Passenger portals to find nearby buses/stops.
 */
export default function useDeviceLocation() {
  const [location, setLocation]   = useState(null)  // { lat, lng, accuracy }
  const [error, setError]         = useState(null)
  const [loading, setLoading]     = useState(false)
  const [permission, setPermission] = useState('prompt') // 'prompt'|'granted'|'denied'

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported by this browser')
      setPermission('denied')
      return
    }

    setLoading(true)
    setError(null)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
        setPermission('granted')
        setLoading(false)
      },
      (err) => {
        setLoading(false)
        setPermission('denied')
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError('Location permission denied. Please enable location access in browser settings.')
            break
          case err.POSITION_UNAVAILABLE:
            setError('Location unavailable. Ensure GPS is enabled.')
            break
          case err.TIMEOUT:
            setError('Location request timed out.')
            break
          default:
            setError('Failed to get location.')
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    )
  }, [])

  // Check existing permission on mount
  useEffect(() => {
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then(p => {
        setPermission(p.state)
        if (p.state === 'granted') requestLocation()
        p.onchange = () => setPermission(p.state)
      }).catch(() => {})
    }
  }, [requestLocation])

  return { location, error, loading, permission, requestLocation }
}
