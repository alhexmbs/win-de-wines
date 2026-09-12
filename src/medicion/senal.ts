/**
 * senal.ts — el índice de cobertura 0-100 y su semáforo.
 *
 * POR QUÉ NO HAY dBm AQUÍ: ningún navegador expone el RSSI del adaptador wifi.
 * No existe la API — ni en Chrome Android, ni en Safari iOS, ni detrás de un
 * permiso. `navigator.connection` da `downlink`/`rtt`, que son estimaciones
 * calculadas del tráfico HTTP reciente, no lecturas del radio. Inventar un
 * número en dBm a partir del rendimiento sería un dato fabricado, así que
 * medimos lo que sí se puede medir y lo llamamos por su nombre: índice de
 * cobertura, derivado de velocidad + latencia + estabilidad reales.
 *
 * La comparación es SIEMPRE contra la medición de referencia tomada junto al
 * router. Eso es lo que separa las dos respuestas posibles del reto:
 *   - referencia mala  → el internet llega mal desde la calle (problema de WIN)
 *   - referencia buena y cuarto malo → el wifi no alcanza ahí (cobertura)
 *
 * Y por eso el índice NO dice "qué tan cerca estás del router": una pared de
 * concreto, un espejo o el microondas del vecino tumban la señal de un cuarto
 * contiguo, y un cuarto lejano con línea de vista puede andar mejor.
 */

export type Nivel = 'fuerte' | 'media' | 'debil'

export const EMOJI_NIVEL: Record<Nivel, string> = {
  fuerte: '🟢',
  media: '🟡',
  debil: '🔴',
}

export const TEXTO_NIVEL: Record<Nivel, string> = {
  fuerte: 'Señal fuerte',
  media: 'Señal media',
  debil: 'Señal débil',
}

export const CLASE_TEXTO: Record<Nivel, string> = {
  fuerte: 'text-bueno',
  media: 'text-regular',
  debil: 'text-malo',
}

export const CLASE_FONDO: Record<Nivel, string> = {
  fuerte: 'bg-bueno',
  media: 'bg-regular',
  debil: 'bg-malo',
}

export const CLASE_FONDO_SUAVE: Record<Nivel, string> = {
  fuerte: 'bg-bueno-bg',
  media: 'bg-regular-bg',
  debil: 'bg-malo-bg',
}

export function nivelDeIndice(indice: number): Nivel {
  if (indice >= 70) return 'fuerte'
  if (indice >= 30) return 'media'
  return 'debil'
}

/** Lo mínimo que necesita el índice. Lo cumplen tanto Medicion como Punto. */
export interface DatosSenal {
  descarga_mbps: number
  latencia_ms: number
  jitter_ms: number
  perdida_pct?: number
  error?: string
}

const PESO_VELOCIDAD = 0.65
const PESO_LATENCIA = 0.25
const PESO_ESTABILIDAD = 0.1

/** Fracción de la referencia a partir de la cual la velocidad ya puntúa 100. */
const OBJETIVO_VS_REFERENCIA = 0.7
/** Sin referencia (no debería pasar): 50 Mbps = 100 puntos de velocidad. */
const VELOCIDAD_PLENA_ABS = 50
/** Latencia extra sobre la referencia que ya vale 0 puntos de latencia. */
const LATENCIA_EXTRA_MAXIMA = 150
const PERDIDA_MAXIMA = 20
const JITTER_MAXIMO = 120

function recortar(x: number, min = 0, max = 1): number {
  if (Number.isNaN(x)) return min
  return Math.min(max, Math.max(min, x))
}

function utilizable(d: DatosSenal | null | undefined): d is DatosSenal {
  return d !== null && d !== undefined && d.error === undefined
}

/**
 * 0-100. El cuarto sin señal es 0, no "sin dato": para el mapa es el peor caso
 * posible, y es exactamente lo que el cliente siente cuando no carga nada.
 */
export function indiceDeCobertura(m: DatosSenal, referencia?: DatosSenal | null): number {
  if (m.error !== undefined) return 0

  const base = utilizable(referencia) && referencia.descarga_mbps > 0 ? referencia : null

  const velocidad = recortar(
    base === null
      ? m.descarga_mbps / VELOCIDAD_PLENA_ABS
      : m.descarga_mbps / (base.descarga_mbps * OBJETIVO_VS_REFERENCIA),
  )

  const extra = Math.max(0, m.latencia_ms - (base?.latencia_ms ?? 0))
  const latencia = recortar(1 - extra / LATENCIA_EXTRA_MAXIMA)

  const estabilidad =
    recortar(1 - (m.perdida_pct ?? 0) / PERDIDA_MAXIMA) * recortar(1 - m.jitter_ms / JITTER_MAXIMO)

  return Math.round(
    100 * (PESO_VELOCIDAD * velocidad + PESO_LATENCIA * latencia + PESO_ESTABILIDAD * estabilidad),
  )
}

/** % de la velocidad de la referencia que llega a este punto. null sin referencia. */
export function porcentajeVsReferencia(
  m: DatosSenal,
  referencia?: DatosSenal | null,
): number | null {
  if (!utilizable(referencia) || referencia.descarga_mbps <= 0) return null
  if (m.error !== undefined) return 0
  return Math.round((m.descarga_mbps / referencia.descarga_mbps) * 100)
}

/* ─────────────── semáforo en vivo mientras camina ─────────────── */

/** Sin referencia de latencia, este ida y vuelta al CDN ya se considera bueno. */
const LATENCIA_BUENA_ABS = 60
const LATENCIA_MALA_ABS = 400

/**
 * El semáforo de la caminata sale SOLO de pings: entre punto y punto no se
 * gasta ancho de banda. Es más burdo que el índice de un punto medido —por eso
 * la UI lo muestra como "en vivo" y el número firme aparece al tomar el punto—
 * pero un ping que se va a 400 ms o que no vuelve es justo lo que pasa cuando
 * el wifi se está cayendo.
 */
export function indiceEnVivo(
  ultimas: (number | null)[],
  latenciaReferencia: number | null,
): number | null {
  if (ultimas.length === 0) return null

  const vivos = ultimas.filter((x): x is number => x !== null)
  const respondieron = vivos.length / ultimas.length
  if (vivos.length === 0) return 0

  const media = vivos.reduce((a, b) => a + b, 0) / vivos.length

  let latencia: number
  if (latenciaReferencia !== null && latenciaReferencia > 0) {
    latencia = recortar(1 - Math.max(0, media - latenciaReferencia) / LATENCIA_EXTRA_MAXIMA)
  } else {
    latencia = recortar(
      (LATENCIA_MALA_ABS - media) / (LATENCIA_MALA_ABS - LATENCIA_BUENA_ABS),
    )
  }

  return Math.round(100 * (0.75 * latencia + 0.25 * respondieron))
}
