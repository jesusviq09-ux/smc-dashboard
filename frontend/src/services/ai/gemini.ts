import { Circuit, Pilot, RecommendationOutput, RacePriorityMode, RaceCategory } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnalysisPayload {
  recommendation: RecommendationOutput
  input: { category: RaceCategory; durationMinutes: number; priorityMode: RacePriorityMode }
  circuit?: Circuit
  pilots: Pilot[]
}

// ─── Constants ────────────────────────────────────────────────────────────────
// Uses OpenRouter (https://openrouter.ai) — free tier, no billing required.
// Model: meta-llama/llama-3.1-8b-instruct:free
// Limits (free): 20 req/min, 200 req/day — no credit card needed.
// Get a free key at: https://openrouter.ai/keys

const AI_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'meta-llama/llama-3.1-8b-instruct:free'

// ─── Public API ───────────────────────────────────────────────────────────────

/** Returns true only if an OpenRouter API key is configured */
export function isGeminiAvailable(): boolean {
  return !!AI_API_KEY && AI_API_KEY.trim().length > 0
}

/**
 * Sends the race strategy to OpenRouter (Llama 3.1 8B free) and returns
 * a tactical analysis in Spanish (3-4 sentences).
 *
 * Throws on network error or API error — caller should handle.
 */
export async function analyzeStrategy(payload: AnalysisPayload): Promise<string> {
  if (!AI_API_KEY) {
    throw new Error('VITE_OPENROUTER_API_KEY no configurada')
  }

  const prompt = buildPrompt(payload)

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AI_API_KEY}`,
      'HTTP-Referer': 'https://smc-dashboard.vercel.app',
      'X-Title': 'SMC Dashboard',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 400,
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Límite de solicitudes alcanzado (200/día en tier gratuito). Inténtalo mañana o consigue más créditos en openrouter.ai.')
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error('Clave de API inválida. Comprueba VITE_OPENROUTER_API_KEY en Vercel → Settings → Environment Variables.')
    }
    const err = await response.text().catch(() => response.statusText)
    throw new Error(`Error IA ${response.status}: ${err}`)
  }

  const data = await response.json()
  const text: string | undefined = data?.choices?.[0]?.message?.content

  if (!text) {
    throw new Error('La IA no devolvió texto')
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
