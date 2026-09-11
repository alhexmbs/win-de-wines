import type { Reporte, RespuestaEnvio, Sesion, SolicitudEnvio, Contacto } from './contrato'
import { reporteMockPara } from './mocks'

/**
 * DOBLE #1 — Integración 1: poner esto en true (o VITE_REPORTE_REAL=1) y
 * obtenerReporte() pasa a llamar al endpoint de B. Nada más cambia.
 */
const USAR_REPORTE_REAL = import.meta.env.VITE_REPORTE_REAL === '1'

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

/** B es el dueño de /api/reporte. Mientras no exista, devolvemos un mock. */
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
