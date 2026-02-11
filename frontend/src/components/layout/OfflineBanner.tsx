import { WifiOff, CloudOff } from 'lucide-react'
import { useSyncStore } from '@/store/syncStore'

export default function OfflineBanner() {
  const { pendingCount } = useSyncStore()

  return (
    <div className="bg-warning/10 border-b border-warning/20 px-4 py-2">
      <div className="flex items-center gap-2 text-warning text-sm">
        <WifiOff className="w-4 h-4 flex-shrink-0" />
        <span className="font-medium">Modo offline</span>
        <span className="text-warning/70">–</span>
        <span className="text-warning/70">
          Los datos se guardan localmente y se sincronizarán al recuperar la conexión.
          {pendingCount > 0 && ` (${pendingCount} cambio${pendingCount !== 1 ? 's' : ''} pendiente${pendingCount !== 1 ? 's' : ''})`}
        </span>
        {pendingCount > 0 && (
          <CloudOff className="w-4 h-4 flex-shrink-0 ml-auto" />
        )}
      </div>
    </div>
  )
}
