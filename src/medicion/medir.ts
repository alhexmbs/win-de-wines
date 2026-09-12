import type { Medicion } from '../contrato'

/**
 * Núcleo de medición. Sin React, sin DOM: se puede probar desde la consola.
 *
 * Qué SÍ mide: cuánto se degrada la conexión del celular al alejarse del router,
 * comparando cada cuarto contra la medición de referencia tomada a su lado.
 *
 * Qué NO mide, y hay que saber responderlo:
 *  - Señal en dBm/RSSI: ningún navegador la expone. No existe API.
 *  - Latencia al router: fetch a http://192.168.x.x lo bloquea el mixed-content
 *    desde https. Lo que medimos es ida y vuelta al CDN.
 *  - Pérdida de paquetes real: no hay ICMP en el navegador. `perdida_pct` es el
 *    % de pings que no respondieron dentro del timeout, que es un proxy honesto.
 */

const ORIGEN = typeof location === 'undefined' ? 'http://localhost' : location.href
const URL_DESCARGA = new URL('/medicion/prueba-4mb.bin', ORIGEN).href
const URL_PING = new URL('/medicion/ping.txt', ORIGEN).href

/** Códigos de error. Son códigos, no prosa: B los mapea a lenguaje de cliente. */
export const SIN_SENAL = 'sin_señal'
export const CANCELADO = 'cancelado'

export interface Opciones {
  /** Presupuesto duro de datos por cuarto. Corta la descarga aunque sobre tiempo. */
  topeBytes: number
  msDescarga: number
  /** Tramo inicial que se descarta: TCP arranca lento y ensucia el promedio. */
  msCalentamiento: number
  /** Conexiones en paralelo. Con una sola no se satura un plan rápido. */
  flujos: number
  pings: number
  msTimeoutPing: number
}

export const NORMAL: Opciones = {
  topeBytes: 20 * 1024 * 1024,
  msDescarga: 4000,
  msCalentamiento: 700,
  flujos: 3,
  pings: 8,
  msTimeoutPing: 3000,
}

/** Para datos móviles o conexión sin confirmar: ~5 MB por cuarto en vez de 20. */
export const AHORRO: Opciones = {
  ...NORMAL,
  topeBytes: 5 * 1024 * 1024,
  msDescarga: 2500,
  flujos: 2,
  pings: 6,
}

/**
 * Un punto suelto dentro de un cuarto. Como se toman varios por habitación,
 * cada uno tiene que costar poco: ~3 MB en vez de 20. La referencia junto al
 * router sí usa NORMAL, porque de ella cuelga la comparación de toda la casa.
 */
export const PUNTO: Opciones = {
  ...NORMAL,
  topeBytes: 3 * 1024 * 1024,
  msDescarga: 2200,
  flujos: 2,
  pings: 5,
}

export const PUNTO_AHORRO: Opciones = {
  ...AHORRO,
  topeBytes: 1536 * 1024,
  msDescarga: 1800,
  flujos: 2,
  pings: 4,
}

/** Ping de la sonda continua: 3 bytes, timeout corto, sin gastar datos. */
export const SONDA: Opciones = { ...NORMAL, pings: 1, msTimeoutPing: 2500 }

export type Fase = 'latencia' | 'descarga'

export interface Progreso {
  fase: Fase
  /** 0..1 sobre el total del cuarto, no sobre la fase. */
  pct: number
  mbps: number
  latencia_ms: number | null
}

/* ─────────────────────────── utilidades ─────────────────────────── */

const PESO_LATENCIA = 0.3

/** Máximo del presupuesto de datos que se puede gastar calentando la conexión. */
const FRACCION_CALENTAMIENTO = 0.25

function esperar(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function redondear(x: number, decimales: number): number {
  const f = 10 ** decimales
  return Math.round(x * f) / f
}

function promedio(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function desviacion(xs: number[]): number {
  if (xs.length < 2) return 0
  const m = promedio(xs)
  return Math.sqrt(promedio(xs.map((x) => (x - m) ** 2)))
}

/** Cada request lleva su propio cache-buster: sin esto el 2do cuarto lee del disco. */
function sinCache(url: string, etiqueta: string): string {
  return `${url}?cb=${etiqueta}`
}

/** Combina un AbortSignal externo con un timeout propio, sin AbortSignal.any. */
function conTimeout(senal: AbortSignal | undefined, ms: number) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  const propagar = () => ctrl.abort()
  senal?.addEventListener('abort', propagar)
  return {
    signal: ctrl.signal,
    limpiar() {
      clearTimeout(t)
      senal?.removeEventListener('abort', propagar)
    },
  }
}

/**
 * Si todo lo que bajamos vino del caché del navegador, el número es basura.
 *
 * Ojo con el falso positivo: hay navegadores (Safari viejo) que no reportan
 * tamaños y devuelven 0 en todo. Por eso no basta con `transferSize === 0`:
 * exigimos que el navegador SÍ esté reportando el tamaño del cuerpo. Si no
 * reporta nada, no podemos saberlo y no avisamos, que es mejor que acusar a
 * una medición buena de venir del caché.
 */
function todoDesdeCache(urls: string[]): boolean {
  if (typeof performance.getEntriesByName !== 'function') return false

  let cuerpo = 0
  let transferido = 0
  for (const u of urls) {
    for (const e of performance.getEntriesByName(u, 'resource')) {
      const r = e as PerformanceResourceTiming
      cuerpo += r.encodedBodySize ?? 0
      transferido += r.transferSize ?? 0
    }
  }
  return cuerpo > 0 && transferido === 0
}

/* ─────────────────────────── latencia ─────────────────────────── */

export interface ResultadoLatencia {
  latencia_ms: number
  jitter_ms: number
  perdida_pct: number
  muestras: number
  respuestas: number
}

export async function pingUnico(op: Opciones, senal?: AbortSignal): Promise<number | null> {
  const { signal, limpiar } = conTimeout(senal, op.msTimeoutPing)
  const inicio = performance.now()
  try {
    const res = await fetch(sinCache(URL_PING, `${Date.now()}-${Math.random()}`), {
      cache: 'no-store',
      signal,
    })
    await res.arrayBuffer()
    return res.ok ? performance.now() - inicio : null
  } catch {
    return null
  } finally {
    limpiar()
  }
}

export async function medirLatencia(
  op: Opciones,
  alProgreso: (p: Progreso) => void,
  senal?: AbortSignal,
): Promise<ResultadoLatencia> {
  const tiempos: number[] = []
  let fallidos = 0

  // El primer ping abre la conexión TLS y sale carísimo: se descarta.
  await pingUnico(op, senal)

  for (let i = 0; i < op.pings; i++) {
    if (senal?.aborted === true) throw new DOMException('cancelado', 'AbortError')
    const ms = await pingUnico(op, senal)
    if (ms === null) fallidos++
    else tiempos.push(ms)

    alProgreso({
      fase: 'latencia',
      pct: ((i + 1) / op.pings) * PESO_LATENCIA,
      mbps: 0,
      latencia_ms: tiempos.length > 0 ? promedio(tiempos) : null,
    })
  }

  return {
    latencia_ms: tiempos.length > 0 ? promedio(tiempos) : 0,
    jitter_ms: desviacion(tiempos),
    perdida_pct: (fallidos / op.pings) * 100,
    muestras: op.pings,
    respuestas: tiempos.length,
  }
}

/* ─────────────────────────── descarga ─────────────────────────── */

export interface ResultadoDescarga {
  mbps: number
  bytes: number
  ms: number
  desdeCache: boolean
}

export async function medirDescarga(
  op: Opciones,
  alProgreso: (p: Progreso) => void,
  latenciaPrevia: number | null,
  senal?: AbortSignal,
): Promise<ResultadoDescarga> {
  if (typeof performance.clearResourceTimings === 'function') performance.clearResourceTimings()

  const ctrl = new AbortController()
  const propagar = () => ctrl.abort()
  senal?.addEventListener('abort', propagar)
  const corte = setTimeout(() => ctrl.abort(), op.msDescarga)

  const t0 = performance.now()
  const urls: string[] = []
  let total = 0
  let fallosSeguidos = 0
  let ultimoAviso = 0

  // Marca donde termina el calentamiento: solo lo de después cuenta.
  let baseBytes: number | null = null
  let baseT = t0

  function mbpsEn(ahora: number): number {
    const bytes = baseBytes === null ? total : total - baseBytes
    const ms = baseBytes === null ? ahora - t0 : ahora - baseT
    return ms > 0 ? (bytes * 8) / (ms / 1000) / 1e6 : 0
  }

  function contar(n: number) {
    total += n
    const ahora = performance.now()

    // El calentamiento termina por tiempo O por bytes, lo que llegue primero.
    // Sin la segunda condición, en un plan rápido el tope de datos se agota
    // antes de los 700 ms y nos quedaríamos midiendo solo el arranque de TCP.
    if (
      baseBytes === null &&
      (ahora - t0 >= op.msCalentamiento || total >= op.topeBytes * FRACCION_CALENTAMIENTO)
    ) {
      baseBytes = total
      baseT = ahora
    }
    if (total >= op.topeBytes) ctrl.abort()

    if (ahora - ultimoAviso >= 100) {
      ultimoAviso = ahora
      alProgreso({
        fase: 'descarga',
        pct: Math.min(
          1,
          PESO_LATENCIA +
            (1 - PESO_LATENCIA) *
              Math.max((ahora - t0) / op.msDescarga, total / op.topeBytes),
        ),
        mbps: mbpsEn(ahora),
        latencia_ms: latenciaPrevia,
      })
    }
  }

  async function unaDescarga(etiqueta: string): Promise<void> {
    const url = sinCache(URL_DESCARGA, etiqueta)
    urls.push(url)
    const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const lector = res.body?.getReader()
    if (lector === undefined) {
      contar((await res.arrayBuffer()).byteLength)
      return
    }
    for (;;) {
      const { done, value } = await lector.read()
      if (done) break
      if (value !== undefined) contar(value.byteLength)
    }
  }

  async function flujo(i: number): Promise<void> {
    let n = 0
    while (!ctrl.signal.aborted) {
      try {
        await unaDescarga(`${Math.round(t0)}-${i}-${n++}`)
        fallosSeguidos = 0
      } catch {
        if (ctrl.signal.aborted) return
        fallosSeguidos++
        // Si nadie responde, no tiene sentido seguir insistiendo: no hay señal.
        if (fallosSeguidos >= 6) {
          ctrl.abort()
          return
        }
        await esperar(150)
      }
    }
  }

  try {
    await Promise.all(Array.from({ length: op.flujos }, (_, i) => flujo(i)))
  } finally {
    clearTimeout(corte)
    senal?.removeEventListener('abort', propagar)
  }

  const tFin = performance.now()
  return {
    mbps: mbpsEn(tFin),
    bytes: total,
    ms: Math.round(baseBytes === null ? tFin - t0 : tFin - baseT),
    desdeCache: total > 0 && todoDesdeCache(urls),
  }
}

/* ─────────────────────────── un cuarto ─────────────────────────── */

export interface ResultadoCuarto {
  medicion: Medicion
  /** Solo para /lab y depuración. No viaja en el contrato. */
  desdeCache: boolean
}

export async function medirCuarto(
  cuarto: string,
  esReferencia: boolean,
  op: Opciones,
  alProgreso: (p: Progreso) => void,
  senal?: AbortSignal,
): Promise<ResultadoCuarto> {
  const timestamp = new Date().toISOString()
  const lat = await medirLatencia(op, alProgreso, senal)

  // Ningún ping volvió: no hay por qué gastar datos intentando bajar 20 MB.
  if (lat.respuestas === 0) {
    return {
      desdeCache: false,
      medicion: {
        cuarto,
        es_referencia: esReferencia,
        timestamp,
        descarga_mbps: 0,
        latencia_ms: 0,
        jitter_ms: 0,
        perdida_pct: 100,
        muestras: lat.muestras,
        error: SIN_SENAL,
      },
    }
  }

  const des = await medirDescarga(op, alProgreso, lat.latencia_ms, senal)
  // El aviso de progreso va throttleado a 100 ms, así que el último tramo se
  // pierde: cerramos la barra a mano para que no quede a medias en pantalla.
  alProgreso({ fase: 'descarga', pct: 1, mbps: des.mbps, latencia_ms: lat.latencia_ms })

  return {
    desdeCache: des.desdeCache,
    medicion: {
      cuarto,
      es_referencia: esReferencia,
      timestamp,
      descarga_mbps: redondear(des.mbps, 1),
      latencia_ms: Math.round(lat.latencia_ms),
      jitter_ms: Math.round(lat.jitter_ms),
      perdida_pct: redondear(lat.perdida_pct, 1),
      muestras: lat.muestras,
      bytes_descargados: des.bytes,
      duracion_ms: des.ms,
    },
  }
}
