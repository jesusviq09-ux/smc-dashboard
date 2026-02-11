import { db } from '../indexeddb/db'
import { apiClient } from '../api/client'
import { useSyncStore } from '@/store/syncStore'

/**
 * Process all pending items in the sync queue.
 * Called when the app comes back online.
 */
export async function processSyncQueue(): Promise<void> {
  const pending = await db.syncQueue
    .where('status')
    .equals('pending')
    .toArray()

  if (pending.length === 0) return

  const { setPendingCount } = useSyncStore.getState()

  for (const item of pending) {
    if (!item.id) continue

    // Mark as processing
    await db.syncQueue.update(item.id, { status: 'processing' })

    try {
      await apiClient({
        method: item.method,
        url: item.url,
        data: item.body,
      })

      // Success - remove from queue
      await db.syncQueue.delete(item.id)
    } catch (error) {
      const retryCount = (item.retryCount ?? 0) + 1

      if (retryCount >= 3) {
        await db.syncQueue.update(item.id, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          retryCount,
        })
      } else {
        await db.syncQueue.update(item.id, {
          status: 'pending',
          retryCount,
        })
      }
    }
  }

  // Update pending count
  const remainingCount = await db.syncQueue.where('status').equals('pending').count()
  setPendingCount(remainingCount)
}

/**
 * Register Background Sync for when the browser regains connectivity
 * even if the app tab is closed.
 */
export async function registerBackgroundSync(): Promise<void> {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const reg = await navigator.serviceWorker.ready
      await (reg as ServiceWorkerRegistration & {
        sync: { register: (tag: string) => Promise<void> }
      }).sync.register('smc-sync-queue')
    } catch {
      // iOS Safari: fallback to visibilitychange
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && navigator.onLine) {
          processSyncQueue()
        }
      })
    }
  } else {
    // Fallback for non-supporting browsers
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        processSyncQueue()
      }
    })
  }
}

/**
 * Get count of pending sync items
 */
export async function getPendingSyncCount(): Promise<number> {
  return db.syncQueue.where('status').equals('pending').count()
}
