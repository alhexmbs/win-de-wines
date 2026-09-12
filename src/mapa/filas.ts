/**
 * Adaptador: de las Mediciones del contrato a las filas que dibuja el árbol.
 *
 * Vive fuera de MapaCalor.tsx porque también lo usa el mapa en vivo de la
 * caminata, y un archivo que exporta componentes y funciones a la vez rompe el
 * fast refresh de Vite.
 */
import type { Medicion } from '../contrato.ts'
import { indiceDeCobertura, pctMostrable, porcentajeVsReferencia } from '../medicion/senal.ts'
import type { FilaMapa } from './ArbolCobertura'

function detalleDe(m: Medicion, referencia: Medicion | null): string {
  if (m.error !== undefined) return 'El dispositivo no logró conectarse en este punto'
  const pct = pctMostrable(porcentajeVsReferencia(m, referencia))
  const partes = [`${m.descarga_mbps.toFixed(1)} Mbps`, `${m.latencia_ms} ms`]
  if (pct !== null && !m.es_referencia) partes.push(`${pct}% de lo que da el router`)
  return partes.join(' · ')
}

/** Usado por el mapa del reporte y por el mapa en vivo de la caminata. */
export function filasDeMediciones(mediciones: Medicion[]): FilaMapa[] {
  const referencia = mediciones.find((m) => m.es_referencia) ?? mediciones[0] ?? null

  return mediciones.map((m) => ({
    piso: m.piso ?? 1,
    cuarto: m.cuarto,
    indice: m.indice ?? indiceDeCobertura(m, referencia),
    // `muestras` del día 1 son pings, no puntos: solo cuenta si hay puntos reales.
    puntos: m.puntos?.length ?? 1,
    es_referencia: m.es_referencia,
    detalle: detalleDe(m, referencia),
  }))
}
