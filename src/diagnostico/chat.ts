/**
 * chat.ts — B, día 2.
 *
 * Igual que generarReporte.ts: nunca lanza. Sin API key o si el LLM falla
 * tras el reintento, devuelve un mensaje de respaldo fijo en vez de romper
 * la demo. Sin historial entre preguntas: cada una se responde sola, con
 * todo el contexto del reporte, así no hay estado que mantener ni perder.
 */
import type { Reporte, Sesion } from '../contrato.ts'

const MODELO = 'claude-haiku-4-5-20251001'
const MS_TIMEOUT = 12_000
const INTENTOS = 2 // 1 intento + 1 reintento
const MAX_PREGUNTA = 300

export const RESPUESTA_RESPALDO =
  'No puedo responder eso ahora mismo. Revisa las recomendaciones del reporte arriba, o contáctate con WIN si la duda sigue.'

/**
 * El LLM solo puede usar lo que ya está en sesion/reporte — se le prohíbe
 * calcular o inventar números nuevos, igual que en prompt.ts del reporte.
 */
export function construirPromptChat(sesion: Sesion, reporte: Reporte, pregunta: string): string {
  return `Eres el asistente de WIN que responde dudas sobre el reporte de wifi de un cliente. Habla en español simple, sin jerga técnica, en máximo 3 frases.

REGLAS ESTRICTAS:
- Responde SOLO con datos de este reporte. No inventes números, cuartos ni recomendaciones que no estén aquí.
- Si la pregunta no se puede responder con estos datos (ej. pide soporte técnico general, precios, otros temas), dilo y sugiere contactar a WIN.
- No repitas el reporte completo: responde puntual a la pregunta.

CONTEXTO DEL CLIENTE:
- Plan contratado: ${sesion.contexto.plan_mbps ?? 'no lo sabe'} Mbps
- Vivienda: ${sesion.contexto.tipo_vivienda}, ${sesion.contexto.pisos} piso(s)

REPORTE YA GENERADO (fuente única de verdad, no la contradigas):
${JSON.stringify(
  {
    calificacion_general: reporte.calificacion_general,
    titular: reporte.titular,
    resumen: reporte.resumen,
    cuartos: reporte.cuartos,
    causa_probable: reporte.causa_probable,
    recomendaciones: reporte.recomendaciones,
    requiere_visita_tecnica: reporte.requiere_visita_tecnica,
  },
  null,
  2,
)}

PREGUNTA DEL CLIENTE: ${pregunta}`
}

function limpiarPregunta(pregunta: unknown): string | null {
  if (typeof pregunta !== 'string') return null
  const limpia = pregunta.trim().slice(0, MAX_PREGUNTA)
  return limpia.length > 0 ? limpia : null
}

async function pedirRespuestaAlLLM(prompt: string, apiKey: string): Promise<string> {
  const control = new AbortController()
  const t = setTimeout(() => control.abort(), MS_TIMEOUT)
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: control.signal,
    })
    if (!res.ok) throw new Error(`Anthropic respondió ${res.status}`)
    const data = (await res.json()) as { content: { text: string }[] }
    const texto = data.content[0]?.text?.trim()
    if (!texto) throw new Error('Respuesta vacía del LLM')
    return texto
  } finally {
    clearTimeout(t)
  }
}

/** Nunca lanza. Sin key, pregunta vacía, o LLM caído: RESPUESTA_RESPALDO. */
export async function responderChat(sesion: Sesion, reporte: Reporte, preguntaCruda: unknown): Promise<string> {
  const pregunta = limpiarPregunta(preguntaCruda)
  if (pregunta === null) return RESPUESTA_RESPALDO

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return RESPUESTA_RESPALDO

  const prompt = construirPromptChat(sesion, reporte, pregunta)
  for (let intento = 1; intento <= INTENTOS; intento++) {
    try {
      return await pedirRespuestaAlLLM(prompt, apiKey)
    } catch (e) {
      console.error(`[responderChat] intento ${intento}/${INTENTOS} falló:`, e)
    }
  }
  return RESPUESTA_RESPALDO
}
