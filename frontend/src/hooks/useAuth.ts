import { useState, useCallback } from 'react'
import { apiClient } from '@/services/api/client'

export interface AuthUser {
  id: string
  email: string
  name: string
  department: string
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
