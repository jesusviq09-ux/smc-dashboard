import axios from 'axios'
import { db } from '../indexeddb/db'
import { useSyncStore } from '@/store/syncStore'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Response interceptor for error handling
apiClient.interceptors.response.use(
  response => response,
  async error => {
    if (!navigator.onLine || error.code === 'ECONNABORTED' || !error.response) {
      // Offline - return cached data or queue mutation
      if (error.config?.method === 'get') {
        // Try to return from IndexedDB cache
        throw { ...error, isOfflineError: true }
      }
    }
    return Promise.reject(error)
  }
)

// Request interceptor - add auth token + queue mutations when offline
apiClient.interceptors.request.use(
  config => {
    try {
      const raw = localStorage.getItem('smc_auth')
      if (raw) {
        const auth = JSON.parse(raw)
        if (auth?.token) {
          config.headers = config.headers ?? {}
          config.headers.Authorization = `Bearer ${auth.token}`
        }
      }
    } catch { /* ignora errores de parse */ }
    return config
  },
  error => Promise.reject(error)
)

/**
 * Make an API call with offline fallback.
 * For GET: returns cached data if offline
 * For mutations: queues in IndexedDB if offline
 */
export async function apiCall<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  data?: unknown,
  cacheKey?: string
): Promise<T> {
  if (!navigator.onLine && method !== 'GET') {
    // Queue the mutation
    const { addToQueue } = useSyncStore.getState()
    addToQueue({ method, url, body: data, timestamp: new Date().toISOString() })
    await db.syncQueue.add({
      method,
      url,
      body: data,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      status: 'pending',
    })
    throw new Error('QUEUED_OFFLINE')
  }

  try {
    const response = await apiClient({ method, url, data })
    return response.data
  } catch (error) {
    if (method === 'GET' && cacheKey) {
      // Try IndexedDB cache
      const cached = await db.table(cacheKey).toArray()
      if (cached.length > 0) return cached as T
    }
    throw error
  }
}
