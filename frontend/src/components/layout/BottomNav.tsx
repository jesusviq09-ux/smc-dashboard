import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, Dumbbell, Trophy, Wrench } from 'lucide-react'

const items = [
  { path: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
  { path: '/pilots', label: 'Pilotos', icon: Users },
  { path: '/training', label: 'Entreno', icon: Dumbbell },
  { path: '/races', label: 'Carrera', icon: Trophy },
  { path: '/maintenance', label: 'Manten.', icon: Wrench },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 bg-smc-darker/95 backdrop-blur-md border-t border-smc-border safe-bottom">
      <div className="flex">
        {items.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) => `
              flex-1 flex flex-col items-center gap-1 py-2 px-1
              text-xs font-medium transition-colors duration-150
              ${isActive ? 'text-primary' : 'text-smc-muted'}
            `}
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
