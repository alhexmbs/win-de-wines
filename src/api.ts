import type { Reporte, RespuestaEnvio, Sesion, SolicitudEnvio, Contacto } from './contrato'
import { reporteMockPara } from './mocks'

/**
 * INTEGRACIÓN 1 hecha: obtenerReporte() llama al endpoint real de B.
 * Para volver al doble (demo sin API, o `vite dev` sin `vercel dev`):
 * VITE_REPORTE_REAL=0 en .env.local o en Vercel. Es variable de build:
 * al cambiarla hay que volver a desplegar.
 */
const USAR_REPORTE_REAL = import.meta.env.VITE_REPORTE_REAL !== '0'

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
    return reporteMockPara(sesion)
  }
  return postJson<Reporte>('/api/reporte', { sesion })
}

/** Esto sí es de C y es real desde el día 1. */
export async function enviarReporte(
  sesion: Sesion,
  reporte: Reporte,
  contacto: Contacto,
): Promise<RespuestaEnvio> {
  const cuerpo: SolicitudEnvio = { sesion, reporte, contacto }
  return postJson<RespuestaEnvio>('/api/enviar', cuerpo, 20000)
}
