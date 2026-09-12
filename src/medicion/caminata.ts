/**
 * caminata.ts — funciones puras del modo caminata: agrupar los puntos por
 * (piso, cuarto) y consolidarlos en las Mediciones del contrato.
 *
 * Decisión clave: B sigue recibiendo UNA Medicion por habitación, igual que el
 * día 1. Los puntos sueltos viajan dentro de `Medicion.puntos`, así que
 * reglas.ts no cambia ni una línea y el reporte no lista "Cocina" cuatro veces.
 *
 * Sin React ni DOM: se prueba desde Node.
 */
import type { Medicion, Punto } from '../contrato.ts'
import { SUFIJO_REFERENCIA } from './cuartos.ts'
import { indiceDeCobertura } from './senal.ts'

export interface Parada {
  piso: number
  cuarto: string
  es_referencia: boolean
  puntos: Punto[]
}

/**
 * Los pisos que se ofrecen al empezar. NO es un límite: el selector tiene un
 * botón para agregar el siguiente, porque el onboarding permite decir «4+» y
 * antes la caminata solo llegaba a 3 — quien viviera en un edificio de cinco
 * no tenía dónde marcar los de arriba.
 */
export const PISOS_INICIALES = [1, 2, 3]

/** Tope de cordura. Nadie mide el wifi de una torre entera cuarto por cuarto. */
export const PISO_MAXIMO = 20

export function clave(piso: number, cuarto: string): string {
  return `${piso}|${cuarto.trim().toLowerCase()}`
}

/**
 * El contrato identifica el cuarto por su nombre, así que dos "Dormitorio" en
 * pisos distintos chocarían. El piso entra en la etiqueta solo cuando hace
 * falta; `piso` viaja aparte para que el mapa pueda agrupar sin parsear texto.
 */
export function etiquetaDeCuarto(piso: number, cuarto: string, esReferencia = false): string {
  const base = piso <= 1 ? cuarto : `${cuarto} (piso ${piso})`
  return esReferencia ? `${base}${SUFIJO_REFERENCIA}` : base
}

export function mediana(xs: number[]): number {
  if (xs.length === 0) return 0
  const orden = [...xs].sort((a, b) => a - b)
  const medio = Math.floor(orden.length / 2)
  return orden.length % 2 === 0 ? (orden[medio - 1] + orden[medio]) / 2 : orden[medio]
}

function redondear(x: number, decimales: number): number {
  const f = 10 ** decimales
  return Math.round(x * f) / f
}

/**
 * Mediana, no promedio: si uno de los cuatro puntos de la sala salió en 2 Mbps
 * porque justo pasó el microondas, el promedio se hunde y la mediana aguanta.
 */
function consolidarPuntos(puntos: Punto[]): Omit<Punto, 'timestamp'> & { timestamp: string } {
  const buenos = puntos.filter((p) => p.error === undefined)

  // Todos los puntos fallaron: el cuarto no tiene señal, y eso es un dato.
  if (buenos.length === 0) {
    return {
      timestamp: puntos[0]?.timestamp ?? new Date().toISOString(),
      descarga_mbps: 0,
      latencia_ms: 0,
      jitter_ms: 0,
      perdida_pct: 100,
      error: puntos[0]?.error,
    }
  }

  return {
    timestamp: buenos[0].timestamp,
    descarga_mbps: redondear(mediana(buenos.map((p) => p.descarga_mbps)), 1),
    latencia_ms: Math.round(mediana(buenos.map((p) => p.latencia_ms))),
    jitter_ms: Math.round(mediana(buenos.map((p) => p.jitter_ms))),
    perdida_pct: redondear(mediana(buenos.map((p) => p.perdida_pct ?? 0)), 1),
  }
}

/** La referencia manda: es la línea base contra la que se calcula todo índice. */
export function referenciaDe(paradas: Parada[]): Parada | null {
  return paradas.find((p) => p.es_referencia) ?? paradas[0] ?? null
}

export function consolidar(paradas: Parada[]): Medicion[] {
  const conPuntos = paradas.filter((p) => p.puntos.length > 0)
  const refParada = referenciaDe(conPuntos)
  const refDatos = refParada === null ? null : consolidarPuntos(refParada.puntos)

  // La referencia primero: el reporte y el mapa la leen como cabecera de la casa.
  const orden = [...conPuntos].sort(
    (a, b) => Number(b.es_referencia) - Number(a.es_referencia) || a.piso - b.piso,
  )

  return orden.map((parada) => {
    const datos = consolidarPuntos(parada.puntos)
    const puntos = parada.puntos.map((p) => ({
      ...p,
      indice: indiceDeCobertura(p, refDatos),
    }))

    const medicion: Medicion = {
      cuarto: etiquetaDeCuarto(parada.piso, parada.cuarto, parada.es_referencia),
      es_referencia: parada.es_referencia,
      timestamp: datos.timestamp,
      descarga_mbps: datos.descarga_mbps,
      latencia_ms: datos.latencia_ms,
      jitter_ms: datos.jitter_ms,
      perdida_pct: datos.perdida_pct,
      muestras: parada.puntos.length,
      piso: parada.piso,
      puntos,
      indice: indiceDeCobertura(datos, refDatos),
    }

    if (datos.error !== undefined) medicion.error = datos.error

    const bytes = parada.puntos.reduce((a, p) => a + (p.bytes ?? 0), 0)
    if (bytes > 0) medicion.bytes_descargados = bytes

    return medicion
  })
}

/** Para el contador de datos de la UI. */
export function megasGastadas(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1)
}
