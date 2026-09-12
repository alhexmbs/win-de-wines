import { useCallback, useMemo, useState } from 'react'
import type { Dispositivo, Punto, ResultadoMedicion } from '../contrato'
import { filasDeMediciones } from '../mapa/filas'
import { ArbolCobertura } from '../mapa/ArbolCobertura'
import { Boton } from '../ui/Boton'
import { Pantalla } from '../ui/Pantalla'
import {
  PISOS_INICIALES,
  PISO_MAXIMO,
  type Parada,
  clave,
  consolidar,
  etiquetaDeCuarto,
  megasGastadas,
} from './caminata'
import { limpiar } from './cuartos'
import { datosDeRedFrescos, detectarDispositivo, sabeDistinguirConexion } from './dispositivo'
import { AHORRO, NORMAL, PUNTO_AHORRO_EFECTIVO, PUNTO_EFECTIVO, type Opciones } from './medir'
import { IndicadorSenal } from './partes/IndicadorSenal'
import { PuntosTomados } from './partes/PuntosTomados'
import { ResultadoPunto } from './partes/ResultadoPunto'
import { Medidor } from './partes/Medidor'
import { PasoConexion } from './partes/PasoConexion'
import { SelectorUbicacion } from './partes/SelectorUbicacion'
import { useMedirPunto } from './useMedirPunto'
import { useSondaEnVivo } from './useSondaEnVivo'
import { useWakeLock } from './useWakeLock'

type Paso = 'conexion' | 'referencia' | 'caminata' | 'midiendo' | 'resultado'

/** Referencia + al menos otra habitación: con una sola no hay nada que comparar. */
const MINIMO_HABITACIONES = 2

/**
 * Modo caminata: el usuario recorre su casa, el semáforo se mueve en vivo con
 * pings de 3 bytes, y en cada sitio pulsa «Tomar punto aquí» para fijar un
 * número medido de verdad. Varios puntos por habitación = resultado más fiable.
 *
 * Frontera igual que el día 1: no recibe el contexto del onboarding ni ve el
 * reporte. Entrega dispositivo + mediciones (+ recorrido) y C arma la Sesion.
 *
 * Hoy es el respaldo de la caminata sobre plano (src/plano/FlujoPlano.tsx), con
 * las mismas props. Medir un punto y el semáforo viven en hooks compartidos.
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
  /** Crece cuando el usuario pulsa «+»: el onboarding permite «4+» pisos. */
  const [pisos, setPisos] = useState<number[]>(PISOS_INICIALES)
  const [cuarto, setCuarto] = useState('Sala')
  const [paradas, setParadas] = useState<Parada[]>([])
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

  /* Medir un punto (progreso, datos gastados, aviso de caché) vive en el hook,
     para que la caminata sobre plano mida exactamente igual. */
  const {
    progreso,
    etiqueta: midiendoEtiqueta,
    avisoCache,
    bytes,
    medir,
    cancelar,
  } = useMedirPunto(opciones)
  const wakeLock = useWakeLock(paso === 'caminata' || paso === 'midiendo')

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

  /* Semáforo en vivo y pings del recorrido. Viven en el hook para que la
     caminata sobre plano los comparta. */
  const { indice: indiceVivo, ultimas, recorrido } = useSondaEnVivo({
    activa: paso === 'caminata',
    piso,
    cuarto: limpiar(cuarto),
    latenciaReferencia,
    referencia: datosReferencia,
  })

  const tomarPunto = useCallback(
    async (esReferencia: boolean) => {
      const nombre = limpiar(cuarto)
      if (nombre.length < 2) return

      setPaso('midiendo')
      const toma = await medir(etiquetaDeCuarto(piso, nombre, esReferencia), esReferencia)

      // Al cancelar, cancelarMedicion() ya decidió a qué paso volver.
      if (toma.estado === 'cancelado') return
      if (toma.estado === 'error') {
        setPaso(esReferencia ? 'referencia' : 'caminata')
        return
      }

      setDispositivo((d) => ({ ...d, ...datosDeRedFrescos() }))
      setPendiente({ punto: toma.punto, piso, cuarto: nombre, esReferencia })
      setPaso('resultado')
    },
    [cuarto, medir, piso],
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

  /** Suma el siguiente piso y salta a él, que es lo que el usuario quiere al pulsar. */
  function agregarPiso() {
    if (pisos.length >= PISO_MAXIMO) return
    const siguiente = pisos.length + 1
    setPisos([...pisos, siguiente])
    setPiso(siguiente)
  }

  function cancelarMedicion() {
    cancelar()
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
          pisos={pisos}
          cuarto={cuarto}
          puntosPorCuarto={{}}
          onAgregarPiso={agregarPiso}
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
        pisos={pisos}
        cuarto={cuarto}
        puntosPorCuarto={puntosPorCuarto}
        onAgregarPiso={agregarPiso}
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
