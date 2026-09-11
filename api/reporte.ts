/**
 * POST /api/reporte — recibe una Sesion y devuelve un Reporte.
 * Dueño: B. C no toca este archivo (el suyo es api/enviar.ts).
 *
 * Variables de entorno (Vercel → Settings → Environment Variables):
 *   ANTHROPIC_API_KEY   opcional. Sin ella, responde igual pero con
 *                        generado_por:'plantilla' (ver generarReporte.ts).
 */
import type { Sesion } from '../src/contrato.ts'
import { generarReporte } from '../src/diagnostico/generarReporte.ts'

const LIMITE_BYTES = 256 * 1024

function json(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function sesionValida(valor: unknown): valor is Sesion {
  if (typeof valor !== 'object' || valor === null) return false
  const s = valor as Record<string, unknown>
  return (
    typeof s.sesion_id === 'string' &&
    typeof s.contexto === 'object' &&
    s.contexto !== null &&
    Array.isArray(s.mediciones) &&
    s.mediciones.length > 0
  )
}

export async function POST(request: Request): Promise<Response> {
  const largo = Number(request.headers.get('content-length') ?? 0)
  if (largo > LIMITE_BYTES) {
    return json({ error: 'La sesión es demasiado grande.' }, 413)
  }

  let cuerpo: unknown
  try {
    cuerpo = await request.json()
  } catch {
    return json({ error: 'JSON inválido.' }, 400)
  }

  const sesion = (cuerpo as { sesion?: unknown } | null)?.sesion
  if (!sesionValida(sesion)) {
    return json({ error: 'Falta la sesión con al menos una medición.' }, 400)
  }

  const reporte = await generarReporte(sesion)
  return json(reporte)
}
