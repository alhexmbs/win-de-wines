/**
 * analisis.ts — F6: zonas débiles, puntos muertos, dónde poner el repetidor y
 * si conviene mesh. Puro, sin DOM: se prueba desde Node.
 *
 * A propósito NO toca reglas.ts: esto trabaja sobre el índice (0-100 vs. el
 * router) y las coordenadas del Plano, que reglas.ts nunca usa. reglas.ts
 * sigue decidiendo "problema con el proveedor" solo con el % del plan
 * contratado — son dos preguntas distintas y no hace falta cruzarlas.
 */
import type { Habitacion } from '../contrato.ts'
import {
  type EstadoPlano,
  habitacionesDelPiso,
  indicesPorPunto,
  puntosDe,
} from '../plano/estado.ts'
import { centro } from '../plano/geometria.ts'
import { nivelDeIndice } from '../medicion/senal.ts'

export interface ZonaDebil {
  piso: number
  cuartos: string[]
  centro: { x: number; y: number }
  /** true = algún cuarto de la zona no tiene señal (índice 0). */
  puntoMuerto: boolean
}

export interface SugerenciaRepetidor {
  piso: number
  /** Habitación real más cercana al punto sugerido, para decir "cerca de X". */
  cercaDe: string
  x: number
  y: number
}

export interface AnalisisCobertura {
  zonas: ZonaDebil[]
  necesitaMesh: boolean
  sugerenciaRepetidor: SugerenciaRepetidor | null
}

/** Cuánto puede separar a dos habitaciones (borde a borde) para contarlas en la misma zona. */
const DISTANCIA_ADYACENCIA = 1.5

function indicePromedioDeHabitacion(
  estado: EstadoPlano,
  indices: Map<string, number>,
  h: Habitacion,
): number | null {
  const valores = puntosDe(estado, h.id)
    .map((p) => indices.get(p.id))
    .filter((v): v is number => v !== undefined)
  if (valores.length === 0) return null
  return valores.reduce((a, b) => a + b, 0) / valores.length
}

/** Distancia entre los bordes más cercanos de dos rectángulos. 0 si se tocan o se pisan. */
function distanciaEntreBordes(a: Habitacion, b: Habitacion): number {
  const dx = Math.max(a.x - (b.x + b.ancho), b.x - (a.x + a.ancho), 0)
  const dy = Math.max(a.y - (b.y + b.alto), b.y - (a.y + a.alto), 0)
  return Math.hypot(dx, dy)
}

interface HabitacionDebil {
  h: Habitacion
  indice: number
}

/** Agrupa habitaciones débiles del mismo piso que están cerca entre sí. */
function agruparEnZonas(debiles: HabitacionDebil[]): ZonaDebil[] {
  const zonas: ZonaDebil[] = []
  const visitado = new Set<string>()

  for (const inicial of debiles) {
    if (visitado.has(inicial.h.id)) continue
    const grupo = [inicial]
    visitado.add(inicial.h.id)

    let siguioCreciendo = true
    while (siguioCreciendo) {
      siguioCreciendo = false
      for (const candidata of debiles) {
        if (visitado.has(candidata.h.id)) continue
        const pertenece = grupo.some(
          (g) => g.h.piso === candidata.h.piso && distanciaEntreBordes(g.h, candidata.h) <= DISTANCIA_ADYACENCIA,
        )
        if (pertenece) {
          grupo.push(candidata)
          visitado.add(candidata.h.id)
          siguioCreciendo = true
        }
      }
    }

    const centros = grupo.map((g) => centro(g.h))
    zonas.push({
      piso: grupo[0].h.piso,
      cuartos: grupo.map((g) => g.h.nombre),
      centro: {
        x: centros.reduce((a, c) => a + c.x, 0) / centros.length,
        y: centros.reduce((a, c) => a + c.y, 0) / centros.length,
      },
      puntoMuerto: grupo.some((g) => g.indice === 0),
    })
  }

  return zonas
}

/** El punto medio entre el router y la zona, y qué habitación real queda más cerca de ahí. */
function sugerirRepetidor(estado: EstadoPlano, zona: ZonaDebil): SugerenciaRepetidor | null {
  const { router } = estado.plano
  const habitacionRouter =
    router !== null ? (habitacionesDelPiso(estado, router.piso).find((h) => h.id === router.habitacion_id) ?? null) : null

  const origen = habitacionRouter !== null ? centro(habitacionRouter) : zona.centro
  const mx = (origen.x + zona.centro.x) / 2
  const my = (origen.y + zona.centro.y) / 2

  const candidatas = habitacionesDelPiso(estado, zona.piso)
  let mejor: Habitacion | null = null
  let mejorDistancia = Infinity
  for (const h of candidatas) {
    const c = centro(h)
    const d = Math.hypot(c.x - mx, c.y - my)
    if (d < mejorDistancia) {
      mejorDistancia = d
      mejor = h
    }
  }
  if (mejor === null) return null

  return { piso: zona.piso, cercaDe: mejor.nombre, x: mx, y: my }
}

export function analizarCobertura(estado: EstadoPlano): AnalisisCobertura {
  const indices = indicesPorPunto(estado)
  const debiles: HabitacionDebil[] = []

  for (const piso of estado.plano.pisos) {
    for (const h of habitacionesDelPiso(estado, piso.numero)) {
      const indice = indicePromedioDeHabitacion(estado, indices, h)
      if (indice !== null && nivelDeIndice(indice) !== 'fuerte') debiles.push({ h, indice })
    }
  }

  const zonas = agruparEnZonas(debiles)

  // Mesh en vez de un solo repetidor: zonas en más de un piso, o varias zonas
  // separadas en el mismo piso -- un repetidor no cubre dos huecos a la vez.
  const pisosConZona = new Set(zonas.map((z) => z.piso)).size
  const necesitaMesh = pisosConZona >= 2 || zonas.length >= 2

  const peorZona = [...zonas].sort((a, b) => Number(b.puntoMuerto) - Number(a.puntoMuerto))[0] ?? null
  const sugerenciaRepetidor = peorZona === null ? null : sugerirRepetidor(estado, peorZona)

  return { zonas, necesitaMesh, sugerenciaRepetidor }
}
