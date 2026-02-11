/**
 * Calculate lap time statistics from an array of lap times in seconds
 */
export function calculateLapStats(lapTimes: number[]) {
  if (lapTimes.length === 0) {
    return { best: 0, avg: 0, worst: 0, stdDev: 0, consistency: 0 }
  }

  const best = Math.min(...lapTimes)
  const worst = Math.max(...lapTimes)
  const avg = lapTimes.reduce((a, b) => a + b, 0) / lapTimes.length

  // Standard deviation (population)
  const variance = lapTimes.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) / lapTimes.length
  const stdDev = Math.sqrt(variance)

  // Consistency score: 10 = perfect (0 deviation), decreases with deviation
  // Normalize: stdDev of 5s = 0 consistency, 0s = 10 consistency
  const consistency = Math.max(0, Math.round((1 - Math.min(stdDev / 5, 1)) * 10 * 10) / 10)

  return {
    best: Math.round(best * 1000) / 1000,
    avg: Math.round(avg * 1000) / 1000,
    worst: Math.round(worst * 1000) / 1000,
    stdDev: Math.round(stdDev * 1000) / 1000,
    consistency,
    lapCount: lapTimes.length,
  }
}

/**
 * Format seconds to MM:SS.mmm display
 */
export function formatLapTime(seconds: number): string {
  if (!seconds || seconds === 0) return '--:--.---'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  const secsStr = secs.toFixed(3).padStart(6, '0')
  return `${String(mins).padStart(2, '0')}:${secsStr}`
}

/**
 * Parse a lap time string (MM:SS.mmm or SS.mmm) to seconds
 */
export function parseLapTime(timeStr: string): number {
  const parts = timeStr.trim().split(':')
  if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseFloat(parts[1])
  }
  return parseFloat(parts[0])
}

/**
 * Calculate delta between two lap times (positive = slower, negative = faster)
 */
export function lapDelta(time: number, reference: number): string {
  const delta = time - reference
  const prefix = delta > 0 ? '+' : ''
  return `${prefix}${delta.toFixed(3)}s`
}

/**
 * Identify outlier laps (more than 2 std deviations from mean)
 */
export function findOutlierLaps(lapTimes: number[]): number[] {
  const { avg, stdDev } = calculateLapStats(lapTimes)
  return lapTimes
    .map((time, index) => ({ time, index }))
    .filter(({ time }) => Math.abs(time - avg) > 2 * stdDev)
    .map(({ index }) => index)
}
