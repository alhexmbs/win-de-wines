/**
 * sonda.ts — el muestreo continuo de la caminata.
 *
 * Cada vuelta manda un ping de 3 bytes (~0.5 KB por minuto, nada) y, si
 * KB_SONDA está encendido, baja además unos KB para poder seguir la velocidad
 * y no solo la latencia. Ver el comentario de KB_SONDA en medir.ts: contra un
 * servidor de la misma red la latencia casi no se mueve aunque el wifi se
 * caiga, así que sin esa descarga el semáforo se queda en verde siempre.
 *
 * Se pausa mientras corre una medición de punto: si no, compite con la
 * descarga y ensucia las dos cosas.
 */
import { KB_SONDA, SONDA, pingUnico, sondearDescarga } from './medir'

export interface Sonda {
  detener: () => void
}

/** Lo que entrega cada vuelta. `mbps` es null si la sonda no baja datos. */
export interface MuestraSonda {
  latencia_ms: number | null
  mbps: number | null
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function iniciarSonda(cadaMs: number, alMedir: (m: MuestraSonda) => void): Sonda {
  const control = new AbortController()
  let vivo = true

  async function bucle() {
    while (vivo) {
      const latencia_ms = await pingUnico(SONDA, control.signal)
      if (!vivo) return

      // Si el ping no volvió, no se gastan datos: ya sabemos que no hay señal.
      const mbps =
        KB_SONDA > 0 && latencia_ms !== null
          ? await sondearDescarga(KB_SONDA, control.signal)
          : null
      if (!vivo) return

      alMedir({ latencia_ms, mbps })
      await esperar(cadaMs)
    }
  }

  void bucle()

  return {
    detener() {
      vivo = false
      control.abort()
    },
  }
}
