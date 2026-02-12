import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Zap, ArrowLeft } from 'lucide-react'
import { apiClient } from '@/services/api/client'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await apiClient.post('/auth/forgot-password', { email })
      setSent(true)
    } catch {
      setError('Error al enviar el enlace. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-smc-dark flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 mb-4">
            <Zap className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-white">SMC Dashboard</h1>
          <p className="text-smc-muted text-sm mt-1">Recuperar contraseña</p>
        </div>

        <div className="bg-smc-card border border-smc-border rounded-2xl p-6 space-y-4">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center mx-auto">
                <span className="text-2xl">✉️</span>
              </div>
              <p className="text-white font-semibold">Enlace enviado</p>
              <p className="text-sm text-smc-muted">
                Si el email existe en el sistema, recibirás un enlace para restablecer tu contraseña en breve.
              </p>
              <Link to="/login" className="btn-primary w-full justify-center block text-center">
                Volver al inicio de sesión
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-white">¿Olvidaste tu contraseña?</h2>
              <p className="text-sm text-smc-muted">
                Introduce tu email y te enviaremos un enlace para restablecerla.
              </p>

              {error && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="input-field"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
                  {loading ? 'Enviando...' : 'Enviar enlace'}
                </button>
              </form>

              <Link to="/login" className="flex items-center gap-1 text-sm text-smc-muted hover:text-white transition-colors justify-center">
                <ArrowLeft className="w-4 h-4" /> Volver al inicio de sesión
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
