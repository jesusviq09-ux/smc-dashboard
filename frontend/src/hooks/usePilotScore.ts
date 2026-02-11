import { useMemo } from 'react'
import { PilotRatings } from '@/types'
import { calculateWeightedScore, calculateVehicleAffinity } from '@/utils/pilotScore'
import { useAppConfigStore } from '@/store/appConfigStore'

export function usePilotScore(ratings: PilotRatings, weightKg: number) {
  const { config } = useAppConfigStore()

  return useMemo(() => {
    return calculateWeightedScore(ratings, weightKg, {
      penaltyThresholdKg: config.weightPenaltyThresholdKg,
      penaltyPer10kg: config.weightPenaltyPer10kg,
    })
  }, [ratings, weightKg, config.weightPenaltyThresholdKg, config.weightPenaltyPer10kg])
}

export function useVehicleAffinity(weightKg: number, vehicleId: string) {
  return useMemo(() => calculateVehicleAffinity(weightKg, vehicleId), [weightKg, vehicleId])
}
