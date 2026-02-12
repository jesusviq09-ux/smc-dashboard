import { useState, useCallback, useEffect } from 'react'
import { apiClient } from '@/services/api/client'

export interface AuthUser {
  id: string
  email: string
  name: string
  department: string
  role: 'admin' | 'user'
  permissions: string[]
  receiveEmails: boolean
}

interface AuthState {
  token: string
  user: AuthUser
}

const STORAGE_KEY = 'smc_auth'

function loadAuth(): AuthState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveAuth(state: AuthState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function clearAuth() {
  localStorage.removeItem(STORAGE_KEY)
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState | null>(loadAuth)

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await apiClient.post<AuthState>('/auth/login', { email, password })
    saveAuth(data)
    setAuth(data)
    return data
  }, [])

  const register = useCallback(async (email: string, password: string, name: string, department: string) => {
    const { data } = await apiClient.post<AuthState>('/auth/register', { email, password, name, department })
    saveAuth(data)
    setAuth(data)
    return data
  }, [])

  const logout = useCallback(() => {
    clearAuth()
    setAuth(null)
  }, [])

  return {
    user: auth?.user ?? null,
    token: auth?.token ?? null,
    isLoggedIn: !!auth?.token,
    login,
    register,
    logout,
  }
}

// Singleton helper para leer el usuario fuera de componentes React
export function getStoredUser(): AuthUser | null {
  const auth = loadAuth()
  return auth?.user ?? null
}

export function getStoredToken(): string | null {
  const auth = loadAuth()
  return auth?.token ?? null
}

/**
 * Refresca los permisos y datos del usuario desde el servidor.
 * Llama a GET /api/auth/me con el token actual y actualiza localStorage.
 * Silencioso si falla (offline, cold start, etc.).
 */
export async function refreshUserFromServer(): Promise<void> {
  try {
    const auth = loadAuth()
    if (!auth?.token) return
    const { data } = await apiClient.get<{ user: AuthUser }>('/auth/me')
    if (data?.user) {
      const updated: AuthState = { token: auth.token, user: data.user }
      saveAuth(updated)
      // Notificar a los componentes que usan useCurrentUser() que los datos han cambiado
      window.dispatchEvent(new CustomEvent('smc-user-updated'))
    }
  } catch {
    // Silencioso — no interrumpir la app si falla el refresh
  }
}

/**
 * Hook reactivo que se actualiza cuando refreshUserFromServer() obtiene datos nuevos.
 * Usar en lugar de getStoredUser() dentro de componentes que necesiten reaccionar
 * a cambios de permisos en tiempo real (ej: Sidebar).
 */
export function useCurrentUser(): AuthUser | null {
  const [user, setUser] = useState<AuthUser | null>(getStoredUser)

  useEffect(() => {
    const handler = () => setUser(getStoredUser())
    window.addEventListener('smc-user-updated', handler)
    return () => window.removeEventListener('smc-user-updated', handler)
  }, [])

  return user
}
