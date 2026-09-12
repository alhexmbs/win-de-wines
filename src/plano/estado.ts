/**
 * estado.ts — estado de la caminata sobre plano: el esquema de la vivienda y los
 * puntos tomados. Reducer puro, sin React ni DOM: corre en Node
 * (`pnpm probar:plano`) y en el navegador con useReducer.
 *
 * NO HAY DATOS DE RADIO AQUÍ. Habitaciones, posiciones y rayitas de wifi son lo
 * que el usuario declara; las cifras de cada punto salen de medir.ts. El
 * esquema lo arma la app sola: dibujar es opcional.
 *
 * Reglas que el reducer hace cumplir. Si una acción las rompe, devuelve el MISMO
 * objeto de estado, así que se puede detectar con ===:
 *  - la habitación del router es la referencia de la casa: no se borra mientras
 *    tenga puntos y no se queda sin su último punto
 *  - el router solo cambia de habitación mientras la referencia no tenga puntos
 *  - no hay dos habitaciones con el mismo nombre en el mismo piso
 *  - las habitaciones de un piso no se pisan, y cada punto queda dentro de la suya
 */
import type { Habitacion, Medicion, Plano, Punto, SenalDeclarada } from '../contrato.ts'
import { type Parada, PISOS_INICIALES, PISO_MAXIMO, consolidar } from '../medicion/caminata.ts'
import { limpiar } from '../medicion/cuartos.ts'
import {
  COORDENADA_MAXIMA,
  LADO_INICIAL,
  LADO_MAXIMO,
  LADO_MINIMO,
  type Posicion,
  acotar,
  ajustarAGrilla,
  centro,
  contiene,
  llevarAdentro,
  posicionLibre,
  redondear,
  sePisan,
} from './geometria.ts'

/** Un punto guardado. `id` vive solo en el estado: no viaja en el contrato. */
export interface PuntoPlano extends Punto {
  id: string
  habitacion_id: string
  x: number
  y: number
}

export interface EstadoPlano {
  plano: Plano
  puntos: PuntoPlano[]
  /** Contador de ids. Nunca se reusa un id, aunque se borre lo que lo tenía. */
  siguiente: number
}

/**
 * Dónde va un punto nuevo. Dos formas, a propósito:
 *  - tocó el plano: habitación y, si quiere, posición
 *  - eligió el cuarto de la lista sin dibujar: piso + nombre. Si la habitación
 *    no existe se crea en el esquema automático. Así nadie tiene que armar el
 *    plano para poder medir.
 */
export type DestinoPunto =
  | { habitacion_id: string; x?: number; y?: number }
  | { piso: number; nombre: string }

export type Accion =
  | { tipo: 'agregar_piso' }
  | { tipo: 'agregar_habitacion'; piso: number; nombre: string; junto_a?: string }
  | { tipo: 'mover_habitacion'; id: string; x: number; y: number }
  | { tipo: 'redimensionar_habitacion'; id: string; ancho: number; alto: number }
  | { tipo: 'renombrar_habitacion'; id: string; nombre: string }
  | { tipo: 'borrar_habitacion'; id: string }
  | { tipo: 'ubicar_router'; habitacion_id: string; x?: number; y?: number }
  /** `junto_al_router`: es la medición de referencia y el router queda en esa habitación. */
  | { tipo: 'agregar_punto'; destino: DestinoPunto; punto: Punto; junto_al_router?: boolean }
  | { tipo: 'mover_punto'; id: string; x: number; y: number }
  /** «Repetir aquí»: cifras nuevas para un punto, en el mismo lugar y con el mismo id. */
  | { tipo: 'reemplazar_punto'; id: string; punto: Punto }
  | { tipo: 'borrar_punto'; id: string }
  | { tipo: 'declarar_senal'; id: string; senal: SenalDeclarada | null }

/** Rayitas que puede tener un ícono de wifi. Más que esto es un error de carga. */
const MAXIMO_BARRAS = 5
/** Distancia mínima de un punto al borde: sobre la línea no se sabe de qué cuarto es. */
const MARGEN_PUNTO = 0.1
/**
 * Separación entre puntos automáticos del mismo cuarto, en metros. Holgada a
 * propósito: con todo el piso a la vista en un celular, un punto se dibuja de
 * ~0,7 m de diámetro, y con menos distancia se enciman entre sí y con el router.
 */
const PASO_ESPIRAL = 0.8
/** Ángulo áureo: reparte los puntos automáticos en espiral sin encimarlos. */
const ANGULO_AUREO = Math.PI * (3 - Math.sqrt(5))

/* ───────────────────────── creación ───────────────────────── */

export function estadoInicial(cantidadPisos: number = PISOS_INICIALES.length): EstadoPlano {
  const n = acotar(Math.round(cantidadPisos), 1, PISO_MAXIMO)
  return {
    plano: {
      pisos: Array.from({ length: n }, (_, i) => pisoNuevo(i + 1)),
      habitaciones: [],
      router: null,
      disposicion: 'auto',
    },
    puntos: [],
    siguiente: 1,
  }
}

function pisoNuevo(numero: number) {
  return { numero, nombre: `Piso ${numero}` }
}

/* ───────────────────────── consultas ───────────────────────── */

export function habitacionPorId(estado: EstadoPlano, id: string): Habitacion | null {
  return estado.plano.habitaciones.find((h) => h.id === id) ?? null
}

/** Por nombre, sin distinguir mayúsculas: «sala» y «Sala» son el mismo cuarto. */
export function buscarHabitacion(
  estado: EstadoPlano,
  piso: number,
  nombre: string,
): Habitacion | null {
  const buscado = limpiar(nombre).toLowerCase()
  return (
    estado.plano.habitaciones.find(
      (h) => h.piso === piso && h.nombre.toLowerCase() === buscado,
    ) ?? null
  )
}

export function habitacionesDelPiso(estado: EstadoPlano, piso: number): Habitacion[] {
  return estado.plano.habitaciones.filter((h) => h.piso === piso)
}

/** La habitación que contiene esa posición en ese piso. null = cayó fuera de todas. */
export function habitacionEn(
  estado: EstadoPlano,
  piso: number,
  x: number,
  y: number,
): Habitacion | null {
  return habitacionesDelPiso(estado, piso).find((h) => contiene(h, x, y)) ?? null
}

export function puntosDe(estado: EstadoPlano, habitacionId: string): PuntoPlano[] {
  return estado.puntos.filter((p) => p.habitacion_id === habitacionId)
}

export function habitacionDelRouter(estado: EstadoPlano): Habitacion | null {
  const { router } = estado.plano
  return router === null ? null : habitacionPorId(estado, router.habitacion_id)
}

/** true = ya hay medición junto al router, así que la caminata puede seguir. */
export function hayReferencia(estado: EstadoPlano): boolean {
  const h = habitacionDelRouter(estado)
  return h !== null && puntosDe(estado, h.id).length > 0
}

function esUltimoDeLaReferencia(estado: EstadoPlano, p: PuntoPlano): boolean {
  return (
    p.habitacion_id === estado.plano.router?.habitacion_id &&
    puntosDe(estado, p.habitacion_id).length === 1
  )
}

/** No se quita el único punto de la referencia: de él cuelga el índice de toda la casa. */
export function puedeBorrarPunto(estado: EstadoPlano, id: string): boolean {
  const p = estado.puntos.find((q) => q.id === id)
  return p !== undefined && !esUltimoDeLaReferencia(estado, p)
}

export function puedeBorrarHabitacion(estado: EstadoPlano, id: string): boolean {
  if (habitacionPorId(estado, id) === null) return false
  return id !== estado.plano.router?.habitacion_id || puntosDe(estado, id).length === 0
}

/** Mudar el router cambiaría la referencia de puntos ya medidos: solo antes de medirla. */
export function puedeUbicarRouterEn(estado: EstadoPlano, habitacionId: string): boolean {
  if (habitacionPorId(estado, habitacionId) === null) return false
  const actual = estado.plano.router?.habitacion_id
  return actual === undefined || actual === habitacionId || puntosDe(estado, actual).length === 0
}

export function senalValida(s: SenalDeclarada): boolean {
  return (
    Number.isInteger(s.barras) &&
    Number.isInteger(s.maximo) &&
    s.maximo >= 1 &&
    s.maximo <= MAXIMO_BARRAS &&
    s.barras >= 0 &&
    s.barras <= s.maximo
  )
}

/** Chequeo de forma para lo que vuelve de localStorage. No valida cada campo. */
export function esEstadoPlano(valor: unknown): valor is EstadoPlano {
  if (typeof valor !== 'object' || valor === null) return false
  const e = valor as Record<string, unknown>
  if (typeof e.siguiente !== 'number' || !Array.isArray(e.puntos)) return false
  if (typeof e.plano !== 'object' || e.plano === null) return false
  const p = e.plano as Record<string, unknown>
  return (
    Array.isArray(p.pisos) &&
    p.pisos.length > 0 &&
    Array.isArray(p.habitaciones) &&
    (p.disposicion === 'auto' || p.disposicion === 'usuario')
  )
}

/* ───────────────────────── salida al contrato ───────────────────────── */

/** El Punto tal como viaja: sin el id interno del estado. */
function aPunto(p: PuntoPlano): Punto {
  const copia: Partial<PuntoPlano> = { ...p }
  delete copia.id
  return copia as Punto
}

/**
 * Una Parada por habitación con puntos, en el formato de caminata.ts, para que
 * la consolidación (mediana, índice, etiqueta) sea EXACTAMENTE la de siempre.
 */
export function paradasDe(estado: EstadoPlano): Parada[] {
  const router = estado.plano.router?.habitacion_id
  return estado.plano.habitaciones.flatMap((h) => {
    const puntos = puntosDe(estado, h.id)
    if (puntos.length === 0) return []
    return [
      {
        piso: h.piso,
        cuarto: h.nombre,
        es_referencia: h.id === router,
        habitacion_id: h.id,
        puntos: puntos.map(aPunto),
      },
    ]
  })
}

/** Lo que la caminata sobre plano entrega, además del dispositivo y el recorrido. */
export function resultadoDelPlano(estado: EstadoPlano): { plano: Plano; mediciones: Medicion[] } {
  return { plano: estado.plano, mediciones: consolidar(paradasDe(estado)) }
}

/**
 * El índice de cada punto, por id. Sale de consolidar(), que devuelve los puntos
 * de cada habitación en el mismo orden en que están en el estado.
 */
export function indicesPorPunto(estado: EstadoPlano): Map<string, number> {
  const indices = new Map<string, number>()
  for (const m of resultadoDelPlano(estado).mediciones) {
    if (m.habitacion_id === undefined) continue
    const propios = puntosDe(estado, m.habitacion_id)
    m.puntos?.forEach((q, i) => {
      if (i < propios.length && q.indice !== undefined) indices.set(propios[i].id, q.indice)
    })
  }
  return indices
}

/**
 * Reconstruye el estado desde una Sesion que trae plano (un mock, o la sesión que
 * ya se envió). null si no trae plano. Los ids de punto se regeneran porque no
 * viajan en el contrato, y el índice se descarta porque se recalcula al consolidar.
 */
export function estadoDesdeSesion(sesion: {
  plano?: Plano
  mediciones: Medicion[]
}): EstadoPlano | null {
  const { plano } = sesion
  if (plano === undefined) return null

  const numero = (id: string) => Number(/^[hp](\d+)$/.exec(id)?.[1] ?? 0)
  let siguiente = Math.max(0, ...plano.habitaciones.map((h) => numero(h.id))) + 1
  const puntos: PuntoPlano[] = []

  for (const m of sesion.mediciones) {
    for (const q of m.puntos ?? []) {
      const h = plano.habitaciones.find((x) => x.id === (q.habitacion_id ?? m.habitacion_id))
      // Un punto sin habitación en el plano no tiene dónde dibujarse.
      if (h === undefined) continue
      const c = centro(h)
      const copia: Partial<Punto> = { ...q }
      delete copia.indice
      puntos.push({
        ...(copia as Punto),
        id: `p${siguiente++}`,
        habitacion_id: h.id,
        x: q.x ?? c.x,
        y: q.y ?? c.y,
      })
    }
  }

  return { plano, puntos, siguiente }
}

/* ───────────────────────── reducer ───────────────────────── */

export function reducirPlano(estado: EstadoPlano, accion: Accion): EstadoPlano {
  switch (accion.tipo) {
    case 'agregar_piso':
      return agregarPiso(estado)
    case 'agregar_habitacion':
      return crearHabitacion(estado, accion.piso, accion.nombre, accion.junto_a)?.estado ?? estado
    case 'mover_habitacion':
      return moverHabitacion(estado, accion.id, accion.x, accion.y)
    case 'redimensionar_habitacion':
      return redimensionarHabitacion(estado, accion.id, accion.ancho, accion.alto)
    case 'renombrar_habitacion':
      return renombrarHabitacion(estado, accion.id, accion.nombre)
    case 'borrar_habitacion':
      return borrarHabitacion(estado, accion.id)
    case 'ubicar_router':
      return ubicarRouter(estado, accion.habitacion_id, accion.x, accion.y)
    case 'agregar_punto':
      return agregarPunto(estado, accion.destino, accion.punto, accion.junto_al_router === true)
    case 'mover_punto':
      return moverPunto(estado, accion.id, accion.x, accion.y)
    case 'reemplazar_punto':
      return reemplazarPunto(estado, accion.id, accion.punto)
    case 'borrar_punto':
      return puedeBorrarPunto(estado, accion.id)
        ? { ...estado, puntos: estado.puntos.filter((p) => p.id !== accion.id) }
        : estado
    case 'declarar_senal':
      return declararSenal(estado, accion.id, accion.senal)
  }
}

function conPlano(estado: EstadoPlano, cambios: Partial<Plano>): EstadoPlano {
  return { ...estado, plano: { ...estado.plano, ...cambios } }
}

function agregarPiso(estado: EstadoPlano): EstadoPlano {
  const { pisos } = estado.plano
  if (pisos.length >= PISO_MAXIMO) return estado
  const numero = Math.max(...pisos.map((p) => p.numero)) + 1
  return conPlano(estado, { pisos: [...pisos, pisoNuevo(numero)] })
}

function nombreDisponible(
  estado: EstadoPlano,
  piso: number,
  nombre: string,
  excepto?: string,
): boolean {
  const otra = buscarHabitacion(estado, piso, nombre)
  return otra === null || otra.id === excepto
}

/** Crea la habitación en el esquema automático, o null si no se puede. */
function crearHabitacion(
  estado: EstadoPlano,
  piso: number,
  nombre: string,
  juntoA?: string,
): { estado: EstadoPlano; habitacion: Habitacion } | null {
  const limpio = limpiar(nombre)
  if (limpio.length < 2) return null
  if (!estado.plano.pisos.some((p) => p.numero === piso)) return null
  if (!nombreDisponible(estado, piso, limpio)) return null

  const vecinas = habitacionesDelPiso(estado, piso)
  const ancla = juntoA === undefined ? null : (vecinas.find((h) => h.id === juntoA) ?? null)
  const { x, y } = posicionLibre(vecinas, LADO_INICIAL, LADO_INICIAL, ancla)
  const habitacion: Habitacion = {
    id: `h${estado.siguiente}`,
    piso,
    nombre: limpio,
    x,
    y,
    ancho: LADO_INICIAL,
    alto: LADO_INICIAL,
  }

  return {
    habitacion,
    estado: {
      ...conPlano(estado, { habitaciones: [...estado.plano.habitaciones, habitacion] }),
      siguiente: estado.siguiente + 1,
    },
  }
}

function chocaConOtra(estado: EstadoPlano, h: Habitacion): boolean {
  return habitacionesDelPiso(estado, h.piso).some((o) => o.id !== h.id && sePisan(o, h))
}

/**
 * Cambia la geometría de una habitación y reubica lo que tiene adentro (router
 * y puntos). Cualquier cambio de geometría hecho por el usuario marca la
 * disposición como suya.
 */
function reemplazarHabitacion(
  estado: EstadoPlano,
  h: Habitacion,
  reubicar: (x: number, y: number) => Posicion,
): EstadoPlano {
  const mover = (x: number, y: number): Posicion => {
    const p = reubicar(x, y)
    const dentro = llevarAdentro(h, p.x, p.y, MARGEN_PUNTO)
    return { x: redondear(dentro.x), y: redondear(dentro.y) }
  }
  const { router } = estado.plano

  return {
    ...estado,
    plano: {
      ...estado.plano,
      habitaciones: estado.plano.habitaciones.map((o) => (o.id === h.id ? h : o)),
      router:
        router !== null && router.habitacion_id === h.id
          ? { ...router, ...mover(router.x, router.y) }
          : router,
      disposicion: 'usuario',
    },
    puntos: estado.puntos.map((p) => (p.habitacion_id === h.id ? { ...p, ...mover(p.x, p.y) } : p)),
  }
}

function moverHabitacion(estado: EstadoPlano, id: string, x: number, y: number): EstadoPlano {
  const h = habitacionPorId(estado, id)
  if (h === null) return estado

  const nx = acotar(ajustarAGrilla(x), 0, COORDENADA_MAXIMA)
  const ny = acotar(ajustarAGrilla(y), 0, COORDENADA_MAXIMA)
  if (nx === h.x && ny === h.y) return estado

  const destino = { ...h, x: nx, y: ny }
  if (chocaConOtra(estado, destino)) return estado

  const dx = nx - h.x
  const dy = ny - h.y
  return reemplazarHabitacion(estado, destino, (px, py) => ({ x: px + dx, y: py + dy }))
}

function redimensionarHabitacion(
  estado: EstadoPlano,
  id: string,
  ancho: number,
  alto: number,
): EstadoPlano {
  const h = habitacionPorId(estado, id)
  if (h === null) return estado

  const na = acotar(ajustarAGrilla(ancho), LADO_MINIMO, LADO_MAXIMO)
  const nal = acotar(ajustarAGrilla(alto), LADO_MINIMO, LADO_MAXIMO)
  if (na === h.ancho && nal === h.alto) return estado

  const destino = { ...h, ancho: na, alto: nal }
  if (chocaConOtra(estado, destino)) return estado

  // Los puntos que quedan fuera al achicar se llevan al borde, no se borran.
  return reemplazarHabitacion(estado, destino, (px, py) => ({ x: px, y: py }))
}

function renombrarHabitacion(estado: EstadoPlano, id: string, nombre: string): EstadoPlano {
  const h = habitacionPorId(estado, id)
  const limpio = limpiar(nombre)
  if (h === null || limpio.length < 2 || limpio === h.nombre) return estado
  if (!nombreDisponible(estado, h.piso, limpio, h.id)) return estado

  return conPlano(estado, {
    habitaciones: estado.plano.habitaciones.map((o) => (o.id === id ? { ...o, nombre: limpio } : o)),
  })
}

function borrarHabitacion(estado: EstadoPlano, id: string): EstadoPlano {
  if (!puedeBorrarHabitacion(estado, id)) return estado
  const { router } = estado.plano

  return {
    ...estado,
    plano: {
      ...estado.plano,
      habitaciones: estado.plano.habitaciones.filter((h) => h.id !== id),
      router: router?.habitacion_id === id ? null : router,
    },
    puntos: estado.puntos.filter((p) => p.habitacion_id !== id),
  }
}

function ubicarRouter(
  estado: EstadoPlano,
  habitacionId: string,
  x?: number,
  y?: number,
): EstadoPlano {
  const h = habitacionPorId(estado, habitacionId)
  if (h === null || !puedeUbicarRouterEn(estado, habitacionId)) return estado

  const c = centro(h)
  const pos = llevarAdentro(h, x ?? c.x, y ?? c.y, MARGEN_PUNTO)
  return conPlano(estado, {
    router: { piso: h.piso, habitacion_id: h.id, x: redondear(pos.x), y: redondear(pos.y) },
  })
}

/**
 * Dónde cae un punto cuando nadie tocó el plano: sobre el ancla (el centro, o el
 * router en su habitación) y en espiral a partir de ahí, para que varios puntos
 * del mismo cuarto no queden encimados. Es solo para dibujar: la posición de un
 * punto automático no dice nada de dónde estaba parado el usuario.
 */
function posicionAutomatica(h: Habitacion, orden: number, ancla: Posicion): Posicion {
  const radio = Math.min(PASO_ESPIRAL * Math.sqrt(orden), Math.min(h.ancho, h.alto) / 2)
  const angulo = orden * ANGULO_AUREO
  return llevarAdentro(
    h,
    ancla.x + radio * Math.cos(angulo),
    ancla.y + radio * Math.sin(angulo),
    MARGEN_PUNTO,
  )
}

function agregarPunto(
  estado: EstadoPlano,
  destino: DestinoPunto,
  punto: Punto,
  juntoAlRouter: boolean,
): EstadoPlano {
  let actual = estado
  let h: Habitacion | null

  if ('habitacion_id' in destino) {
    h = habitacionPorId(actual, destino.habitacion_id)
  } else {
    h = buscarHabitacion(actual, destino.piso, destino.nombre)
    if (h === null) {
      const creada = crearHabitacion(actual, destino.piso, destino.nombre)
      if (creada === null) return estado
      actual = creada.estado
      h = creada.habitacion
    }
  }
  if (h === null) return estado

  // La referencia fija el router en esta habitación, si todavía se puede mover.
  // Si ya hay otra referencia medida, el punto entra como uno más.
  if (juntoAlRouter && actual.plano.router?.habitacion_id !== h.id) {
    actual = ubicarRouter(actual, h.id)
  }

  let pos: Posicion
  if ('habitacion_id' in destino && destino.x !== undefined && destino.y !== undefined) {
    pos = llevarAdentro(h, destino.x, destino.y, MARGEN_PUNTO)
  } else {
    const { router } = actual.plano
    const yaTiene = puntosDe(actual, h.id).length
    pos =
      router !== null && router.habitacion_id === h.id
        ? posicionAutomatica(h, yaTiene + 1, router) // el orden 0 es el router mismo
        : posicionAutomatica(h, yaTiene, centro(h))
  }

  const nuevo: PuntoPlano = {
    ...punto,
    id: `p${actual.siguiente}`,
    habitacion_id: h.id,
    x: redondear(pos.x),
    y: redondear(pos.y),
  }
  if (nuevo.senal_declarada !== undefined && !senalValida(nuevo.senal_declarada)) {
    delete nuevo.senal_declarada
  }

  return { ...actual, puntos: [...actual.puntos, nuevo], siguiente: actual.siguiente + 1 }
}

/** Conserva id, habitación, posición y orden: repetir no cambia qué punto es. */
function reemplazarPunto(estado: EstadoPlano, id: string, punto: Punto): EstadoPlano {
  const p = estado.puntos.find((q) => q.id === id)
  if (p === undefined) return estado

  const nuevo: PuntoPlano = { ...punto, id: p.id, habitacion_id: p.habitacion_id, x: p.x, y: p.y }
  delete nuevo.indice
  if (nuevo.senal_declarada !== undefined && !senalValida(nuevo.senal_declarada)) {
    delete nuevo.senal_declarada
  }
  return { ...estado, puntos: estado.puntos.map((q) => (q.id === id ? nuevo : q)) }
}

function moverPunto(estado: EstadoPlano, id: string, x: number, y: number): EstadoPlano {
  const p = estado.puntos.find((q) => q.id === id)
  if (p === undefined) return estado
  const origen = habitacionPorId(estado, p.habitacion_id)
  if (origen === null) return estado

  // Arrastrado a otro cuarto del mismo piso: cambia de habitación, salvo que
  // deje a la referencia sin puntos. Soltado fuera de todo: queda en el suyo.
  const debajo = habitacionEn(estado, origen.piso, x, y)
  const destino =
    debajo !== null && debajo.id !== origen.id && !esUltimoDeLaReferencia(estado, p)
      ? debajo
      : origen

  const pos = llevarAdentro(destino, x, y, MARGEN_PUNTO)
  const movido = { ...p, habitacion_id: destino.id, x: redondear(pos.x), y: redondear(pos.y) }
  if (movido.habitacion_id === p.habitacion_id && movido.x === p.x && movido.y === p.y) {
    return estado
  }
  return { ...estado, puntos: estado.puntos.map((q) => (q.id === id ? movido : q)) }
}

function declararSenal(
  estado: EstadoPlano,
  id: string,
  senal: SenalDeclarada | null,
): EstadoPlano {
  const p = estado.puntos.find((q) => q.id === id)
  if (p === undefined) return estado
  if (senal !== null && !senalValida(senal)) return estado

  const copia: PuntoPlano = { ...p }
  if (senal === null) delete copia.senal_declarada
  else copia.senal_declarada = { barras: senal.barras, maximo: senal.maximo }

  return { ...estado, puntos: estado.puntos.map((q) => (q.id === id ? copia : q)) }
}
