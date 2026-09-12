/**
 * sonda.ts — el ping continuo de la caminata.
 *
 * Un archivo de 3 bytes cada 2 s: ~0.5 KB por minuto, nada frente a los 3 MB
 * de un punto medido. Es lo que mantiene vivo el semáforo mientras el usuario
 * camina, sin gastarle los datos del celular.
 *
 * Se pausa mientras corre una medición de punto: si no, los pings compiten con
 * la descarga y ensucian las dos cosas.
 */
import { SONDA, pingUnico } from './medir'

export interface Sonda {
  detener: () => void
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function iniciarSonda(cadaMs: number, alMedir: (ms: number | null) => void): Sonda {
  const control = new AbortController()
  let vivo = true

  async function bucle() {
    while (vivo) {
      const ms = await pingUnico(SONDA, control.signal)
      if (!vivo) return
      alMedir(ms)
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
