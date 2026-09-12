import { useEffect, useMemo, useState } from 'react'
import type { Dispositivo, Habitacion, Punto, ResultadoMedicion, SenalDeclarada } from '../contrato'
import { etiquetaDeCuarto, megasGastadas } from '../medicion/caminata'
import { limpiar } from '../medicion/cuartos'
import { datosDeRedFrescos, detectarDispositivo, sabeDistinguirConexion } from '../medicion/dispositivo'
import { AHORRO, NORMAL, PUNTO_AHORRO_EFECTIVO, PUNTO_EFECTIVO, type Opciones } from '../medicion/medir'
import { IndicadorSenal } from '../medicion/partes/IndicadorSenal'
import { Medidor } from '../medicion/partes/Medidor'
import { PasoConexion } from '../medicion/partes/PasoConexion'
import { ResultadoPunto } from '../medicion/partes/ResultadoPunto'
import { SelectorUbicacion } from '../medicion/partes/SelectorUbicacion'
import { useMedirPunto } from '../medicion/useMedirPunto'
import { useSondaEnVivo } from '../medicion/useSondaEnVivo'
import { useWakeLock } from '../medicion/useWakeLock'
import { Boton } from '../ui/Boton'
import { Pantalla } from '../ui/Pantalla'
import {
  type DestinoPunto,
  type PuntoPlano,
  buscarHabitacion,
  estadoInicial,
  habitacionDelRouter,
  habitacionPorId,
  habitacionesDelPiso,
  hayReferencia,
  indicesPorPunto,
  puntosDe,
  resultadoDelPlano,
} from './estado'
import { ChipsHabitacion } from './partes/ChipsHabitacion'
import { EditorPlano } from './partes/EditorPlano'
import { FichaPunto } from './partes/FichaPunto'
import { PanelEsquema } from './partes/PanelEsquema'
import { SelectorPiso } from './partes/SelectorPiso'
import { SelectorRayitas } from './partes/SelectorRayitas'
import { borrarRecorrido, cargarRecorrido, guardarRecorrido } from './persistencia'
import { usePlano } from './usePlano'
import type { Marca, ModoEditor, Seleccion } from './vista'

/**
 * Caminata sobre plano: la misma medición de la caminata, pero cada punto queda
 * ubicado en un esquema de la casa que la app arma sola. Dibujar es opcional: se
 * puede elegir el cuarto de la lista, como antes, o tocar el plano donde uno está
 * parado.
 *
 * Mismas props que FlujoCaminata, para volver a ella cambiando una línea en
 * App.tsx. Entrega además `plano`, que B y C pueden ignorar.
 *
 * El recorrido se guarda en este navegador a cada cambio y se ofrece retomarlo
 * al volver a entrar. Se borra al terminar.
 */

type Paso = 'retomar' | 'conexion' | 'referencia' | 'caminata' | 'midiendo' | 'resultado'

/** Referencia + al menos otra habitación: con una sola no hay nada que comparar. */
const MINIMO_HABITACIONES = 2

/**
 * Dónde dice estar el usuario: una habitación que ya existe (elegida de la lista
 * o tocada en el plano, con posición si la tocó), o un nombre que todavía no
 * está en el esquema y se crea al guardar el punto.
 */
type Ubicacion = { habitacion_id: string; x?: number; y?: number } | { nombre: string }

/** El punto recién medido, todavía sin guardar, con todo lo necesario para archivarlo. */
interface Pendiente {
  punto: Punto
  destino: DestinoPunto
  piso: number
  nombre: string
  esReferencia: boolean
  /** id del punto que se está repitiendo, o null si es un punto nuevo. */
  reemplaza: string | null
}

/** El ícono de wifi del iPhone tiene 3 niveles; el de casi todo lo demás, 4. */
function maximoRayitasProbable(): number {
  return typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent) ? 3 : 4
}

export function FlujoPlano({
  onTerminar,
}: {
  onTerminar: (resultado: ResultadoMedicion) => void
}) {
  const [guardado] = useState(() => {
    const e = cargarRecorrido()
    return e !== null && e.puntos.length > 0 ? e : null
  })
  const [paso, setPaso] = useState<Paso>(guardado === null ? 'conexion' : 'retomar')
  const [dispositivo, setDispositivo] = useState<Dispositivo>(detectarDispositivo)
  const [opciones, setOpciones] = useState<Opciones>(NORMAL)
  const { estado, despachar, reemplazar } = usePlano(() => estadoInicial())
  const [piso, setPiso] = useState(1)
  const [ubicacion, setUbicacion] = useState<Ubicacion>({ nombre: 'Sala' })
  const [seleccion, setSeleccion] = useState<Seleccion>(null)
  const [modo, setModo] = useState<ModoEditor>('medir')
  const [pendiente, setPendiente] = useState<Pendiente | null>(null)
  const [rayitas, setRayitas] = useState<SenalDeclarada | null>(null)
  const [maximoRayitas, setMaximoRayitas] = useState(maximoRayitasProbable)
  const [aviso, setAviso] = useState<string | null>(null)

  const { progreso, etiqueta: midiendoEtiqueta, avisoCache, bytes, medir, cancelar } =
    useMedirPunto(opciones)
  const wakeLock = useWakeLock(paso === 'caminata' || paso === 'midiendo')

  const mediciones = useMemo(() => resultadoDelPlano(estado).mediciones, [estado])
  const indices = useMemo(() => indicesPorPunto(estado), [estado])
  /** La referencia ya consolidada: contra ella se calcula el % de cada punto. */
  const datosReferencia = useMemo(
    () => mediciones.find((m) => m.es_referencia) ?? mediciones[0] ?? null,
    [mediciones],
  )
  const latenciaReferencia = useMemo(() => {
    const h = habitacionDelRouter(estado)
    const buenos = h === null ? [] : puntosDe(estado, h.id).filter((p) => p.error === undefined)
    if (buenos.length === 0) return null
    return buenos.reduce((a, p) => a + p.latencia_ms, 0) / buenos.length
  }, [estado])

  const idRouter = estado.plano.router?.habitacion_id ?? null
  const habitacionAqui =
    'habitacion_id' in ubicacion
      ? habitacionPorId(estado, ubicacion.habitacion_id)
      : buscarHabitacion(estado, piso, ubicacion.nombre)
  const nombreAqui = habitacionAqui?.nombre ?? ('nombre' in ubicacion ? limpiar(ubicacion.nombre) : '')
  const marca: Marca | null =
    'habitacion_id' in ubicacion &&
    ubicacion.x !== undefined &&
    ubicacion.y !== undefined &&
    habitacionAqui !== null
      ? { habitacion_id: habitacionAqui.id, x: ubicacion.x, y: ubicacion.y }
      : null

  const { indice: indiceVivo, ultimas, recorrido } = useSondaEnVivo({
    activa: paso === 'caminata',
    piso,
    cuarto: nombreAqui,
    latenciaReferencia,
    referencia: datosReferencia,
  })

  // Respaldo en este navegador: cada cambio del esquema o de los puntos se guarda.
  useEffect(() => {
    if (estado.plano.habitaciones.length > 0) guardarRecorrido(estado)
  }, [estado])

  /* ─────────────── acciones ─────────────── */

  async function tomarPunto(esReferencia: boolean, repetir: PuntoPlano | null = null) {
    let destino: DestinoPunto
    let habitacion: Habitacion | null

    if (repetir !== null) {
      habitacion = habitacionPorId(estado, repetir.habitacion_id)
      if (habitacion === null) return
      destino = { habitacion_id: habitacion.id, x: repetir.x, y: repetir.y }
    } else if (habitacionAqui !== null) {
      habitacion = habitacionAqui
      destino = marca === null ? { habitacion_id: habitacion.id } : { ...marca }
    } else {
      const nombre = 'nombre' in ubicacion ? limpiar(ubicacion.nombre) : ''
      if (nombre.length < 2) return
      habitacion = null
      destino = { piso, nombre }
    }

    const pisoMedido = habitacion?.piso ?? piso
    const nombreMedido = habitacion?.nombre ?? ('nombre' in destino ? destino.nombre : '')
    const enRouter = esReferencia || (habitacion !== null && habitacion.id === idRouter)

    setAviso(null)
    setPaso('midiendo')
    // Repetir usa el perfil liviano de un punto, aunque sea junto al router.
    const toma = await medir(etiquetaDeCuarto(pisoMedido, nombreMedido, enRouter), esReferencia)

    // Al cancelar, cancelarMedicion() ya decidió a qué paso volver.
    if (toma.estado === 'cancelado') return
    if (toma.estado === 'error') {
      setPaso(esReferencia ? 'referencia' : 'caminata')
      return
    }

    setDispositivo((d) => ({ ...d, ...datosDeRedFrescos() }))
    setRayitas(repetir?.senal_declarada ?? null)
    setPendiente({
      punto: toma.punto,
      destino,
      piso: pisoMedido,
      nombre: nombreMedido,
      esReferencia,
      reemplaza: repetir?.id ?? null,
    })
    setPaso('resultado')
  }

  function guardarPendiente() {
    if (pendiente === null) return
    const punto: Punto =
      rayitas === null ? pendiente.punto : { ...pendiente.punto, senal_declarada: rayitas }

    const nuevo =
      pendiente.reemplaza !== null
        ? despachar({ tipo: 'reemplazar_punto', id: pendiente.reemplaza, punto })
        : despachar({
            tipo: 'agregar_punto',
            destino: pendiente.destino,
            punto,
            junto_al_router: pendiente.esReferencia,
          })

    // El destino se validó al medir. Si igual se rechaza (la habitación se borró
    // mientras tanto), se dice en vez de perder el punto en silencio.
    if (nuevo === null) {
      setAviso('No se pudo guardar ese punto: su habitación ya no está en el esquema. Tómalo de nuevo.')
    }

    const siguiente = nuevo ?? estado
    const donde =
      'habitacion_id' in pendiente.destino
        ? habitacionPorId(siguiente, pendiente.destino.habitacion_id)
        : buscarHabitacion(siguiente, pendiente.piso, pendiente.nombre)
    if (donde !== null) {
      setPiso(donde.piso)
      // Queda elegida esa habitación, sin la marca: el punto ya está dibujado ahí.
      setUbicacion({ habitacion_id: donde.id })
    }
    setPendiente(null)
    setRayitas(null)
    setSeleccion(null)
    setPaso(hayReferencia(siguiente) ? 'caminata' : 'referencia')
  }

  function descartarPendiente() {
    setPendiente(null)
    setRayitas(null)
    // Si se descarta la referencia y aún no hay ninguna, hay que volver a pedirla.
    setPaso(hayReferencia(estado) ? 'caminata' : 'referencia')
  }

  function cancelarMedicion() {
    cancelar()
    setPaso(hayReferencia(estado) ? 'caminata' : 'referencia')
  }

  function cambiarPiso(numero: number) {
    setPiso(numero)
    setSeleccion(null)
    // Se conserva el nombre: si en ese piso hay un cuarto igual, queda elegido.
    setUbicacion({ nombre: nombreAqui })
  }

  /** Suma el siguiente piso y salta a él, que es lo que el usuario quiere al pulsar. */
  function agregarPiso() {
    const nuevo = despachar({ tipo: 'agregar_piso' })
    if (nuevo !== null) cambiarPiso(Math.max(...nuevo.plano.pisos.map((p) => p.numero)))
  }

  function terminar() {
    borrarRecorrido()
    onTerminar({ dispositivo, ...resultadoDelPlano(estado), recorrido })
  }

  /* ─────────────── 0. retomar un recorrido guardado ─────────────── */

  if (paso === 'retomar' && guardado !== null) {
    const habitacionesMedidas = new Set(guardado.puntos.map((p) => p.habitacion_id)).size
    return (
      <Pantalla
        paso={2}
        titulo="Tienes un recorrido sin terminar"
        bajada="Quedó guardado en este celular. Puedes seguir donde lo dejaste o empezar de cero."
        pie={
          <>
            <Boton
              onClick={() => {
                reemplazar(guardado)
                const router = habitacionDelRouter(guardado)
                if (router !== null) {
                  setPiso(router.piso)
                  setUbicacion({ habitacion_id: router.id })
                }
                setPaso('conexion')
              }}
            >
              Seguir con este recorrido
            </Boton>
            <Boton
              variante="texto"
              onClick={() => {
                borrarRecorrido()
                setPaso('conexion')
              }}
            >
              Empezar de cero
            </Boton>
          </>
        }
      >
        <div className="rounded-2xl bg-white p-4 text-win-900 shadow-sm ring-1 ring-win-200/40">
          <p className="text-2xl font-bold">
            {guardado.puntos.length} {guardado.puntos.length === 1 ? 'punto' : 'puntos'}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            en {habitacionesMedidas} {habitacionesMedidas === 1 ? 'habitación' : 'habitaciones'}
          </p>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-gray-600">
          Si pasó un buen rato, conviene repetir primero el punto junto al router: la red pudo
          cambiar, y todo lo demás se compara contra él.
        </p>
      </Pantalla>
    )
  }

  /* ─────────────── 1. wifi o datos móviles ─────────────── */

  if (paso === 'conexion' || paso === 'retomar') {
    const siguientePaso: Paso = hayReferencia(estado) ? 'caminata' : 'referencia'
    return (
      <PasoConexion
        dispositivo={dispositivo}
        detectaConexion={sabeDistinguirConexion()}
        onRevisar={() => setDispositivo(detectarDispositivo())}
        onConfirmarWifi={() => {
          setDispositivo((d) => ({ ...d, conexion_confirmada: true }))
          setPaso(siguientePaso)
        }}
        onSeguirEnAhorro={() => {
          setOpciones(AHORRO)
          setPaso(siguientePaso)
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
          pisos={estado.plano.pisos.map((p) => p.numero)}
          cuarto={'nombre' in ubicacion ? ubicacion.nombre : nombreAqui}
          puntosPorCuarto={{}}
          onAgregarPiso={agregarPiso}
          onCambiarPiso={cambiarPiso}
          onCambiarCuarto={(nombre) => setUbicacion({ nombre })}
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
    const destino =
      'habitacion_id' in pendiente.destino
        ? habitacionPorId(estado, pendiente.destino.habitacion_id)
        : buscarHabitacion(estado, pendiente.piso, pendiente.nombre)
    const yaTiene = destino === null ? [] : puntosDe(estado, destino.id)
    const numero =
      pendiente.reemplaza === null
        ? yaTiene.length + 1
        : yaTiene.findIndex((p) => p.id === pendiente.reemplaza) + 1
    const enRouter = pendiente.esReferencia || (destino !== null && destino.id === idRouter)

    return (
      <ResultadoPunto
        etiqueta={etiquetaDeCuarto(pendiente.piso, pendiente.nombre, enRouter)}
        numero={numero}
        punto={pendiente.punto}
        anteriores={yaTiene.filter((p) => p.id !== pendiente.reemplaza)}
        referencia={pendiente.esReferencia ? null : datosReferencia}
        onGuardar={guardarPendiente}
        onDescartar={descartarPendiente}
        extra={
          <SelectorRayitas
            valor={rayitas}
            maximo={rayitas?.maximo ?? maximoRayitas}
            onCambiar={setRayitas}
            onCambiarMaximo={setMaximoRayitas}
          />
        }
      />
    )
  }

  /* ─────────────── 5. la caminata ─────────────── */

  const puntosPorHabitacion: Record<string, number> = {}
  for (const p of estado.puntos) {
    puntosPorHabitacion[p.habitacion_id] = (puntosPorHabitacion[p.habitacion_id] ?? 0) + 1
  }
  const habitacionesPorPiso: Record<number, number> = {}
  for (const h of estado.plano.habitaciones) {
    habitacionesPorPiso[h.piso] = (habitacionesPorPiso[h.piso] ?? 0) + 1
  }
  const medidas = Object.keys(puntosPorHabitacion).length
  const listo = medidas >= MINIMO_HABITACIONES
  const puedeMedir = habitacionAqui !== null || nombreAqui.length >= 2
  const puntosAqui = habitacionAqui === null ? 0 : (puntosPorHabitacion[habitacionAqui.id] ?? 0)
  const puntoElegido =
    seleccion?.tipo === 'punto' ? (estado.puntos.find((p) => p.id === seleccion.id) ?? null) : null

  return (
    <Pantalla
      paso={2}
      titulo="Camina por tu casa"
      bajada="Marca dónde estás y toma un punto. Mientras caminas, el semáforo de arriba se mueve solo."
      pie={
        <>
          <Boton disabled={!puedeMedir} onClick={() => void tomarPunto(false)}>
            {puedeMedir
              ? `Tomar punto aquí · ${nombreAqui}${puntosAqui > 0 ? ` (${puntosAqui + 1}º)` : ''}`
              : 'Elige dónde estás'}
          </Boton>
          <Boton variante={listo ? 'secundario' : 'texto'} disabled={!listo} onClick={terminar}>
            {listo
              ? `Terminar y ver mi mapa (${medidas} habitaciones)`
              : `Mide al menos ${MINIMO_HABITACIONES} habitaciones`}
          </Boton>
        </>
      }
    >
      <IndicadorSenal
        indice={indiceVivo}
        ubicacion={`${nombreAqui === '' ? 'Sin marcar' : nombreAqui} · Piso ${piso}`}
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

      {aviso !== null && (
        <p role="status" className="mt-4 rounded-xl bg-malo-bg p-3 text-sm text-malo">
          {aviso}
        </p>
      )}

      <div className="mt-7 mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold text-win-900">Tu casa</h2>
        <span className="text-xs text-gray-500">{megasGastadas(bytes)} MB usados</span>
      </div>

      <SelectorPiso
        pisos={estado.plano.pisos}
        piso={piso}
        habitacionesPorPiso={habitacionesPorPiso}
        onCambiar={cambiarPiso}
        onAgregar={agregarPiso}
      />

      <EditorPlano
        estado={estado}
        piso={piso}
        indices={indices}
        seleccion={seleccion}
        onSeleccionar={setSeleccion}
        onAccion={despachar}
        modo={modo}
        marca={marca}
        onMarcar={(m) => {
          setUbicacion({ habitacion_id: m.habitacion_id, x: m.x, y: m.y })
          setSeleccion(null)
        }}
        className="mt-3 aspect-[4/3]"
      />

      <div className="mt-2 flex items-start justify-between gap-3">
        <p className="text-xs leading-relaxed text-gray-500">
          {modo === 'medir'
            ? 'Toca el plano donde estás parado, o elige el cuarto abajo. No hace falta acomodar nada.'
            : 'El esquema es aproximado, no un plano a escala. Acomódalo solo si te ayuda a ubicarte.'}
        </p>
        <button
          type="button"
          onClick={() => {
            setModo(modo === 'medir' ? 'acomodar' : 'medir')
            setSeleccion(null)
          }}
          className="shrink-0 rounded-lg px-1 py-0.5 text-sm font-semibold text-win-700 underline underline-offset-4"
        >
          {modo === 'medir' ? 'Acomodar habitaciones' : 'Listo, volver a medir'}
        </button>
      </div>

      <div className="mt-5">
        {puntoElegido !== null ? (
          <FichaPunto
            key={puntoElegido.id}
            estado={estado}
            punto={puntoElegido}
            indice={indices.get(puntoElegido.id) ?? null}
            maximoRayitas={maximoRayitas}
            onCambiarMaximoRayitas={setMaximoRayitas}
            onAccion={despachar}
            onRepetir={() => void tomarPunto(false, puntoElegido)}
            onCerrar={() => setSeleccion(null)}
          />
        ) : modo === 'acomodar' ? (
          <PanelEsquema
            estado={estado}
            piso={piso}
            habitacionId={seleccion?.tipo === 'habitacion' ? seleccion.id : null}
            onSeleccionarHabitacion={(id) => setSeleccion(id === null ? null : { tipo: 'habitacion', id })}
            onAccion={despachar}
          />
        ) : (
          <>
            <p className="mb-3 font-semibold text-win-900">¿Dónde estás ahora?</p>
            {marca !== null && habitacionAqui !== null && (
              <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-win-100 px-3 py-2 text-sm text-win-900">
                <span>
                  Marcaste un lugar en <strong>{habitacionAqui.nombre}</strong>. El punto se guarda
                  ahí.
                </span>
                <button
                  type="button"
                  onClick={() => setUbicacion({ habitacion_id: habitacionAqui.id })}
                  className="font-semibold text-win-700 underline underline-offset-4"
                >
                  Quitar la marca
                </button>
              </p>
            )}
            <ChipsHabitacion
              habitaciones={habitacionesDelPiso(estado, piso)}
              puntosPorHabitacion={puntosPorHabitacion}
              elegida={habitacionAqui !== null && habitacionAqui.piso === piso ? habitacionAqui.id : null}
              nombreNuevo={'nombre' in ubicacion ? ubicacion.nombre : ''}
              onElegirHabitacion={(id) => setUbicacion({ habitacion_id: id })}
              onElegirNombre={(nombre) => setUbicacion({ nombre })}
            />
          </>
        )}
      </div>
    </Pantalla>
  )
}
