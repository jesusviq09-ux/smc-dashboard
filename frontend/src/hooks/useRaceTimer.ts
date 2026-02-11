import { useState, useEffect, useRef, useCallback } from 'react'

interface UseRaceTimerOptions {
  durationSeconds: number
  onStintAlert?: (elapsed: number) => void
  stintAlertTimes?: number[]  // seconds from race start when to alert
}

interface RaceTimerState {
  elapsed: number      // seconds
  remaining: number    // seconds
  isRunning: boolean
  isFinished: boolean
  startTimestamp: number | null
}

export function useRaceTimer({ durationSeconds, onStintAlert, stintAlertTimes = [] }: UseRaceTimerOptions) {
  const [state, setState] = useState<RaceTimerState>({
    elapsed: 0,
    remaining: durationSeconds,
    isRunning: false,
    isFinished: false,
    startTimestamp: null,
  })

  const workerRef = useRef<Worker | null>(null)
  const alertedTimesRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    // Create inline worker for accurate timing
    const workerCode = `
      let interval = null;
      self.onmessage = function(e) {
        if (e.data.type === 'START') {
          if (interval) clearInterval(interval);
          interval = setInterval(() => {
            self.postMessage({ type: 'TICK', timestamp: Date.now() });
          }, 250);
        } else if (e.data.type === 'STOP') {
          if (interval) clearInterval(interval);
          interval = null;
        }
      };
    `
    const blob = new Blob([workerCode], { type: 'application/javascript' })
    workerRef.current = new Worker(URL.createObjectURL(blob))

    workerRef.current.onmessage = (e) => {
      if (e.data.type === 'TICK') {
        setState(prev => {
          if (!prev.isRunning || !prev.startTimestamp) return prev

          const elapsed = Math.floor((e.data.timestamp - prev.startTimestamp) / 1000)
          const remaining = Math.max(0, durationSeconds - elapsed)
          const isFinished = elapsed >= durationSeconds

          // Check stint alerts
          if (onStintAlert) {
            for (const alertTime of stintAlertTimes) {
              if (elapsed >= alertTime && !alertedTimesRef.current.has(alertTime)) {
                alertedTimesRef.current.add(alertTime)
                onStintAlert(elapsed)
              }
            }
          }

          if (isFinished && prev.isRunning) {
            workerRef.current?.postMessage({ type: 'STOP' })
          }

          return { ...prev, elapsed, remaining, isFinished: isFinished ? true : prev.isFinished }
        })
      }
    }

    return () => {
      workerRef.current?.postMessage({ type: 'STOP' })
      workerRef.current?.terminate()
    }
  }, [durationSeconds, onStintAlert]) // eslint-disable-line react-hooks/exhaustive-deps

  const start = useCallback((resumeFromElapsed?: number) => {
    const now = Date.now()
    const offset = resumeFromElapsed ? resumeFromElapsed * 1000 : 0
    const startTimestamp = now - offset

    setState(prev => ({
      ...prev,
      isRunning: true,
      isFinished: false,
      startTimestamp,
      elapsed: resumeFromElapsed ?? 0,
      remaining: durationSeconds - (resumeFromElapsed ?? 0),
    }))

    workerRef.current?.postMessage({ type: 'START' })
  }, [durationSeconds])

  const pause = useCallback(() => {
    workerRef.current?.postMessage({ type: 'STOP' })
    setState(prev => ({ ...prev, isRunning: false }))
  }, [])

  const reset = useCallback(() => {
    workerRef.current?.postMessage({ type: 'STOP' })
    alertedTimesRef.current.clear()
    setState({
      elapsed: 0,
      remaining: durationSeconds,
      isRunning: false,
      isFinished: false,
      startTimestamp: null,
    })
  }, [durationSeconds])

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  return {
    ...state,
    start,
    pause,
    reset,
    formatTime,
    formattedElapsed: formatTime(state.elapsed),
    formattedRemaining: formatTime(state.remaining),
    progressPct: Math.min(100, (state.elapsed / durationSeconds) * 100),
  }
}
