/**
 * calor.ts — F5: interpolación del índice de cobertura sobre el plano. Puro,
 * sin DOM, sin React: se prueba desde Node.
 *
 * IDW (inverse distance weighting, potencia 2): cada celda del piso toma el
 * promedio de los puntos medidos, pesado por 1/distancia². Más lejos de
 * DISTANCIA_MAXIMA de cualquier punto real, la celda es gris ("sin medir") en
 * vez de inventar un color — interpolar ahí sería mostrar un dato que no
 * existe.
 */
import type { Rect } from '../plano/geometria.ts'

export interface PuntoCalor {
  x: number
  y: number
  indice: number
}

export interface Celda {
  x: number
  y: number
  lado: number
  /** null = fuera del alcance de cualquier punto medido: se pinta gris. */
  indice: number | null
}

export const LADO_CELDA = 0.4
export const DISTANCIA_MAXIMA = 2.5

function interpolar(puntos: PuntoCalor[], x: number, y: number, distanciaMaxima: number): number | null {
  let distanciaMinima = Infinity
  let sumaPeso = 0
  let sumaValor = 0

  for (const p of puntos) {
    const d2 = (p.x - x) ** 2 + (p.y - y) ** 2
    if (d2 < distanciaMinima) distanciaMinima = d2
    if (d2 < 1e-6) return p.indice // la celda cae justo sobre el punto medido
    const peso = 1 / d2
    sumaPeso += peso
    sumaValor += peso * p.indice
  }

  if (Math.sqrt(distanciaMinima) > distanciaMaxima) return null
  return sumaPeso > 0 ? sumaValor / sumaPeso : null
}

/** Rejilla de celdas cubriendo `area` (en metros, mismo sistema que el plano). */
export function celdasDeCalor(
  puntos: PuntoCalor[],
  area: Rect,
  ladoCelda: number = LADO_CELDA,
  distanciaMaxima: number = DISTANCIA_MAXIMA,
): Celda[] {
  if (puntos.length === 0 || area.ancho <= 0 || area.alto <= 0) return []

  const columnas = Math.max(1, Math.ceil(area.ancho / ladoCelda))
  const filas = Math.max(1, Math.ceil(area.alto / ladoCelda))
  const celdas: Celda[] = []

  for (let fila = 0; fila < filas; fila++) {
    for (let col = 0; col < columnas; col++) {
      const x = area.x + col * ladoCelda
      const y = area.y + fila * ladoCelda
      const cx = x + ladoCelda / 2
      const cy = y + ladoCelda / 2
      celdas.push({ x, y, lado: ladoCelda, indice: interpolar(puntos, cx, cy, distanciaMaxima) })
    }
  }

  return celdas
}

const GRIS: [number, number, number] = [0x9c, 0xa3, 0xaf] // gray-400: sin datos
const MALO: [number, number, number] = [0xb9, 0x1c, 0x1c]
const REGULAR: [number, number, number] = [0xa1, 0x60, 0x07]
const BUENO: [number, number, number] = [0x15, 0x80, 0x3d]

function mezclar(a: [number, number, number], b: [number, number, number], t: number): string {
  const canal = (i: number) => Math.round(a[i] + (b[i] - a[i]) * t)
  return `#${[canal(0), canal(1), canal(2)].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/** Mismos 3 colores que el resto de la app (bueno/regular/malo), en degradado continuo. */
export function colorDeIndice(indice: number | null): string {
  if (indice === null) return mezclar(GRIS, GRIS, 0)
  const v = Math.max(0, Math.min(100, indice))
  return v <= 50 ? mezclar(MALO, REGULAR, v / 50) : mezclar(REGULAR, BUENO, (v - 50) / 50)
}
