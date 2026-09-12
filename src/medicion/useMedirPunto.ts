import { useCallback, useEffect, useRef, useState } from 'react'
import type { Punto } from '../contrato'
import {
  AHORRO,
  PUNTO_AHORRO_EFECTIVO,
  PUNTO_EFECTIVO,
  type Opciones,
  type Progreso,
  medirCuarto,
} from './medir'

/**
 * Tomar UN punto: medir, armar el Punto del contrato y llevar la cuenta de los
 * datos gastados.
 *
 * Sale de FlujoCaminata para que la caminata sobre plano mida exactamente igual
 * sin copiar la lógica. No sabe de pisos, cuartos ni pantallas: recibe la
 * etiqueta, devuelve qué pasó, y el flujo decide a qué paso ir.
 */

export type ResultadoToma =
  | { estado: 'ok'; punto: Punto; desdeCache: boolean }
  /** Lo canceló el usuario: quien llamó a cancelar() ya decidió a dónde volver. */
  | { estado: 'cancelado' }
  | { estado: 'error' }

/** La referencia usa el perfil completo; cada punto de la caminata, el liviano. */
function perfilDe(opciones: Opciones, esReferencia: boolean): Opciones {
  if (esReferencia) return opciones
  return opciones === AHORRO ? PUNTO_AHORRO_EFECTIVO : PUNTO_EFECTIVO
}

export function useMedirPunto(opciones: Opciones) {
  const [progreso, setProgreso] = useState<Progreso | null>(null)
  const [etiqueta, setEtiqueta] = useState('')
  const [avisoCache, setAvisoCache] = useState(false)
  const [bytes, setBytes] = useState(0)
  const control = useRef<AbortController | null>(null)

  useEffect(() => () => control.current?.abort(), [])

  const medir = useCallback(
    async (etiquetaPunto: string, esReferencia: boolean): Promise<ResultadoToma> => {
      const ctrl = new AbortController()
      control.current = ctrl
      setEtiqueta(etiquetaPunto)
      setProgreso(null)

      try {
        const { medicion, desdeCache } = await medirCuarto(
          etiquetaPunto,
          esReferencia,
          perfilDe(opciones, esReferencia),
          setProgreso,
          ctrl.signal,
        )
        if (ctrl.signal.aborted) return { estado: 'cancelado' }

        const punto: Punto = {
          timestamp: medicion.timestamp,
          descarga_mbps: medicion.descarga_mbps,
          latencia_ms: medicion.latencia_ms,
          jitter_ms: medicion.jitter_ms,
          perdida_pct: medicion.perdida_pct,
          bytes: medicion.bytes_descargados,
          ...(medicion.error === undefined ? {} : { error: medicion.error }),
        }

        setAvisoCache(desdeCache)
        // Los bytes se gastaron aunque después descarte el punto.
        setBytes((b) => b + (medicion.bytes_descargados ?? 0))
        return { estado: 'ok', punto, desdeCache }
      } catch {
        return ctrl.signal.aborted ? { estado: 'cancelado' } : { estado: 'error' }
      } finally {
        // Si ya arrancó otra medición, esta no le pisa el control ni el progreso.
        if (control.current === ctrl) {
          control.current = null
          setProgreso(null)
        }
      }
    },
    [opciones],
  )

  const cancelar = useCallback(() => {
    control.current?.abort()
    control.current = null
    setProgreso(null)
  }, [])

  return { progreso, etiqueta, avisoCache, bytes, medir, cancelar }
}
