import { Circuit, Pilot, RecommendationOutput, RacePriorityMode, RaceCategory } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnalysisPayload {
  recommendation: RecommendationOutput
  input: { category: RaceCategory; durationMinutes: number; priorityMode: RacePriorityMode }
  circuit?: Circuit
  pilots: Pilot[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

// ─── Public API ───────────────────────────────────────────────────────────────

/** Returns true only if a Gemini API key is configured */
export function isGeminiAvailable(): boolean {
  return !!GEMINI_API_KEY && GEMINI_API_KEY.trim().length > 0
}

/**
 * Sends the race strategy to Gemini 1.5 Flash and returns a tactical
 * analysis in Spanish (3-5 sentences).
 *
 * Throws on network error or Gemini API error — caller should handle.
 */
export async function analyzeStrategy(payload: AnalysisPayload): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('VITE_GEMINI_API_KEY no configurada')
  }

  const prompt = buildPrompt(payload)

  const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 512,
      },
    }),
  })

  if (!response.ok) {
    const err = await response.text().catch(() => response.statusText)
    throw new Error(`Gemini API error ${response.status}: ${err}`)
  }

  const data = await response.json()
  const text: string | undefined =
    data?.candidates?.[0]?.content?.parts?.[0]?.text

  if (!text) {
    throw new Error('Gemini no devolvió texto')
  }

  return text.trim()
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(payload: AnalysisPayload): string {
  const { recommendation, input, circuit, pilots } = payload

  const circuitInfo = circuit
    ? [
        `Circuito: ${circuit.name} (${circuit.city})`,
        `  · Exigencia técnica: ${circuit.demandingTechnical ?? 'N/A'}/10`,
        `  · Exigencia física: ${circuit.demandingPhysical ?? 'N/A'}/10`,
        `  · Consumo energético: ${circuit.energyConsumption ?? 'N/A'}/10`,
        `  · Dificultad adelantamiento: ${circuit.overtakingDifficulty ?? 'N/A'}/10`,
      ].join('\n')
    : 'Circuito: no especificado'

  const carsInfo = recommendation.vehicleAssignments
    .map(a => {
      const stintLines = a.stints
        .map(s => {
          const pilot = pilots.find(x => x.id === s.pilot.id) ?? s.pilot
          const r = pilot.ratings
          const ratingStr = r
            ? `driving ${r.driving}/10, energía ${r.energyManagement}/10, consistencia ${r.consistency}/10, exp ${r.experience}/10`
            : ''
          return `  Stint ${s.stintNumber} (${s.plannedDurationMinutes} min, ${s.objective}): ${pilot.fullName}${ratingStr ? ` — ${ratingStr}` : ''}`
        })
        .join('\n')
      return [
        `Coche: ${a.vehicle.name} (${a.vehicle.material}, ${a.vehicle.weightKg} kg)`,
        stintLines,
        `  Energía total estimada: ${a.totalEnergyEstimateWh} Wh`,
        `  Probabilidad de finalizar: ${(a.finishProbability * 100).toFixed(0)}%`,
      ].join('\n')
    })
    .join('\n\n')

  const warningsStr =
    recommendation.warnings.length > 0
      ? `\nADVERTENCIAS: ${recommendation.warnings.join('; ')}`
      : ''

  return `Eres un estratega experto en karting eléctrico F24/F24+. Analiza la siguiente estrategia de carrera y da 3-4 sugerencias tácticas concretas y útiles en español. Sé directo y técnico. No repitas los datos que ya aparecen, añade valor real.

DATOS DE LA CARRERA
-------------------
Categoría: ${input.category} (${input.durationMinutes} min)
Modo de prioridad: ${input.priorityMode}
${circuitInfo}

ESTRATEGIA GENERADA
-------------------
${carsInfo}
${warningsStr}

Responde con 3-4 frases cortas y concretas. Sin encabezados ni viñetas, solo párrafo continuo.`
}
