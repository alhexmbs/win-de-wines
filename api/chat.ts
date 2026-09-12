/**
 * POST /api/chat — responde una pregunta puntual sobre un reporte ya generado.
 * Dueño: B.
 *
 * Variables de entorno: usa la misma ANTHROPIC_API_KEY que /api/reporte.
 * Sin ella, responde igual con un mensaje de respaldo (ver chat.ts).
 */
import type { Reporte, Sesion } from '../src/contrato.ts'
import { generarRespuestaChat } from '../src/diagnostico/chat.ts'

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
  return typeof s.sesion_id === 'string' && Array.isArray(s.mediciones) && s.mediciones.length > 0
}

function reporteValido(valor: unknown): valor is Reporte {
  if (typeof valor !== 'object' || valor === null) return false
  const r = valor as Record<string, unknown>
  return Array.isArray(r.cuartos) && typeof r.resumen === 'string'
}

export async function POST(request: Request): Promise<Response> {
  const largo = Number(request.headers.get('content-length') ?? 0)
  if (largo > LIMITE_BYTES) {
    return json({ error: 'La solicitud es demasiado grande.' }, 413)
  }

  let cuerpo: unknown
  try {
    cuerpo = await request.json()
  } catch {
    return json({ error: 'JSON inválido.' }, 400)
  }

  const { sesion, reporte, pregunta } = (cuerpo as Record<string, unknown> | null) ?? {}
  if (!sesionValida(sesion) || !reporteValido(reporte)) {
    return json({ error: 'Falta la sesión y/o el reporte.' }, 400)
  }
  if (typeof pregunta !== 'string' || pregunta.trim().length === 0) {
    return json({ error: 'Falta la pregunta.' }, 400)
  }

  // F8: la respuesta sale en texto plano, trozo a trozo, no como JSON de una
  // sola vez. El cliente la va mostrando a medida que llega (ver src/api.ts).
  const codificador = new TextEncoder()
  const cuerpoStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const trozo of generarRespuestaChat(sesion, reporte, pregunta)) {
          controller.enqueue(codificador.encode(trozo))
        }
      } catch (e) {
        console.error('[api/chat] el stream se cortó a mitad:', e)
      } finally {
        controller.close()
      }
    },
  })

  return new Response(cuerpoStream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
