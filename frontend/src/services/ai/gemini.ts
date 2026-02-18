import { Circuit, Pilot, RecommendationOutput, RacePriorityMode, RaceCategory, StintObjective } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnalysisPayload {
  recommendation: RecommendationOutput
  input: { category: RaceCategory; durationMinutes: number; priorityMode: RacePriorityMode }
  circuit?: Circuit
  pilots: Pilot[]
}

export interface AIStrategyOutput {
  /** Tactical analysis text (3-4 sentences in Spanish) */
  analysis: string
  /** Suggested alternative strategy — present only if AI could generate a valid one */
  suggestedStrategy?: {
    vehicleAssignments: {
      vehicleId: string
      stints: {
        stintNumber: number
        pilotId: string
        plannedDurationMinutes: number
        objective: StintObjective
        justification: string
      }[]
    }[]
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────
// Uses OpenRouter (https://openrouter.ai) — free tier, no billing required.
// Model: google/gemma-3n-e4b-it:free
// Limits (free): $0/M tokens, no credit card needed.
// Get a free key at: https://openrouter.ai/keys

const AI_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'google/gemma-3n-e4b-it:free'

// ─── Public API ───────────────────────────────────────────────────────────────

/** Returns true only if an OpenRouter API key is configured */
export function isGeminiAvailable(): boolean {
  return !!AI_API_KEY && AI_API_KEY.trim().length > 0
}

/**
 * Sends the race strategy to OpenRouter (Gemma 3n free) and returns
 * an analysis + an optional suggested alternative strategy.
 *
 * Throws on network error or API error — caller should handle.
 */
export async function analyzeStrategy(payload: AnalysisPayload): Promise<AIStrategyOutput> {
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
      max_tokens: 800,
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
    const errBody = await response.text().catch(() => response.statusText)
    throw new Error(`Error IA ${response.status}: ${errBody}`)
  }

  const data = await response.json()
  const text: string | undefined = data?.choices?.[0]?.message?.content

  if (!text) {
    throw new Error('La IA no devolvió texto')
  }

  return parseAIResponse(text.trim(), payload)
}

// ─── Response parser ──────────────────────────────────────────────────────────
// The AI returns a JSON block. If parsing fails, we fall back to plain text analysis.

function parseAIResponse(raw: string, payload: AnalysisPayload): AIStrategyOutput {
  // Extract JSON block from the response (may be wrapped in markdown code fences)
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/)
  const jsonStr = jsonMatch ? (jsonMatch[1] ?? jsonMatch[0]) : null

  if (jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr)
      const analysis: string = parsed.analysis ?? raw
      const suggested = parsed.suggestedStrategy

      // Validate suggested strategy: filter out invalid IDs instead of rejecting entirely
      if (suggested?.vehicleAssignments?.length) {
        const validPilotIds = new Set(payload.pilots.map(p => p.id))
        const validVehicleIds = new Set(
          payload.recommendation.vehicleAssignments.map(a => a.vehicle.id)
        )
        const filteredAssignments = suggested.vehicleAssignments
          .filter((va: any) => validVehicleIds.has(va.vehicleId))
          .map((va: any) => ({
            ...va,
            stints: (va.stints ?? []).filter((s: any) => validPilotIds.has(s.pilotId)),
          }))
          .filter((va: any) => va.stints.length > 0)

        if (filteredAssignments.length > 0) {
          return { analysis, suggestedStrategy: { vehicleAssignments: filteredAssignments } }
        }
        console.warn('[AI] suggestedStrategy descartada — IDs no coinciden:', JSON.stringify(suggested).slice(0, 400))
      }

      // JSON parsed but no valid strategy → return analysis only
      return { analysis }
    } catch {
      // JSON parse failed → fall through to plain text
    }
  }

  // Fallback: treat entire response as analysis text
  return { analysis: raw }
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
          return `  Stint ${s.stintNumber} (${s.plannedDurationMinutes} min, ${s.objective}): ${pilot.fullName} [id:${pilot.id}]${ratingStr ? ` — ${ratingStr}` : ''}`
        })
        .join('\n')
      return [
        `Coche: ${a.vehicle.name} [id:${a.vehicle.id}] (${a.vehicle.material}, ${a.vehicle.weightKg} kg)`,
        stintLines,
        `  Energía total estimada: ${a.totalEnergyEstimateWh} Wh`,
        `  Probabilidad de finalizar: ${(a.finishProbability * 100).toFixed(0)}%`,
      ].join('\n')
    })
    .join('\n\n')

  const pilotsAvailableInfo = pilots
    .map(p => {
      const r = p.ratings
      return `  ${p.fullName} [id:${p.id}] — driving ${r.driving}/10, energía ${r.energyManagement}/10, consistencia ${r.consistency}/10, exp ${r.experience}/10, ${p.weightKg}kg`
    })
    .join('\n')

  const warningsStr =
    recommendation.warnings.length > 0
      ? `\nADVERTENCIAS: ${recommendation.warnings.join('; ')}`
      : ''

  return `Eres un estratega experto en karting eléctrico F24/F24+. Analiza la estrategia de carrera y genera una respuesta en formato JSON con:
1. "analysis": 3-4 frases tácticas concretas y útiles en español. Sé directo y técnico. No repitas los datos, añade valor real.
2. "suggestedStrategy": una estrategia alternativa mejorada usando los MISMOS IDs de pilotos y coches que se te proporcionan (no inventes IDs nuevos). Solo incluye cambios si realmente mejoran la estrategia.

IMPORTANTE: Usa exactamente los IDs tal como aparecen entre [id:...] en los datos.

DATOS DE LA CARRERA
-------------------
Categoría: ${input.category} (${input.durationMinutes} min)
Modo de prioridad: ${input.priorityMode}
${circuitInfo}

PILOTOS DISPONIBLES
-------------------
${pilotsAvailableInfo}

ESTRATEGIA ACTUAL
-----------------
${carsInfo}
${warningsStr}

Responde ÚNICAMENTE con un bloque JSON válido, sin texto adicional fuera del JSON:

\`\`\`json
{
  "analysis": "Texto de análisis táctico aquí.",
  "suggestedStrategy": {
    "vehicleAssignments": [
      {
        "vehicleId": "id-del-coche",
        "stints": [
          {
            "stintNumber": 1,
            "pilotId": "id-del-piloto",
            "plannedDurationMinutes": 36,
            "objective": "CONSERVATIVE",
            "justification": "Razón breve"
          }
        ]
      }
    ]
  }
}
\`\`\``
}
