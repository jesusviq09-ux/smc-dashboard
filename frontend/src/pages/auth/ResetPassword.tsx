import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Zap } from 'lucide-react'
import { apiClient } from '@/services/api/client'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') ?? ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      await apiClient.post('/auth/reset-password', { token, newPassword })
      navigate('/login', { state: { message: 'Contraseña actualizada. Ya puedes iniciar sesión.' } })
    } catch (err: any) {
      setError(err?.response?.data?.error || 'El enlace no es válido o ha expirado.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-smc-dark flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-smc-card border border-smc-border rounded-2xl p-6 text-center space-y-4">
          <p className="text-danger font-semibold">Enlace inválido</p>
          <p className="text-sm text-smc-muted">No se encontró el token de recuperación en la URL.</p>
          <Link to="/forgot-password" className="btn-primary block text-center">Solicitar nuevo enlace</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-smc-dark flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 mb-4">
            <Zap className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-white">SMC Dashboard</h1>
          <p className="text-smc-muted text-sm mt-1">Nueva contraseña</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-smc-card border border-smc-border rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Restablecer contraseña</h2>

          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}{' '}
              {error.includes('válido') && (
                <Link to="/forgot-password" className="underline">Solicitar nuevo enlace</Link>
              )}
            </div>
          )}

          <div>
            <label className="form-label">Nueva contraseña</label>
            <input
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="form-label">Confirmar contraseña</label>
            <input
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
            {loading ? 'Guardando...' : 'Cambiar contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}
