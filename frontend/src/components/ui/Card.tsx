import { ReactNode } from 'react'
import { clsx } from 'clsx'

interface CardProps {
  children: ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
  title?: string
  subtitle?: string
  action?: ReactNode
}

export function Card({ children, className, hover, onClick, title, subtitle, action }: CardProps) {
  return (
    <div
      className={clsx(
        'bg-smc-card border border-smc-border rounded-xl',
        hover && 'transition-all duration-200 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 cursor-pointer',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {(title || action) && (
        <div className="flex items-center justify-between px-5 pt-5 pb-0">
          <div>
            {title && <h3 className="font-semibold text-white">{title}</h3>}
            {subtitle && <p className="text-sm text-smc-muted mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

export function CardContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('p-5', className)}>{children}</div>
}

export function StatCard({ label, value, icon: Icon, trend, color = 'primary' }: {
  label: string
  value: string | number
  icon?: React.ComponentType<{ className?: string }>
  trend?: { value: number; label: string }
  color?: 'primary' | 'success' | 'warning' | 'danger'
}) {
  const colors = {
    primary: 'text-primary bg-primary/10',
    success: 'text-success bg-success/10',
    warning: 'text-warning bg-warning/10',
    danger: 'text-danger bg-danger/10',
  }

  return (
    <Card>
      <CardContent>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-smc-muted">{label}</p>
            <p className="text-2xl font-bold text-white mt-1">{value}</p>
            {trend && (
              <p className={`text-xs mt-1 ${trend.value >= 0 ? 'text-success' : 'text-danger'}`}>
                {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
              </p>
            )}
          </div>
          {Icon && (
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
              <Icon className="w-5 h-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
