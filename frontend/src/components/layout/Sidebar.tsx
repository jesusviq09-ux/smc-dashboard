import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, Dumbbell, Trophy, Wrench,
  Activity, Map, MessageSquare, BarChart3, Target,
  Download, X, Zap, ChevronRight
} from 'lucide-react'
import { useMaintenanceAlerts } from '@/hooks/useMaintenanceAlerts'

interface SidebarProps {
  onClose?: () => void
}

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/pilots', label: 'Pilotos', icon: Users },
  { path: '/training', label: 'Entrenamientos', icon: Dumbbell },
  { path: '/races', label: 'Carreras', icon: Trophy },
  { path: '/maintenance', label: 'Mantenimiento', icon: Wrench, alerts: true },
  { path: '/telemetry', label: 'Telemetría', icon: Activity },
  { path: '/circuits', label: 'Circuitos', icon: Map },
  { path: '/chat', label: 'Comunicación', icon: MessageSquare },
  { path: '/stats', label: 'Estadísticas', icon: BarChart3 },
  { path: '/goals', label: 'Objetivos', icon: Target },
  { path: '/exports', label: 'Exportar', icon: Download },
]

export default function Sidebar({ onClose }: SidebarProps) {
  const location = useLocation()
  const { alertCount } = useMaintenanceAlerts()

  return (
    <div className="flex flex-col h-full bg-smc-darker border-r border-smc-border">
      {/* Logo */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-smc-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-bold text-white text-sm leading-tight">SMC Dashboard</p>
            <p className="text-xs text-smc-muted">Greenpower F24</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-smc-card text-smc-muted">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ path, label, icon: Icon, alerts }) => {
          const isActive = location.pathname === path || location.pathname.startsWith(path + '/')
          const hasAlert = alerts && alertCount > 0

          return (
            <NavLink
              key={path}
              to={path}
              onClick={onClose}
              className={`
                group flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg
                text-sm font-medium transition-all duration-150
                ${isActive
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-smc-muted hover:text-smc-text hover:bg-smc-card'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-primary' : ''}`} />
                <span>{label}</span>
              </div>
              <div className="flex items-center gap-1">
                {hasAlert && (
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-danger text-white text-xs flex items-center justify-center font-bold">
                    {alertCount > 9 ? '9+' : alertCount}
                  </span>
                )}
                {isActive && <ChevronRight className="w-3 h-3 opacity-50" />}
              </div>
            </NavLink>
          )
        })}
      </nav>

      {/* Vehicles Status Footer */}
      <div className="px-4 py-4 border-t border-smc-border">
        <p className="text-xs text-smc-muted uppercase tracking-wider font-semibold mb-3">Vehículos</p>
        <VehicleStatusMini name="SMC 01" status="green" />
        <VehicleStatusMini name="SMC 02 EVO" status="green" />
      </div>
    </div>
  )
}

function VehicleStatusMini({ name, status }: { name: string; status: 'green' | 'yellow' | 'red' }) {
  const colors = {
    green: 'bg-success',
    yellow: 'bg-warning',
    red: 'bg-danger',
  }

  return (
    <div className="flex items-center gap-2 py-1">
      <div className={`w-2 h-2 rounded-full ${colors[status]}`} />
      <span className="text-xs text-smc-muted">{name}</span>
    </div>
  )
}
