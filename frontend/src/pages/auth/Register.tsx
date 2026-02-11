import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Zap } from 'lucide-react'

const DEPARTMENTS = [
  { value: 'technical', label: 'Técnico / Mecánico' },
  { value: 'pilot', label: 'Piloto' },
  { value: 'management', label: 'Dirección / Jefe de equipo' },
  { value: 'logistics', label: 'Logística' },
]

export default function Register() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '', name: '', department: 'technical' })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
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
      await register(form.email, form.password, form.name, form.department)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Error al crear la cuenta.')
    } finally {
      setLoading(false)
    }
  }

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  return (
    <div className="min-h-screen bg-smc-dark flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
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

          <div>
            <label className="form-label">Cargo / Departamento *</label>
            <select className="input-field" value={form.department} onChange={set('department')}>
              {DEPARTMENTS.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
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
