import { useState, useEffect } from 'react'
import { useSyncStore } from '@/store/syncStore'

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const { triggerSync } = useSyncStore()

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      // Trigger sync when we come back online
      triggerSync()
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [triggerSync])

  return isOnline
}
