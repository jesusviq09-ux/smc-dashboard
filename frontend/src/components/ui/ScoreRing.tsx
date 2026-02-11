interface ScoreRingProps {
  score: number      // 0-10
  size?: number      // px
  strokeWidth?: number
  label?: string
  showValue?: boolean
}

export default function ScoreRing({
  score,
  size = 80,
  strokeWidth = 6,
  label,
  showValue = true,
}: ScoreRingProps) {
  const radius = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  const progress = (score / 10) * circumference
  const gap = circumference - progress

  const color = score >= 8 ? '#3fb950' : score >= 6 ? '#00d4ff' : score >= 4 ? '#d29922' : '#f85149'

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="rotate-[-90deg]">
          {/* Background ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#30363d"
            strokeWidth={strokeWidth}
          />
          {/* Progress ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${progress} ${gap}`}
            strokeLinecap="round"
            className="score-ring"
          />
        </svg>
        {showValue && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="font-bold tabular-nums"
              style={{ fontSize: size * 0.22, color }}
            >
              {score.toFixed(1)}
            </span>
          </div>
        )}
      </div>
      {label && (
        <span className="text-xs text-smc-muted text-center leading-tight">{label}</span>
      )}
    </div>
  )
}
