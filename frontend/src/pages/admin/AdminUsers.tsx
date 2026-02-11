import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, ShieldOff, Save, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { adminApi, type AdminUser } from '@/services/api/admin.api'
import { getStoredUser } from '@/hooks/useAuth'

const SECTIONS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'pilots', label: 'Pilotos' },
  { key: 'training', label: 'Entrenamientos' },
  { key: 'races', label: 'Carreras' },
  { key: 'maintenance', label: 'Mantenimiento' },
  { key: 'circuits', label: 'Circuitos' },
  { key: 'chat', label: 'Comunicación' },
  { key: 'stats', label: 'Estadísticas' },
  { key: 'goals', label: 'Objetivos' },
  { key: 'exports', label: 'Exportar' },
  { key: 'notices_write', label: 'Gestionar avisos' },
  { key: 'accounting', label: 'Contabilidad' },
]

export default function AdminUsers() {
  const currentUser = getStoredUser()
  const qc = useQueryClient()

  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-smc-muted">
        <ShieldOff className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-lg font-semibold">Acceso restringido</p>
        <p className="text-sm">Solo los administradores pueden acceder a esta sección.</p>
      </div>
    )
  }

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: adminApi.getUsers,
  })

  const [pendingPerms, setPendingPerms] = useState<Record<string, string[]>>({})
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)

  const permsMutation = useMutation({
    mutationFn: ({ userId, permissions }: { userId: string; permissions: string[] }) =>
      adminApi.updatePermissions(userId, permissions),
    onSuccess: (_, { userId }) => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      setSaveSuccess(userId)
      setTimeout(() => setSaveSuccess(null), 2000)
      setPendingPerms(p => { const n = { ...p }; delete n[userId]; return n })
    },
  })

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'admin' | 'user' }) =>
      adminApi.updateRole(userId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const getUserPerms = (user: AdminUser): string[] =>
    pendingPerms[user.id] ?? user.permissions ?? []

  const togglePerm = (userId: string, current: string[], key: string) => {
    const next = current.includes(key) ? current.filter(p => p !== key) : [...current, key]
    setPendingPerms(p => ({ ...p, [userId]: next }))
  }

  if (isLoading) {
    return <div className="text-smc-muted p-8">Cargando usuarios...</div>
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <ShieldCheck className="w-6 h-6 text-primary" />
        <h1 className="section-title mb-0">Administración de usuarios</h1>
      </div>

      <p className="text-sm text-smc-muted">
        Gestiona los permisos de acceso a secciones de cada usuario. Si un usuario no tiene restricciones (sin secciones marcadas),
        tendrá acceso completo a la aplicación. Marca las secciones que sí puede ver para limitar su acceso.
      </p>

      <div className="space-y-4">
        {users.map(user => {
          const isMainAdmin = user.email.toLowerCase() === 'smcgreenpower@gmail.com'
          const perms = getUserPerms(user)
          const hasPending = pendingPerms[user.id] !== undefined

          return (
            <Card key={user.id}>
              <CardContent>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary text-sm">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{user.name}</p>
                      <p className="text-xs text-smc-muted">{user.email} · {user.department}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isMainAdmin ? (
                      <span className="badge-primary text-xs">Admin principal</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <select
                          className="input-field text-xs py-1 px-2 w-28"
                          value={user.role}
                          onChange={e => roleMutation.mutate({ userId: user.id, role: e.target.value as 'admin' | 'user' })}
                        >
                          <option value="user">Usuario</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {!isMainAdmin && (
                  <>
                    <p className="text-xs text-smc-muted mb-3 font-medium uppercase tracking-wider">
                      Secciones permitidas <span className="normal-case font-normal">(vacío = acceso total)</span>
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                      {SECTIONS.map(section => (
                        <label key={section.key} className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={perms.includes(section.key)}
                            onChange={() => togglePerm(user.id, perms, section.key)}
                            className="w-4 h-4 rounded accent-primary"
                          />
                          <span className="text-sm text-smc-text group-hover:text-white transition-colors">{section.label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      {saveSuccess === user.id && (
                        <span className="text-xs text-success">✓ Guardado</span>
                      )}
                      <button
                        onClick={() => permsMutation.mutate({ userId: user.id, permissions: perms })}
                        disabled={!hasPending || permsMutation.isPending}
                        className="btn-primary text-sm flex items-center gap-2 py-1.5"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {permsMutation.isPending ? 'Guardando...' : 'Guardar permisos'}
                      </button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {users.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-smc-muted">
          <Users className="w-10 h-10 mb-2 opacity-30" />
          <p>No hay usuarios registrados</p>
        </div>
      )}
    </div>
  )
}
