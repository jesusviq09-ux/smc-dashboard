import { useQuery } from '@tanstack/react-query'
import { maintenanceApi } from '@/services/api/maintenance.api'

export function useMaintenanceAlerts() {
  const { data } = useQuery({
    queryKey: ['maintenance-alerts'],
    queryFn: maintenanceApi.getAlerts,
    staleTime: 1000 * 60 * 10, // 10 minutes
  })

  return {
    alertCount: data?.length ?? 0,
    alerts: data ?? [],
  }
}
