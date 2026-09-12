import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispositivo, MuestraRecorrido, Punto, ResultadoMedicion } from '../contrato'
import { filasDeMediciones } from '../mapa/filas'
import { ArbolCobertura } from '../mapa/ArbolCobertura'
import { Boton } from '../ui/Boton'
import { Pantalla } from '../ui/Pantalla'
import {
  type Parada,
  clave,
  consolidar,
  etiquetaDeCuarto,
  mediana,
  megasGastadas,
} from './caminata'
import { limpiar } from './cuartos'
import { detectarDispositivo, sabeDistinguirConexion } from './dispositivo'
import {
  AHORRO,
  NORMAL,
  PUNTO_AHORRO_EFECTIVO,
  PUNTO_EFECTIVO,
  type Opciones,
  type Progreso,
  medirCuarto,
} from './medir'
import { IndicadorSenal } from './partes/IndicadorSenal'
import { PuntosTomados } from './partes/PuntosTomados'
import { ResultadoPunto } from './partes/ResultadoPunto'
import { Medidor } from './partes/Medidor'
import { PasoConexion } from './partes/PasoConexion'
import { SelectorUbicacion } from './partes/SelectorUbicacion'
import { indiceDeCobertura, indiceEnVivo } from './senal'
import { iniciarSonda } from './sonda'
import { useWakeLock } from './useWakeLock'

type Paso = 'conexion' | 'referencia' | 'caminata' | 'midiendo' | 'resultado'

/** Referencia + al menos otra habitación: con una sola no hay nada que comparar. */
const MINIMO_HABITACIONES = 2
const MS_ENTRE_PINGS = 2000
/** Cuántos pings recientes pesan en el semáforo. 6 ≈ los últimos 12 segundos. */
const VENTANA_VIVO = 6
const MAX_RECORRIDO = 600

/**
 * Modo caminata: el usuario recorre su casa, el semáforo se mueve en vivo con
 * pings de 3 bytes, y en cada sitio pulsa «Tomar punto aquí» para fijar un
 * número medido de verdad. Varios puntos por habitación = resultado más fiable.
 *
 * Frontera igual que el día 1: no recibe el contexto del onboarding ni ve el
 * reporte. Entrega dispositivo + mediciones (+ recorrido) y C arma la Sesion.
 */
export function FlujoCaminata({
  onTerminar,
}: {
  onTerminar: (resultado: ResultadoMedicion) => void
}) {
  const [paso, setPaso] = useState<Paso>('conexion')
  const [dispositivo, setDispositivo] = useState<Dispositivo>(detectarDispositivo)
  const [opciones, setOpciones] = useState<Opciones>(NORMAL)
  const [piso, setPiso] = useState(1)
  const [cuarto, setCuarto] = useState('Sala')
  const [paradas, setParadas] = useState<Parada[]>([])
  const [recorrido, setRecorrido] = useState<MuestraRecorrido[]>([])
  const [ultimas, setUltimas] = useState<(number | null)[]>([])
  /** Mbps de la sonda. Vacío si VITE_SONDA_KB está apagado. */
  const [ultimasMbps, setUltimasMbps] = useState<(number | null)[]>([])
  const [progreso, setProgreso] = useState<Progreso | null>(null)
  const [midiendoEtiqueta, setMidiendoEtiqueta] = useState('')
  const [avisoCache, setAvisoCache] = useState(false)
  const [bytes, setBytes] = useState(0)
  /*
   * El punto recién medido, todavía sin guardar. Lleva consigo el piso y el
   * cuarto con los que se midió: si el usuario cambia el selector mientras mira
   * el resultado, el punto igual se archiva donde correspondía.
   */
  const [pendiente, setPendiente] = useState<{
    punto: Punto
    piso: number
    cuarto: string
    esReferencia: boolean
  } | null>(null)

  const cancelar = useRef<AbortController | null>(null)
  const wakeLock = useWakeLock(paso === 'caminata' || paso === 'midiendo')

  // La ubicación actual vive en un ref para que la sonda, que corre en su propio
  // bucle, etiquete cada ping con el cuarto donde el usuario está AHORA sin
  // tener que reiniciarse en cada cambio de cuarto.
  const ubicacion = useRef({ piso, cuarto })
  useEffect(() => {
    ubicacion.current = { piso, cuarto }
  }, [piso, cuarto])

  const referencia = paradas.find((p) => p.es_referencia) ?? null
  const latenciaReferencia = useMemo(() => {
    const puntos = referencia?.puntos.filter((p) => p.error === undefined) ?? []
    if (puntos.length === 0) return null
    return puntos.reduce((a, p) => a + p.latencia_ms, 0) / puntos.length
  }, [referencia])

  const mediciones = useMemo(() => consolidar(paradas), [paradas])
  /** La referencia ya consolidada: contra ella se calcula el % de cada punto. */
  const datosReferencia = useMemo(
    () => mediciones.find((m) => m.es_referencia) ?? mediciones[0] ?? null,
    [mediciones],
  )
  const filas = useMemo(() => filasDeMediciones(mediciones), [mediciones])

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
  const indiceVivo = useMemo(() => {
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
      datosReferencia,
    )
  }, [ultimas, ultimasMbps, latenciaReferencia, datosReferencia])


  /* La sonda solo corre mientras se camina: durante una medición competiría con
     la descarga y ensuciaría las dos cosas. */
  useEffect(() => {
    if (paso !== 'caminata') return
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
  }, [paso])

  useEffect(() => () => cancelar.current?.abort(), [])

  const tomarPunto = useCallback(
    async (esReferencia: boolean) => {
      const nombre = limpiar(cuarto)
      if (nombre.length < 2) return

      const etiqueta = etiquetaDeCuarto(piso, nombre, esReferencia)
      const ctrl = new AbortController()
      cancelar.current = ctrl

      setMidiendoEtiqueta(etiqueta)
      setProgreso(null)
      setPaso('midiendo')

      const opcionesPunto = esReferencia
        ? opciones
        : opciones === AHORRO
          ? PUNTO_AHORRO_EFECTIVO
          : PUNTO_EFECTIVO

      try {
        const { medicion, desdeCache } = await medirCuarto(
          etiqueta,
          esReferencia,
          opcionesPunto,
          setProgreso,
          ctrl.signal,
        )
        if (ctrl.signal.aborted) return

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
        setDispositivo((d) => ({ ...d, ...datosDeRedFrescos() }))
        setPendiente({ punto, piso, cuarto: nombre, esReferencia })
        setPaso('resultado')
      } catch {
        if (!ctrl.signal.aborted) setPaso(esReferencia ? 'referencia' : 'caminata')
      } finally {
        cancelar.current = null
        setProgreso(null)
      }
    },
    [cuarto, opciones, piso],
  )

  function guardarPendiente() {
    if (pendiente === null) return
    const { piso: pi, cuarto: cu, esReferencia, punto } = pendiente
    setParadas((prev) => agregarPunto(prev, pi, cu, esReferencia, punto))
    setPendiente(null)
    setPaso('caminata')
  }

  function descartarPendiente() {
    const esReferencia = pendiente?.esReferencia ?? false
    setPendiente(null)
    // Si se descarta la referencia y aún no hay ninguna, hay que volver a pedirla.
    setPaso(esReferencia && referencia === null ? 'referencia' : 'caminata')
  }

  function cancelarMedicion() {
    cancelar.current?.abort()
    cancelar.current = null
    setProgreso(null)
    setPaso(referencia === null ? 'referencia' : 'caminata')
  }

  /* ─────────────── 1. wifi o datos móviles ─────────────── */

  if (paso === 'conexion') {
    return (
      <PasoConexion
        dispositivo={dispositivo}
        detectaConexion={sabeDistinguirConexion()}
        onRevisar={() => setDispositivo(detectarDispositivo())}
        onConfirmarWifi={() => {
          setDispositivo((d) => ({ ...d, conexion_confirmada: true }))
          setPaso('referencia')
        }}
        onSeguirEnAhorro={() => {
          setOpciones(AHORRO)
          setPaso('referencia')
        }}
      />
    )
  }

  /* ─────────────── 2. la referencia, junto al router ─────────────── */

  if (paso === 'referencia') {
    return (
      <Pantalla
        paso={2}
        titulo="Empecemos junto al router"
        bajada="Esta primera medición es la referencia: lo mejor que tu casa puede dar. Todo lo que midas después se compara contra ella."
        pie={<Boton onClick={() => void tomarPunto(true)}>Medir aquí, junto al router</Boton>}
      >
        <div className="rounded-2xl border border-win-200 bg-win-100/70 p-4 text-sm leading-snug text-win-900">
          Sin esta medición no podemos separar dos problemas distintos: que tu internet venga lento
          desde la calle, o que tu wifi no llegue bien a un cuarto. Son soluciones muy diferentes.
        </div>

        <p className="mt-6 mb-3 font-semibold text-win-900">¿Dónde está el router?</p>
        <SelectorUbicacion
          piso={piso}
          cuarto={cuarto}
          puntosPorCuarto={{}}
          onCambiarPiso={setPiso}
          onCambiarCuarto={setCuarto}
        />

        {opciones === AHORRO && (
          <p className="mt-4 text-sm text-gray-600">
            Modo ahorro activado: cada punto usará ~
            {(PUNTO_AHORRO_EFECTIVO.topeBytes / (1024 * 1024)).toFixed(1)} MB en vez de{' '}
            {(PUNTO_EFECTIVO.topeBytes / (1024 * 1024)).toFixed(1)} MB.
          </p>
        )}
      </Pantalla>
    )
  }

  /* ─────────────── 3. midiendo un punto ─────────────── */

  if (paso === 'midiendo') {
    return (
      <Medidor
        cuarto={midiendoEtiqueta}
        progreso={progreso}
        pantallaEncendida={wakeLock === 'activo'}
        onCancelar={cancelarMedicion}
      />
    )
  }

  /* ─────────────── 4. el punto recién medido, antes de guardarlo ─────────────── */

  if (paso === 'resultado' && pendiente !== null) {
    const k = clave(pendiente.piso, pendiente.cuarto)
    const yaTiene = paradas.find((p) => clave(p.piso, p.cuarto) === k)?.puntos ?? []

    return (
      <ResultadoPunto
        etiqueta={etiquetaDeCuarto(pendiente.piso, pendiente.cuarto, pendiente.esReferencia)}
        numero={yaTiene.length + 1}
        punto={pendiente.punto}
        anteriores={yaTiene}
        referencia={pendiente.esReferencia ? null : datosReferencia}
        onGuardar={guardarPendiente}
        onDescartar={descartarPendiente}
      />
    )
  }

  /* ─────────────── 5. la caminata ─────────────── */

  const nombreLimpio = limpiar(cuarto)
  const puedeMedir = nombreLimpio.length >= 2
  const habitaciones = paradas.length
  const listo = habitaciones >= MINIMO_HABITACIONES

  const puntosPorCuarto: Record<string, number> = {}
  for (const p of paradas) puntosPorCuarto[clave(p.piso, p.cuarto)] = p.puntos.length

  const puntosAqui = puntosPorCuarto[clave(piso, nombreLimpio)] ?? 0

  return (
    <Pantalla
      paso={2}
      titulo="Camina por tu casa"
      bajada="Marca dónde estás y toma un punto. Mientras caminas, el semáforo de arriba se mueve solo."
      pie={
        <>
          <Boton disabled={!puedeMedir} onClick={() => void tomarPunto(false)}>
            {puedeMedir
              ? `Tomar punto aquí${puntosAqui > 0 ? ` (${puntosAqui + 1}º en ${nombreLimpio})` : ''}`
              : 'Elige dónde estás'}
          </Boton>
          <Boton
            variante={listo ? 'secundario' : 'texto'}
            disabled={!listo}
            onClick={() => onTerminar({ dispositivo, mediciones, recorrido })}
          >
            {listo
              ? `Terminar y ver mi mapa (${habitaciones} habitaciones)`
              : `Mide al menos ${MINIMO_HABITACIONES} habitaciones`}
          </Boton>
        </>
      }
    >
      <IndicadorSenal
        indice={indiceVivo}
        ubicacion={`${nombreLimpio === '' ? 'Sin marcar' : nombreLimpio} · Piso ${piso}`}
        latencia={ultimas.at(-1) ?? null}
        ultimas={ultimas}
      />

      {avisoCache && (
        <p className="mt-4 rounded-xl bg-malo-bg p-3 text-sm text-malo">
          El último punto salió del caché del navegador, así que ese número no es real. Tómalo de
          nuevo.
        </p>
      )}

      {wakeLock === 'no_disponible' && (
        <p className="mt-4 text-sm text-gray-500">
          Tu navegador no deja mantener la pantalla encendida. Si se apaga, la medición se pausa.
        </p>
      )}

      <p className="mt-7 mb-3 font-semibold text-win-900">¿Dónde estás ahora?</p>
      <SelectorUbicacion
        piso={piso}
        cuarto={cuarto}
        puntosPorCuarto={puntosPorCuarto}
        onCambiarPiso={setPiso}
        onCambiarCuarto={setCuarto}
      />

      {filas.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-bold text-win-900">Tu mapa hasta ahora</h2>
            <span className="text-xs text-gray-500">{megasGastadas(bytes)} MB usados</span>
          </div>
          <ArbolCobertura filas={filas} />

          <h3 className="mt-7 mb-1 font-semibold text-win-900">Puntos que tomaste</h3>
          <p className="mb-3 text-sm text-gray-600">
            Cada cuarto se resume con la mediana de sus puntos. Si uno salió mal o quedó en el
            cuarto equivocado, bórralo aquí sin perder los demás.
          </p>
          <PuntosTomados
            paradas={paradas}
            referencia={datosReferencia}
            onBorrarPunto={(pi, cu, i) => setParadas((prev) => quitarPunto(prev, pi, cu, i))}
            onBorrarCuarto={(pi, cu) => setParadas((prev) => quitarCuarto(prev, pi, cu))}
          />
        </div>
      )}
    </Pantalla>
  )
}

/* ─────────────── helpers ─────────────── */

function agregarPunto(
  paradas: Parada[],
  piso: number,
  cuarto: string,
  esReferencia: boolean,
  punto: Punto,
): Parada[] {
  const k = clave(piso, cuarto)
  const i = paradas.findIndex((p) => clave(p.piso, p.cuarto) === k)
  if (i === -1) return [...paradas, { piso, cuarto, es_referencia: esReferencia, puntos: [punto] }]

  const copia = [...paradas]
  copia[i] = { ...copia[i], puntos: [...copia[i].puntos, punto] }
  return copia
}

/** Quita UN punto concreto por su posición dentro del cuarto. */
function quitarPunto(paradas: Parada[], piso: number, cuarto: string, indice: number): Parada[] {
  const k = clave(piso, cuarto)
  return paradas
    .map((p) =>
      clave(p.piso, p.cuarto) === k
        ? { ...p, puntos: p.puntos.filter((_, i) => i !== indice) }
        : p,
    )
    .filter((p) => p.puntos.length > 0)
}

/** Quita el cuarto entero con todos sus puntos. */
function quitarCuarto(paradas: Parada[], piso: number, cuarto: string): Parada[] {
  const k = clave(piso, cuarto)
  return paradas.filter((p) => clave(p.piso, p.cuarto) !== k)
}

/** navigator.connection cambia durante la caminata; nos quedamos con lo último. */
function datosDeRedFrescos(): Partial<Dispositivo> {
  const d = detectarDispositivo()
  const fresco: Partial<Dispositivo> = {
    effective_type: d.effective_type,
    downlink_mbps: d.downlink_mbps,
    rtt_ms: d.rtt_ms,
    ahorro_datos: d.ahorro_datos,
  }
  if (sabeDistinguirConexion()) fresco.conexion = d.conexion
  return fresco
}
