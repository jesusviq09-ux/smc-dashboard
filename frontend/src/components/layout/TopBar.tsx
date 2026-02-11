import { Menu, Wifi, WifiOff, Bell, RefreshCw, LogOut, UserCog } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useSyncStore } from '@/store/syncStore'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { getStoredUser } from '@/hooks/useAuth'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/pilots': 'Pilotos',
  '/training': 'Entrenamientos',
  '/races': 'Carreras',
  '/maintenance': 'Mantenimiento',
  '/telemetry': 'Telemetría',
  '/circuits': 'Circuitos',
  '/chat': 'Comunicación',
  '/stats': 'Estadísticas',
  '/goals': 'Objetivos',
  '/exports': 'Exportar',
}

interface TopBarProps {
  onMenuClick: () => void
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const isOnline = useOnlineStatus()
  const { pendingCount, isSyncing } = useSyncStore()
  const location = useLocation()
  const navigate = useNavigate()
  const currentUser = getStoredUser()

  const handleLogout = () => {
    localStorage.removeItem('smc_auth')
    navigate('/login')
  }

  const getTitle = () => {
    const path = '/' + location.pathname.split('/')[1]
    return pageTitles[path] || 'SMC Dashboard'
  }

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between h-16 px-4 lg:px-8 bg-smc-darker/80 backdrop-blur-md border-b border-smc-border">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-smc-card text-smc-muted"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-white">{getTitle()}</h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Sync indicator */}
        {isSyncing && (
          <div className="flex items-center gap-1.5 text-xs text-smc-muted">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span className="hidden sm:inline">Sincronizando...</span>
          </div>
        )}

        {pendingCount > 0 && !isSyncing && (
          <span className="text-xs text-warning">
            {pendingCount} cambio{pendingCount !== 1 ? 's' : ''} pendiente{pendingCount !== 1 ? 's' : ''}
          </span>
        )}

        {/* Online/Offline indicator */}
        <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${
          isOnline
            ? 'text-success bg-success/10'
            : 'text-warning bg-warning/10'
        }`}>
          {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
        </div>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-smc-card text-smc-muted hover:text-smc-text">
          <Bell className="w-4 h-4" />
        </button>

        {/* User + Logout */}
        {currentUser && (
          <div className="flex items-center gap-2 pl-2 border-l border-smc-border">
            <Link
              to="/profile"
              className="hidden sm:flex items-center gap-1.5 hover:opacity-80 transition-opacity group"
              title="Editar perfil"
            >
              <div className="flex flex-col items-end">
                <span className="text-xs font-medium text-white group-hover:text-primary transition-colors">{currentUser.name}</span>
                <span className="text-xs text-smc-muted capitalize">{currentUser.department}</span>
              </div>
              <UserCog className="w-3.5 h-3.5 text-smc-muted group-hover:text-primary transition-colors" />
            </Link>
            <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-smc-card text-smc-muted hover:text-danger" title="Cerrar sesión">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
