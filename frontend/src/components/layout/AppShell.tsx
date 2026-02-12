import { ReactNode, useState, useEffect, useRef } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import BottomNav from './BottomNav'
import OfflineBanner from './OfflineBanner'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { refreshUserFromServer } from '@/hooks/useAuth'
import { useLocation } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_URL || '/api'
const SERVER_BASE = API_BASE.replace('/api', '')

interface AppShellProps {
  children: ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isOnline = useOnlineStatus()
  const location = useLocation()
  const lastRefreshRef = useRef<number>(0)

  // On mount: refresh user permissions from server
  useEffect(() => {
    lastRefreshRef.current = Date.now()
    refreshUserFromServer()
  }, [])

  // On each route change: refresh permissions (max once per minute) to pick up admin changes without re-login
  useEffect(() => {
    const now = Date.now()
    if (now - lastRefreshRef.current > 60_000) {
      lastRefreshRef.current = now
      refreshUserFromServer()
    }
  }, [location.pathname])

  // Keep-alive ping every 25 minutes to prevent Railway free tier cold starts
  useEffect(() => {
    const ping = () => {
      fetch(`${SERVER_BASE}/api/health`, { method: 'GET' }).catch(() => {})
    }
    const interval = setInterval(ping, 25 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex h-screen bg-smc-dark overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 z-20">
        <Sidebar />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <aside className="relative w-64 h-full">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-col flex-1 lg:pl-64 min-w-0">
        {/* Offline Banner */}
        {!isOnline && <OfflineBanner />}

        {/* Top Bar */}
        <TopBar onMenuClick={() => setSidebarOpen(true)} />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-8 pb-20 lg:pb-6">
          {children}
        </main>

        {/* Mobile Bottom Navigation */}
        <div className="lg:hidden">
          <BottomNav />
        </div>
      </div>
    </div>
  )
}
