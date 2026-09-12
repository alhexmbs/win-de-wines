import type { Reporte, RespuestaEnvio, Sesion, SolicitudEnvio, Contacto } from './contrato'
import { diagnosticar } from './diagnostico/reglas'

/**
 * INTEGRACIÓN 1 hecha: obtenerReporte() llama al endpoint real de B.
 * Para volver al doble (demo sin API, o `vite dev` sin `vercel dev`):
 * VITE_REPORTE_REAL=0 en .env.local o en Vercel. Es variable de build:
 * al cambiarla hay que volver a desplegar.
 *
 * QUÉ DEVUELVE EL DOBLE: antes devolvía uno de tres reportes enlatados de
 * mocks/. Eso hablaba de «Dormitorio 2» y de porcentajes fijos aunque el
 * cliente acabara de medir otra casa, así que el reporte no describía nada de
 * lo que había pasado. Ahora corre diagnosticar() de reglas.ts, que es la MISMA
 * función pura que usa api/reporte.ts en el servidor: sin red y sin I/O, así
 * que también corre en el navegador. El reporte sale de las mediciones reales
 * y se marca generado_por:'plantilla', que es exactamente lo que es: el
 * diagnóstico de reglas sin la redacción del LLM encima.
 */
const USAR_REPORTE_REAL = import.meta.env.VITE_REPORTE_REAL !== '0'

/**
 * VITE_ENVIO_REAL=0 -> el envío se resuelve local, sin /api/enviar.
 * Para demos sin backend (`vite dev` o evento sin internet): el flujo llega
 * hasta la confirmación con su ticket en vez de morir en un 404. Responde
 * guardado:false, que es el mismo modo demo que ya devuelve api/enviar.ts
 * cuando no hay Supabase configurado.
 */
const USAR_ENVIO_REAL = import.meta.env.VITE_ENVIO_REAL !== '0'

const MS_ESPERA_ENVIO_FALSO = 1200

const MS_ESPERA_FALSA = 3000

export class ErrorApi extends Error {
  estado: number
  constructor(mensaje: string, estado: number) {
    super(mensaje)
    this.name = 'ErrorApi'
    this.estado = estado
  }
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function postJson<T>(ruta: string, cuerpo: unknown, msTimeout = 45000): Promise<T> {
  const control = new AbortController()
  const t = setTimeout(() => control.abort(), msTimeout)
  try {
    const res = await fetch(ruta, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: control.signal,
    })
    if (!res.ok) {
      const texto = await res.text().catch(() => '')
      throw new ErrorApi(texto || `HTTP ${res.status}`, res.status)
    }
    return (await res.json()) as T
  } finally {
    clearTimeout(t)
  }
}

/** B es el dueño de /api/reporte. Con VITE_REPORTE_REAL=0 se usa el mock. */
export async function obtenerReporte(sesion: Sesion): Promise<Reporte> {
  if (!USAR_REPORTE_REAL) {
    await esperar(MS_ESPERA_FALSA)
    return diagnosticar(sesion)
  }
  return postJson<Reporte>('/api/reporte', { sesion })
}

/** Mismo formato y alfabeto que api/enviar.ts: WIN-YYMMDD-XXXX, sin I/O/0/1. */
function ticketLocal(): string {
  const d = new Date()
  const fecha = [
    String(d.getUTCFullYear()).slice(2),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    String(d.getUTCDate()).padStart(2, '0'),
  ].join('')
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let sufijo = ''
  for (let i = 0; i < 4; i++) {
    sufijo += alfabeto[Math.floor(Math.random() * alfabeto.length)]
  }
  return `WIN-${fecha}-${sufijo}`
}

/**
 * B, día 2. A diferencia del reporte, el chat no tiene un doble local con
 * sentido (no hay "plantilla" de chat): sin `vercel dev` corriendo, esto da
 * 404 y el componente de chat lo atrapa y muestra su propio mensaje, sin
 * tumbar el resto del reporte.
 */
export async function preguntarChat(sesion: Sesion, reporte: Reporte, pregunta: string): Promise<string> {
  const { respuesta } = await postJson<{ respuesta: string }>('/api/chat', { sesion, reporte, pregunta })
  return respuesta
}

/** Esto sí es de C y es real desde el día 1. */
export async function enviarReporte(
  sesion: Sesion,
  reporte: Reporte,
  contacto: Contacto,
): Promise<RespuestaEnvio> {
  if (!USAR_ENVIO_REAL) {
    await esperar(MS_ESPERA_ENVIO_FALSO)
    return { ok: true, ticket: ticketLocal(), guardado: false }
  }
  const cuerpo: SolicitudEnvio = { sesion, reporte, contacto }
  return postJson<RespuestaEnvio>('/api/enviar', cuerpo, 20000)
}
