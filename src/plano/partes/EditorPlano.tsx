import {
  type KeyboardEvent as EventoTeclado,
  type PointerEvent as EventoPuntero,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import type { Habitacion } from '../../contrato'
import { type Nivel, nivelDeIndice } from '../../medicion/senal'
import { Icono, IconoMas } from '../../ui/Iconos'
import { type Accion, type EstadoPlano, type PuntoPlano, habitacionesDelPiso, puntosDe } from '../estado'
import { PASO_GRILLA, centro } from '../geometria'
import {
  type Marca,
  type ModoEditor,
  type Seleccion,
  type Vista,
  acercar,
  desplazar,
  recortarTexto,
  tamanoTexto,
  vistaParaPiso,
} from '../vista'

/**
 * El esquema de un piso en SVG: habitaciones, router y puntos.
 *
 * Dos modos, pensados para no desarmar nada sin querer:
 *  - 'acomodar' (por defecto): tocar una habitación la selecciona; ya
 *    seleccionada, arrastrarla la mueve y la esquina de abajo a la derecha le
 *    cambia el tamaño.
 *  - 'medir': tocar una habitación marca «estoy aquí» en ese lugar (onMarcar), y
 *    el punto seleccionado se arrastra para corregir dónde quedó. Las
 *    habitaciones no se mueven: caminando con el celular es fácil rozarlas.
 * En los dos, arrastrar el fondo o algo no seleccionado desplaza la vista, tocar
 * un punto lo selecciona y tocar el fondo quita la selección.
 *
 * Con teclado: Tab llega a cada habitación y punto; Enter selecciona (en
 * 'medir', Enter sobre una habitación marca su centro). Las flechas mueven lo
 * seleccionado y, en 'acomodar', Shift + flechas cambia el tamaño.
 *
 * Sin `onAccion` es solo lectura.
 */

interface Props {
  estado: EstadoPlano
  piso: number
  /** Índice por id de punto (indicesPorPunto). Un punto sin índice se dibuja gris. */
  indices: Map<string, number>
  seleccion: Seleccion
  onSeleccionar: (seleccion: Seleccion) => void
  onAccion?: (accion: Accion) => unknown
  modo?: ModoEditor
  /** Modo 'medir': el usuario tocó una habitación para decir «estoy aquí». */
  onMarcar?: (marca: Marca) => void
  /** La marca «estoy aquí» a dibujar, si hay. */
  marca?: Marca | null
  /**
   * Capa debajo de las habitaciones (el mapa de calor del reporte, F5). No
   * captura toques ni se ve afectada por la interacción del editor.
   */
  fondo?: ReactNode
  /** Tamaño del contenedor, p. ej. "aspect-[4/3]". */
  className?: string
}

/** Cuánto hay que arrastrar, en px de pantalla, para que deje de ser un toque. */
const UMBRAL_ARRASTRE_PX = 6
const FACTOR_ZOOM = 1.4
/** Paso de las flechas para un punto: más fino que la grilla de las habitaciones. */
const PASO_TECLADO_PUNTO = 0.25

const RELLENO_NIVEL: Record<Nivel, string> = {
  fuerte: 'fill-bueno',
  media: 'fill-regular',
  debil: 'fill-malo',
}

/** Las mismas barras que IconoNivel: el nivel se lee por la forma, no solo por el color. */
const BARRAS_NIVEL: Record<Nivel, number> = { fuerte: 3, media: 2, debil: 1 }

const FLECHAS: Partial<Record<string, [number, number]>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

type TipoGesto = 'desplazar' | 'mover' | 'redimensionar' | 'mover_punto'

interface Gesto {
  tipo: TipoGesto
  puntero: number
  /** Pantalla → metros, congelada al empezar: la vista cambia mientras se arrastra. */
  inversa: DOMMatrix
  inicio: DOMPoint
  cliente: { x: number; y: number }
  vista: Vista
  movio: boolean
  /** Lo que se selecciona si al final fue un toque. null = el fondo. */
  objetivo: Seleccion
  /** La habitación tal como estaba al empezar a moverla o redimensionarla. */
  habitacion: Habitacion | null
  /** El punto tal como estaba al empezar a arrastrarlo. */
  punto: PuntoPlano | null
}

/** F8: dos dedos en el fondo hacen zoom (distancia) y desplazan (punto medio). */
interface Pellizco {
  /** Pantalla → metros con la vista de cuando empezó el pellizco, congelada. */
  inversa: DOMMatrix
  distanciaInicial: number
  medioInicial: DOMPoint
  vistaInicial: Vista
}

/** Distancia y punto medio en pantalla entre los dos dedos activos. */
function medidasDePellizco(punteros: Map<number, { x: number; y: number }>) {
  const [a, b] = [...punteros.values()]
  return {
    distancia: Math.hypot(b.x - a.x, b.y - a.y),
    medio: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
  }
}

export function EditorPlano({
  estado,
  piso,
  indices,
  seleccion,
  onSeleccionar,
  onAccion,
  modo = 'acomodar',
  onMarcar,
  marca = null,
  fondo,
  className = '',
}: Props) {
  const habitaciones = habitacionesDelPiso(estado, piso)
  const puntos = habitaciones.flatMap((h) => puntosDe(estado, h.id))
  const router = estado.plano.router?.piso === piso ? estado.plano.router : null
  /** Se pueden mover y redimensionar habitaciones. */
  const acomodando = onAccion !== undefined && modo === 'acomodar'
  /** Se puede arrastrar el punto seleccionado. */
  const corrigiendoPuntos = onAccion !== undefined && modo === 'medir'

  const svg = useRef<SVGSVGElement>(null)
  const gesto = useRef<Gesto | null>(null)
  /** F8: pellizco para hacer zoom. Client coords de cada dedo, por pointerId. */
  const punteros = useRef<Map<number, { x: number; y: number }>>(new Map())
  const pellizco = useRef<Pellizco | null>(null)
  const patron = `grilla-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const [tamano, setTamano] = useState({ ancho: 0, alto: 0 })

  /*
   * La vista se reajusta sola al cambiar de piso o cuando aparece o desaparece
   * una habitación. Mover o redimensionar no la toca: el piso no puede
   * «escaparse» de debajo del dedo mientras se arrastra.
   */
  const huella = `${piso}|${habitaciones.length}`
  const [encuadre, setEncuadre] = useState(() => ({
    huella,
    vista: vistaParaPiso(habitaciones),
  }))
  if (encuadre.huella !== huella) setEncuadre({ huella, vista: vistaParaPiso(habitaciones) })
  const vista = encuadre.vista

  function cambiarVista(v: Vista) {
    setEncuadre((e) => ({ ...e, vista: v }))
  }

  // El tamaño real del SVG, para que los textos midan lo mismo con cualquier zoom.
  useEffect(() => {
    const el = svg.current
    if (el === null || typeof ResizeObserver === 'undefined') return
    const observador = new ResizeObserver(([entrada]) => {
      setTamano({ ancho: entrada.contentRect.width, alto: entrada.contentRect.height })
    })
    observador.observe(el)
    return () => observador.disconnect()
  }, [])

  const fs = tamanoTexto(vista, tamano.ancho, tamano.alto)
  const idHabitacion = seleccion?.tipo === 'habitacion' ? seleccion.id : null
  const idPunto = seleccion?.tipo === 'punto' ? seleccion.id : null
  const seleccionada = acomodando ? (habitaciones.find((h) => h.id === idHabitacion) ?? null) : null
  const marcaVisible =
    marca !== null && habitaciones.some((h) => h.id === marca.habitacion_id) ? marca : null

  /* ─────────────── gestos ─────────────── */

  function empezar(
    e: EventoPuntero<SVGElement>,
    tipo: TipoGesto,
    objetivo: Seleccion,
    habitacion: Habitacion | null = null,
    punto: PuntoPlano | null = null,
  ) {
    // Un gesto de un dedo a la vez, y ninguno mientras haya un pellizco activo.
    if (e.button !== 0 || gesto.current !== null || pellizco.current !== null) return
    const el = svg.current
    const ctm = el?.getScreenCTM()
    if (el === null || ctm === null || ctm === undefined) return

    e.stopPropagation()
    el.setPointerCapture(e.pointerId)
    const inversa = ctm.inverse()
    gesto.current = {
      tipo,
      puntero: e.pointerId,
      inversa,
      inicio: new DOMPoint(e.clientX, e.clientY).matrixTransform(inversa),
      cliente: { x: e.clientX, y: e.clientY },
      vista,
      movio: false,
      objetivo,
      habitacion,
      punto,
    }
  }

  function empezarPunto(e: EventoPuntero<SVGElement>, p: PuntoPlano) {
    const arrastrable = corrigiendoPuntos && p.id === idPunto
    empezar(
      e,
      arrastrable ? 'mover_punto' : 'desplazar',
      { tipo: 'punto', id: p.id },
      null,
      arrastrable ? p : null,
    )
  }

  /*
   * F8: zoom con pellizco. Corre en la fase de captura del <svg>, ANTES de que
   * cada habitación/punto reciba el evento y llame a `empezar()` — así, no
   * importa dónde caiga el segundo dedo, el pellizco siempre gana.
   */
  function alBajarDedo(e: EventoPuntero<SVGSVGElement>) {
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (punteros.current.size !== 2) return

    const el = svg.current
    const ctm = el?.getScreenCTM()
    if (el === null || ctm === null || ctm === undefined) return

    // Un gesto de un dedo ya en curso se cancela: dos dedos ahora es pellizco.
    if (gesto.current !== null) {
      el.releasePointerCapture(gesto.current.puntero)
      gesto.current = null
    }

    const inversa = ctm.inverse()
    const { distancia, medio } = medidasDePellizco(punteros.current)
    pellizco.current = {
      inversa,
      distanciaInicial: distancia,
      medioInicial: new DOMPoint(medio.x, medio.y).matrixTransform(inversa),
      vistaInicial: vista,
    }
  }

  function alMoverDedo(e: EventoPuntero<SVGSVGElement>) {
    if (!punteros.current.has(e.pointerId)) return
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    const p = pellizco.current
    if (p === null || punteros.current.size < 2) return

    const { distancia, medio } = medidasDePellizco(punteros.current)
    const factor = distancia / p.distanciaInicial
    const medioActual = new DOMPoint(medio.x, medio.y).matrixTransform(p.inversa)

    const escalada = acercar(p.vistaInicial, factor)
    cambiarVista(desplazar(escalada, -(medioActual.x - p.medioInicial.x), -(medioActual.y - p.medioInicial.y)))
  }

  function alSoltarDedo(e: EventoPuntero<SVGSVGElement>) {
    punteros.current.delete(e.pointerId)
    if (punteros.current.size < 2) pellizco.current = null
  }

  function arrastrar(e: EventoPuntero<SVGSVGElement>) {
    if (pellizco.current !== null) return
    const g = gesto.current
    if (g === null || g.puntero !== e.pointerId) return
    if (!g.movio && Math.hypot(e.clientX - g.cliente.x, e.clientY - g.cliente.y) < UMBRAL_ARRASTRE_PX) {
      return
    }
    g.movio = true

    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(g.inversa)
    const dx = p.x - g.inicio.x
    const dy = p.y - g.inicio.y

    if (g.tipo === 'desplazar') {
      cambiarVista(desplazar(g.vista, -dx, -dy))
      return
    }
    if (onAccion === undefined) return

    // El reducer ajusta, recorta y rechaza lo inválido: aquí se despacha sin miedo.
    if (g.tipo === 'mover_punto') {
      if (g.punto !== null) {
        onAccion({ tipo: 'mover_punto', id: g.punto.id, x: g.punto.x + dx, y: g.punto.y + dy })
      }
      return
    }
    const h = g.habitacion
    if (h === null) return
    onAccion(
      g.tipo === 'mover'
        ? { tipo: 'mover_habitacion', id: h.id, x: h.x + dx, y: h.y + dy }
        : { tipo: 'redimensionar_habitacion', id: h.id, ancho: h.ancho + dx, alto: h.alto + dy },
    )
  }

  function terminar(e: EventoPuntero<SVGSVGElement>) {
    const g = gesto.current
    if (g === null || g.puntero !== e.pointerId) return
    gesto.current = null
    if (e.type !== 'pointerup' || g.movio) return

    // En modo medir, tocar una habitación es «estoy aquí», no seleccionarla.
    if (modo === 'medir' && onMarcar !== undefined && g.objetivo?.tipo === 'habitacion') {
      onMarcar({ habitacion_id: g.objetivo.id, x: g.inicio.x, y: g.inicio.y })
      return
    }
    onSeleccionar(g.objetivo)
  }

  function teclaHabitacion(e: EventoTeclado<SVGGElement>, h: Habitacion) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (modo === 'medir' && onMarcar !== undefined) {
        onMarcar({ habitacion_id: h.id, ...centro(h) })
      } else {
        onSeleccionar({ tipo: 'habitacion', id: h.id })
      }
      return
    }
    const flecha = FLECHAS[e.key]
    if (flecha === undefined || onAccion === undefined || modo !== 'acomodar' || idHabitacion !== h.id) {
      return
    }
    e.preventDefault()
    const [fx, fy] = flecha
    onAccion(
      e.shiftKey
        ? {
            tipo: 'redimensionar_habitacion',
            id: h.id,
            ancho: h.ancho + fx * PASO_GRILLA,
            alto: h.alto + fy * PASO_GRILLA,
          }
        : { tipo: 'mover_habitacion', id: h.id, x: h.x + fx * PASO_GRILLA, y: h.y + fy * PASO_GRILLA },
    )
  }

  function teclaPunto(e: EventoTeclado<SVGGElement>, p: PuntoPlano) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSeleccionar({ tipo: 'punto', id: p.id })
      return
    }
    const flecha = FLECHAS[e.key]
    if (flecha === undefined || onAccion === undefined || modo !== 'medir' || idPunto !== p.id) return
    e.preventDefault()
    onAccion({
      tipo: 'mover_punto',
      id: p.id,
      x: p.x + flecha[0] * PASO_TECLADO_PUNTO,
      y: p.y + flecha[1] * PASO_TECLADO_PUNTO,
    })
  }

  /* ─────────────── dibujo ─────────────── */

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-white ring-1 ring-win-200/60 ${className}`}>
      <svg
        ref={svg}
        viewBox={`${vista.x} ${vista.y} ${vista.ancho} ${vista.alto}`}
        preserveAspectRatio="xMidYMid meet"
        className="block h-full w-full touch-none select-none"
        role="group"
        aria-label={`Esquema del piso ${piso}`}
        onPointerDown={(e) => empezar(e, 'desplazar', null)}
        onPointerMove={arrastrar}
        onPointerUp={terminar}
        onPointerCancel={terminar}
        onPointerDownCapture={alBajarDedo}
        onPointerMoveCapture={alMoverDedo}
        onPointerUpCapture={alSoltarDedo}
        onPointerCancelCapture={alSoltarDedo}
      >
        <defs>
          <pattern id={patron} width="1" height="1" patternUnits="userSpaceOnUse">
            <circle cx="0" cy="0" r={Math.min(0.04, fs * 0.12)} className="fill-win-200" />
          </pattern>
        </defs>

        {/* Grilla de 1 m. Cubre de sobra lo que se ve, franjas del `meet` incluidas. */}
        <rect
          x={vista.x - vista.ancho}
          y={vista.y - vista.alto}
          width={vista.ancho * 3}
          height={vista.alto * 3}
          fill={`url(#${patron})`}
        />

        {fondo}

        {habitaciones.map((h) => {
          const activa = h.id === idHabitacion
          const resaltada = activa || h.id === marcaVisible?.habitacion_id
          const n = puntosDe(estado, h.id).length
          return (
            <g
              key={h.id}
              role="button"
              tabIndex={0}
              aria-pressed={acomodando ? activa : undefined}
              aria-label={`${h.nombre}, ${n === 0 ? 'sin medir' : `${n} ${n === 1 ? 'punto' : 'puntos'}`}`}
              className={`group outline-none ${activa && acomodando ? 'cursor-move' : 'cursor-pointer'}`}
              onPointerDown={(e) =>
                empezar(
                  e,
                  activa && acomodando ? 'mover' : 'desplazar',
                  { tipo: 'habitacion', id: h.id },
                  h,
                )
              }
              onKeyDown={(e) => teclaHabitacion(e, h)}
            >
              <title>{h.nombre}</title>
              <rect
                x={h.x}
                y={h.y}
                width={h.ancho}
                height={h.alto}
                rx={Math.min(0.15, h.ancho / 8)}
                className={
                  activa
                    ? 'fill-win-100 stroke-win-700'
                    : resaltada
                      ? 'fill-win-50 stroke-win-500'
                      : 'fill-white stroke-win-200 group-focus-visible:stroke-win-500'
                }
                strokeWidth={activa ? 3 : resaltada ? 2 : 1.5}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          )
        })}

        {router !== null && <MarcaRouter x={router.x} y={router.y} fs={fs} />}

        {/*
          Zonas de toque de los puntos, TODAS debajo de los marcadores. Si cada
          punto llevara la suya pegada, la zona generosa del punto dibujado
          después taparía el círculo visible del vecino, y tocar un punto
          abriría el de al lado (pasó en la prueba con navegador).
        */}
        {puntos.map((p) => (
          <circle
            key={`toque-${p.id}`}
            cx={p.x}
            cy={p.y}
            r={fs * 1.1}
            fill="transparent"
            aria-hidden="true"
            className={corrigiendoPuntos && p.id === idPunto ? 'cursor-move' : 'cursor-pointer'}
            onPointerDown={(e) => empezarPunto(e, p)}
          />
        ))}

        {puntos.map((p) => {
          const indice = indices.get(p.id)
          const nivel = indice === undefined ? null : nivelDeIndice(indice)
          return (
            <g
              key={p.id}
              role="button"
              tabIndex={0}
              aria-pressed={p.id === idPunto}
              aria-label={
                p.error !== undefined
                  ? 'Punto sin señal'
                  : `Punto: ${p.descarga_mbps.toFixed(1)} Mbps${indice === undefined ? '' : `, índice ${indice}`}`
              }
              className={`outline-none ${corrigiendoPuntos && p.id === idPunto ? 'cursor-move' : 'cursor-pointer'}`}
              onPointerDown={(e) => empezarPunto(e, p)}
              onKeyDown={(e) => teclaPunto(e, p)}
            >
              <MarcaPunto x={p.x} y={p.y} fs={fs} nivel={nivel} activo={p.id === idPunto} />
            </g>
          )
        })}

        {/*
          Nombres ENCIMA de puntos y router, con un borde del color del fondo:
          en un celular con todo el piso a la vista, un punto automático cae
          sobre el nombre y lo tapaba (se vio en el navegador). No capturan
          toques: pasan a la habitación o al punto que haya debajo.
        */}
        <g pointerEvents="none" aria-hidden="true">
          {habitaciones.map((h) => {
            const nombre = recortarTexto(h.nombre, h.ancho - fs * 1.2, fs)
            if (nombre === '') return null
            const n = puntosDe(estado, h.id).length
            // Con puntos, el conteo solo si sobra alto: los marcadores ya lo dicen.
            const detalle =
              n === 0
                ? h.alto >= fs * 3.2
                  ? 'sin medir'
                  : null
                : h.alto >= fs * 6
                  ? `${n} ${n === 1 ? 'punto' : 'puntos'}`
                  : null
            const halo =
              h.id === idHabitacion
                ? 'stroke-win-100'
                : h.id === marcaVisible?.habitacion_id
                  ? 'stroke-win-50'
                  : 'stroke-white'
            return (
              <g key={h.id}>
                <text
                  x={h.x + fs * 0.6}
                  y={h.y + fs * 1.45}
                  fontSize={fs}
                  fontWeight={700}
                  className={`fill-win-900 ${halo}`}
                  strokeWidth={fs * 0.28}
                  strokeLinejoin="round"
                  paintOrder="stroke"
                >
                  {nombre}
                </text>
                {detalle !== null && (
                  <text
                    x={h.x + fs * 0.6}
                    y={h.y + fs * 2.55}
                    fontSize={fs * 0.8}
                    className={`fill-gray-500 ${halo}`}
                    strokeWidth={fs * 0.22}
                    strokeLinejoin="round"
                    paintOrder="stroke"
                  >
                    {detalle}
                  </text>
                )}
              </g>
            )
          })}
        </g>

        {marcaVisible !== null && <MarcaAqui x={marcaVisible.x} y={marcaVisible.y} fs={fs} />}

        {seleccionada !== null && (
          <g
            className="cursor-nwse-resize"
            aria-hidden="true"
            onPointerDown={(e) =>
              empezar(e, 'redimensionar', { tipo: 'habitacion', id: seleccionada.id }, seleccionada)
            }
          >
            {/* Zona de toque generosa: una esquina de 1 cm no se acierta con el dedo. */}
            <circle
              cx={seleccionada.x + seleccionada.ancho}
              cy={seleccionada.y + seleccionada.alto}
              r={fs * 1.4}
              fill="transparent"
            />
            <circle
              cx={seleccionada.x + seleccionada.ancho}
              cy={seleccionada.y + seleccionada.alto}
              r={fs * 0.5}
              className="fill-white stroke-win-700"
              strokeWidth={2.5}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )}
      </svg>

      {habitaciones.length === 0 && (
        <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 px-6 text-center text-sm text-gray-500">
          Este piso todavía no tiene habitaciones.
        </p>
      )}

      <div className="absolute right-2 bottom-2 flex flex-col gap-1.5">
        <BotonMapa etiqueta="Acercar" onClick={() => cambiarVista(acercar(vista, FACTOR_ZOOM))}>
          <IconoMas className="h-5 w-5" />
        </BotonMapa>
        <BotonMapa etiqueta="Alejar" onClick={() => cambiarVista(acercar(vista, 1 / FACTOR_ZOOM))}>
          <Icono className="h-5 w-5">
            <path d="M5 12h14" />
          </Icono>
        </BotonMapa>
        <BotonMapa etiqueta="Ver todo el piso" onClick={() => cambiarVista(vistaParaPiso(habitaciones))}>
          <Icono className="h-5 w-5">
            <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
          </Icono>
        </BotonMapa>
      </div>
    </div>
  )
}

function BotonMapa({
  etiqueta,
  onClick,
  children,
}: {
  etiqueta: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      title={etiqueta}
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/95 text-win-700 shadow-sm ring-1 ring-win-200 transition active:scale-95 hover:ring-win-500"
    >
      {children}
    </button>
  )
}

/** El router: cuadrado de marca con ondas. No captura toques: pasan a su habitación. */
function MarcaRouter({ x, y, fs }: { x: number; y: number; fs: number }) {
  const lado = fs * 1.7
  const cy = y + lado * 0.18
  const arco = (r: number) =>
    `M ${x - r * 0.72} ${cy - r * 0.7} A ${r} ${r} 0 0 1 ${x + r * 0.72} ${cy - r * 0.7}`

  return (
    <g pointerEvents="none" aria-hidden="true">
      <rect
        x={x - lado / 2}
        y={y - lado / 2}
        width={lado}
        height={lado}
        rx={lado * 0.25}
        className="fill-win-700"
        stroke="white"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      {[0.36, 0.2].map((r) => (
        <path
          key={r}
          d={arco(lado * r)}
          fill="none"
          stroke="white"
          strokeWidth={2}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <circle cx={x} cy={cy} r={lado * 0.06} fill="white" />
    </g>
  )
}

/** «Estás aquí»: donde el usuario tocó el plano. El próximo punto se guarda ahí. */
function MarcaAqui({ x, y, fs }: { x: number; y: number; fs: number }) {
  return (
    <g pointerEvents="none" aria-hidden="true">
      <circle
        cx={x}
        cy={y}
        r={fs * 1.05}
        className="fill-win-500/15 stroke-win-500"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={x}
        cy={y}
        r={fs * 0.32}
        className="fill-win-500"
        stroke="white"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
    </g>
  )
}

/** Un punto medido: círculo del color del nivel con las barras de IconoNivel adentro. */
function MarcaPunto({
  x,
  y,
  fs,
  nivel,
  activo,
}: {
  x: number
  y: number
  fs: number
  nivel: Nivel | null
  activo: boolean
}) {
  const r = fs * 0.62
  const caja = r * 1.05
  const barra = caja * 0.22
  const hueco = caja * 0.17
  const encendidas = nivel === null ? 0 : BARRAS_NIVEL[nivel]

  return (
    <>
      {activo && (
        <circle
          cx={x}
          cy={y}
          r={r * 1.65}
          fill="none"
          className="stroke-win-700"
          strokeWidth={2.5}
          vectorEffect="non-scaling-stroke"
        />
      )}
      <circle
        cx={x}
        cy={y}
        r={r}
        className={nivel === null ? 'fill-gray-400' : RELLENO_NIVEL[nivel]}
        stroke="white"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
      {[0, 1, 2].map((i) => {
        const alto = caja * (0.4 + 0.3 * i)
        return (
          <rect
            key={i}
            x={x - caja / 2 + i * (barra + hueco)}
            y={y + caja / 2 - alto}
            width={barra}
            height={alto}
            rx={barra * 0.3}
            fill="white"
            opacity={i < encendidas ? 1 : 0.35}
          />
        )
      })}
    </>
  )
}
