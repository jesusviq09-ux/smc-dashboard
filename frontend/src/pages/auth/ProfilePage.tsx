import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, UserCog, Save, CheckCircle, X } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { apiClient } from '@/services/api/client'
import { getStoredUser } from '@/hooks/useAuth'
import type { AuthUser } from '@/hooks/useAuth'

const DEPARTMENT_OPTIONS = [
  { value: 'technical', label: 'Técnico / Mecánico' },
  { value: 'pilot', label: 'Piloto' },
  { value: 'management', label: 'Dirección / Jefe de equipo' },
  { value: 'logistics', label: 'Logística' },
  { value: 'data', label: 'Análisis de datos / Telemetría' },
  { value: 'safety', label: 'Seguridad' },
  { value: 'communications', label: 'Comunicaciones' },
]

export default function ProfilePage() {
  const currentUser = getStoredUser()

  // Parse current department: may be a comma-separated list of roles
  const parseDept = (dept: string): string[] => {
    if (!dept) return []
    return dept.split(',').map(r => r.trim()).filter(Boolean)
  }

  const [name, setName] = useState(currentUser?.name ?? '')
  const [selectedRoles, setSelectedRoles] = useState<string[]>(parseDept(currentUser?.department ?? ''))
  const [customRole, setCustomRole] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const toggleRole = (value: string) => {
    setSelectedRoles(prev =>
      prev.includes(value) ? prev.filter(r => r !== value) : [...prev, value]
    )
  }

  const addCustomRole = () => {
    const trimmed = customRole.trim()
    if (trimmed && !selectedRoles.includes(trimmed)) {
      setSelectedRoles(prev => [...prev, trimmed])
    }
    setCustomRole('')
  }

  const removeRole = (role: string) => setSelectedRoles(prev => prev.filter(r => r !== role))

  const getDepartmentLabel = () => selectedRoles.join(', ') || currentUser?.department || ''

  const mutation = useMutation({
    mutationFn: () => apiClient.put<{ user: AuthUser }>('/auth/profile', {
      name: name.trim(),
      department: getDepartmentLabel(),
    }),
    onSuccess: ({ data }) => {
      // Update localStorage with fresh data
      try {
        const raw = localStorage.getItem('smc_auth')
        if (raw) {
          const auth = JSON.parse(raw)
          localStorage.setItem('smc_auth', JSON.stringify({ ...auth, user: data.user }))
        }
      } catch { /* ignore */ }
      setSuccess(true)
      setError(null)
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error || 'Error al guardar el perfil. Inténtalo de nuevo.')
      setSuccess(false)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('El nombre no puede estar vacío'); return }
    setError(null)
    setSuccess(false)
    mutation.mutate()
  }

  return (
    <div className="space-y-6 max-w-lg">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/dashboard" className="p-2 rounded-lg hover:bg-smc-card text-smc-muted">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
            <UserCog className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Mi perfil</h1>
            <p className="text-xs text-smc-muted">{currentUser?.email}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-smc-card border border-smc-border rounded-2xl p-6 space-y-5">

        {/* Success banner */}
        {success && (
          <div className="flex items-center gap-2 rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-400">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            Perfil actualizado correctamente.
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Name */}
        <div>
          <label className="form-label">Nombre completo *</label>
          <input
            type="text"
            className="input-field"
            placeholder="Tu nombre"
            value={name}
            onChange={e => { setName(e.target.value); setSuccess(false) }}
            required
          />
        </div>

        {/* Department multi-select */}
        <div>
          <label className="form-label">
            Cargo / Departamento
            <span className="text-smc-muted font-normal ml-1">(puedes elegir varios)</span>
          </label>

          {/* Selected tags */}
          {selectedRoles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {selectedRoles.map(role => (
                <span key={role} className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/20 border border-primary/40 text-xs text-primary">
                  {role}
                  <button type="button" onClick={() => removeRole(role)} className="hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Checkboxes */}
          <div className="grid grid-cols-1 gap-1.5 mb-2">
            {DEPARTMENT_OPTIONS.map(opt => (
              <label key={opt.value} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors text-sm ${
                selectedRoles.includes(opt.value)
                  ? 'border-primary/60 bg-primary/10 text-white'
                  : 'border-smc-border hover:border-primary/30 text-smc-muted'
              }`}>
                <input
                  type="checkbox"
                  checked={selectedRoles.includes(opt.value)}
                  onChange={() => { toggleRole(opt.value); setSuccess(false) }}
                  className="w-3.5 h-3.5 accent-primary"
                />
                {opt.label}
              </label>
            ))}
          </div>

          {/* Custom role input */}
          <div className="flex gap-2">
            <input
              type="text"
              className="input-field flex-1 text-sm"
              placeholder="Otro cargo (escribe y pulsa Añadir)"
              value={customRole}
              onChange={e => setCustomRole(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomRole() } }}
            />
            <button
              type="button"
              onClick={addCustomRole}
              disabled={!customRole.trim()}
              className="btn-secondary text-sm px-3"
            >
              Añadir
            </button>
          </div>
        </div>

        {/* Read-only info */}
        <div className="bg-smc-darker rounded-xl border border-smc-border p-4 space-y-2">
          <p className="text-xs font-semibold text-smc-muted uppercase tracking-wider mb-2">Información de cuenta</p>
          <div className="flex justify-between text-sm">
            <span className="text-smc-muted">Email</span>
            <span className="text-white font-medium">{currentUser?.email}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-smc-muted">Rol</span>
            <span className={`font-medium ${currentUser?.role === 'admin' ? 'text-primary' : 'text-smc-text'}`}>
              {currentUser?.role === 'admin' ? 'Administrador' : 'Usuario'}
            </span>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={mutation.isPending || !name.trim()}
            className="btn-primary flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {mutation.isPending ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}
