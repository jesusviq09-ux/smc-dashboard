import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Zap, X } from 'lucide-react'

const DEPARTMENT_OPTIONS = [
  { value: 'technical', label: 'Técnico / Mecánico' },
  { value: 'pilot', label: 'Piloto' },
  { value: 'management', label: 'Dirección / Jefe de equipo' },
  { value: 'logistics', label: 'Logística' },
  { value: 'data', label: 'Análisis de datos / Telemetría' },
  { value: 'safety', label: 'Seguridad' },
  { value: 'communications', label: 'Comunicaciones' },
]

export default function Register() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '', name: '' })
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [customRole, setCustomRole] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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

  const getDepartmentLabel = () => selectedRoles.join(', ') || 'Sin cargo'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (selectedRoles.length === 0) {
      setError('Selecciona al menos un cargo')
      return
    }
    if (form.password !== form.confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setLoading(true)
    try {
      await register(form.email, form.password, form.name, getDepartmentLabel())
      navigate('/dashboard')
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Error al crear la cuenta.')
    } finally {
      setLoading(false)
    }
  }

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  return (
    <div className="min-h-screen bg-smc-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 mb-4">
            <Zap className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-white">SMC Dashboard</h1>
          <p className="text-smc-muted text-sm mt-1">Greenpower F24 Team</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-smc-card border border-smc-border rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Crear cuenta</h2>

          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="form-label">Nombre completo *</label>
            <input type="text" className="input-field" placeholder="Tu nombre" value={form.name} onChange={set('name')} required />
          </div>

          {/* Multi-select roles */}
          <div>
            <label className="form-label">Cargo / Departamento * <span className="text-smc-muted font-normal">(puedes elegir varios)</span></label>

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
                    onChange={() => toggleRole(opt.value)}
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

          <div>
            <label className="form-label">Email *</label>
            <input type="email" className="input-field" placeholder="tu@email.com" value={form.email} onChange={set('email')} required />
          </div>

          <div>
            <label className="form-label">Contraseña *</label>
            <input type="password" className="input-field" placeholder="Mínimo 6 caracteres" value={form.password} onChange={set('password')} required />
          </div>

          <div>
            <label className="form-label">Confirmar contraseña *</label>
            <input type="password" className="input-field" placeholder="Repite la contraseña" value={form.confirmPassword} onChange={set('confirmPassword')} required />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>

          <p className="text-center text-sm text-smc-muted">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-primary hover:underline">
              Iniciar sesión
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
