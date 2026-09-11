/**
 * generarReporte.ts — B, día 1.
 *
 * Orquesta reglas.ts (siempre corre, nunca falla) + un intento de mejorar el
 * texto con el LLM (1 reintento, con validación estricta de la respuesta).
 * Usado por api/reporte.ts (producción) y por probar.ts (prueba en laptop).
 */
import type { Reporte, Sesion } from '../contrato.ts'
import { diagnosticar } from './reglas.ts'
import { construirPrompt } from './prompt.ts'

const MODELO = 'claude-haiku-4-5-20251001'
const MS_TIMEOUT = 12_000
const INTENTOS = 2 // 1 intento + 1 reintento

interface TextoLLM {
  titular: string
  resumen: string
  causa_probable: string
  cuartos: { cuarto: string; explicacion: string }[]
  recomendaciones: { titulo: string; detalle: string }[]
}

function esTextoLLMValido(valor: unknown, base: Reporte): valor is TextoLLM {
  if (typeof valor !== 'object' || valor === null) return false
  const v = valor as Record<string, unknown>
  if (typeof v.titular !== 'string' || typeof v.resumen !== 'string' || typeof v.causa_probable !== 'string') return false
  if (!Array.isArray(v.cuartos) || v.cuartos.length !== base.cuartos.length) return false
  if (!Array.isArray(v.recomendaciones) || v.recomendaciones.length !== base.recomendaciones.length) return false
  return v.cuartos.every(
    (c, i) =>
      typeof c === 'object' &&
      c !== null &&
      (c as Record<string, unknown>).cuarto === base.cuartos[i].cuarto &&
      typeof (c as Record<string, unknown>).explicacion === 'string',
  )
}

function extraerJson(texto: string): unknown {
  const limpio = texto.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim()
  return JSON.parse(limpio)
}

async function pedirTextoAlLLM(base: Reporte, apiKey: string): Promise<TextoLLM> {
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
        max_tokens: 1024,
        messages: [{ role: 'user', content: construirPrompt(base) }],
      }),
      signal: control.signal,
    })
    if (!res.ok) throw new Error(`Anthropic respondió ${res.status}`)
    const data = (await res.json()) as { content: { text: string }[] }
    const texto = extraerJson(data.content[0].text)
    if (!esTextoLLMValido(texto, base)) throw new Error('Respuesta del LLM con forma inesperada')
    return texto
  } finally {
    clearTimeout(t)
  }
}

function fusionar(base: Reporte, texto: TextoLLM): Reporte {
  return {
    ...base,
    generado_por: 'ia',
    titular: texto.titular,
    resumen: texto.resumen,
    causa_probable: texto.causa_probable,
    cuartos: base.cuartos.map((c, i) => ({ ...c, explicacion: texto.cuartos[i].explicacion })),
    recomendaciones: base.recomendaciones.map((r, i) => ({ ...r, detalle: texto.recomendaciones[i].detalle })),
  }
}

/**
 * Nunca lanza: si no hay API key o el LLM falla tras el reintento,
 * devuelve el reporte de reglas.ts tal cual (generado_por: 'plantilla').
 */
export async function generarReporte(sesion: Sesion): Promise<Reporte> {
  const base = diagnosticar(sesion)
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return base

  for (let intento = 1; intento <= INTENTOS; intento++) {
    try {
      const texto = await pedirTextoAlLLM(base, apiKey)
      return fusionar(base, texto)
    } catch (e) {
      console.error(`[generarReporte] intento ${intento}/${INTENTOS} falló:`, e)
    }
  }
  return base
}
