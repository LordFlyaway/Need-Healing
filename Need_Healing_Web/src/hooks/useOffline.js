// hooks/useOffline.js
import { useEffect, useState } from 'react'
import { saveEmergencyData, getEmergencyData } from '../lib/offlineCache'

export function useOffline(patientData) {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [cachedData, setCachedData] = useState(null)

  // Sync to IndexedDB whenever patient data changes (online)
  useEffect(() => {
    if (patientData) saveEmergencyData(patientData)
  }, [patientData])

  // Monitor online/offline
  useEffect(() => {
    const on = () => setIsOffline(false)
    const off = () => setIsOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  // Load cached data when offline
  useEffect(() => {
    if (isOffline) getEmergencyData().then(setCachedData)
  }, [isOffline])

  return { isOffline, cachedData }
}