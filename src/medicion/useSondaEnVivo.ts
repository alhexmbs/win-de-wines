import { useEffect, useMemo, useRef, useState } from 'react'
import type { MuestraRecorrido } from '../contrato'
import { mediana } from './caminata'
import { type DatosSenal, indiceDeCobertura, indiceEnVivo } from './senal'
import { iniciarSonda } from './sonda'

const MS_ENTRE_PINGS = 2000
/** Cuántos pings recientes pesan en el semáforo. 6 ≈ los últimos 12 segundos. */
const VENTANA_VIVO = 6
const MAX_RECORRIDO = 600

/**
 * El semáforo en vivo de la caminata y los pings del recorrido.
 *
 * Sale de FlujoCaminata para que la caminata sobre plano lo comparta sin
 * copiarlo. La sonda solo corre con `activa`: durante la medición de un punto
 * competiría con la descarga y ensuciaría las dos cosas.
 */
export function useSondaEnVivo({
  activa,
  piso,
  cuarto,
  latenciaReferencia,
  referencia,
}: {
  activa: boolean
  /** Dónde está el usuario AHORA: con esto se etiqueta cada ping del recorrido. */
  piso: number
  cuarto: string
  /** Latencia promedio de los puntos de la referencia, para el modo solo-pings. */
  latenciaReferencia: number | null
  /** La referencia consolidada, para el modo con descarga (VITE_SONDA_KB). */
  referencia: DatosSenal | null
}) {
  const [recorrido, setRecorrido] = useState<MuestraRecorrido[]>([])
  const [ultimas, setUltimas] = useState<(number | null)[]>([])
  /** Mbps de la sonda. Vacío si VITE_SONDA_KB está apagado. */
  const [ultimasMbps, setUltimasMbps] = useState<(number | null)[]>([])

  // La ubicación actual vive en un ref para que la sonda, que corre en su propio
  // bucle, etiquete cada ping con el cuarto donde el usuario está AHORA sin
  // tener que reiniciarse en cada cambio de cuarto.
  const ubicacion = useRef({ piso, cuarto })
  useEffect(() => {
    ubicacion.current = { piso, cuarto }
  }, [piso, cuarto])

  /*
   * El semáforo, con dos modos según lo que la sonda pueda medir.
   *
   * Con VITE_SONDA_KB encendido la sonda baja datos, así que se usa la MISMA
   * fórmula que un punto medido (indiceDeCobertura) sobre la mediana de las
   * últimas muestras: el semáforo y el número firme hablan el mismo idioma.
   *
   * Apagado, se cae a indiceEnVivo, que sale solo de la latencia. Es lo que
   * había y sirve cruzando internet, donde la latencia sí se dispara cuando el
   * wifi se cae. Contra un servidor de la misma red se queda en verde siempre.
   */
  const indice = useMemo(() => {
    const mbps = ultimasMbps.slice(-VENTANA_VIVO).filter((x): x is number => x !== null)
    if (mbps.length === 0) return indiceEnVivo(ultimas.slice(-VENTANA_VIVO), latenciaReferencia)

    const lat = ultimas.slice(-VENTANA_VIVO).filter((x): x is number => x !== null)
    const perdidos = ultimasMbps.slice(-VENTANA_VIVO).filter((x) => x === null).length
    return indiceDeCobertura(
      {
        descarga_mbps: mediana(mbps),
        latencia_ms: lat.length > 0 ? mediana(lat) : 0,
        jitter_ms: 0,
        perdida_pct: (perdidos / ultimasMbps.slice(-VENTANA_VIVO).length) * 100,
      },
      referencia,
    )
  }, [ultimas, ultimasMbps, latenciaReferencia, referencia])

  useEffect(() => {
    if (!activa) return
    const sonda = iniciarSonda(MS_ENTRE_PINGS, ({ latencia_ms: ms, mbps }) => {
      setUltimas((prev) => [...prev, ms].slice(-24))
      setUltimasMbps((prev) => [...prev, mbps].slice(-24))
      setRecorrido((prev) =>
        [
          ...prev,
          {
            t: new Date().toISOString(),
            cuarto: ubicacion.current.cuarto,
            piso: ubicacion.current.piso,
            latencia_ms: ms,
          },
        ].slice(-MAX_RECORRIDO),
      )
    })
    return () => sonda.detener()
  }, [activa])

  return { indice, ultimas, recorrido }
}
