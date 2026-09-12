/**
 * vista.ts — qué parte del esquema se ve (zoom y desplazamiento) y qué está
 * seleccionado en el editor. Puro, sin DOM.
 *
 * La vista es un rectángulo en metros y va directo al viewBox del SVG.
 */
import { COORDENADA_MAXIMA, type Rect, acotar } from './geometria.ts'

export type Seleccion = { tipo: 'habitacion'; id: string } | { tipo: 'punto'; id: string } | null

/** Dónde dijo el usuario que está parado: una habitación y un lugar dentro de ella. */
export interface Marca {
  habitacion_id: string
  x: number
  y: number
}

/** 'acomodar' = se editan las habitaciones; 'medir' = se marca dónde está uno y se corrigen puntos. */
export type ModoEditor = 'acomodar' | 'medir'

export type Vista = Rect

/** Lo más cerca que se puede acercar: 3 m de ancho ya es una habitación a pantalla completa. */
export const ANCHO_MINIMO = 3
export const ANCHO_MAXIMO = 80
/** Aire alrededor de las habitaciones al ajustar. */
const MARGEN = 1
/** Un piso vacío o con un solo cuarto no se ve gigante: al menos 8 m de ancho. */
const ANCHO_AJUSTE_MINIMO = 8
/** La misma proporción que el contenedor del editor, para que ajustar no deje franjas. */
const PROPORCION = 4 / 3
/** Tamaño de las etiquetas en pantalla, en px, sin importar el zoom. */
const TEXTO_PX = 13
/** Ancho medio de un carácter respecto del tamaño de fuente, para recortar nombres. */
const ANCHO_CARACTER = 0.56

export function vistaParaPiso(habitaciones: Rect[]): Vista {
  if (habitaciones.length === 0) {
    return {
      x: -MARGEN,
      y: -MARGEN,
      ancho: ANCHO_AJUSTE_MINIMO,
      alto: ANCHO_AJUSTE_MINIMO / PROPORCION,
    }
  }

  const x0 = Math.min(...habitaciones.map((h) => h.x)) - MARGEN
  const y0 = Math.min(...habitaciones.map((h) => h.y)) - MARGEN
  const x1 = Math.max(...habitaciones.map((h) => h.x + h.ancho)) + MARGEN
  const y1 = Math.max(...habitaciones.map((h) => h.y + h.alto)) + MARGEN

  // Lo que haga falta para que entre todo, en la proporción del contenedor.
  const ancho = acotar(
    Math.max(x1 - x0, (y1 - y0) * PROPORCION, ANCHO_AJUSTE_MINIMO),
    ANCHO_MINIMO,
    ANCHO_MAXIMO,
  )
  const alto = ancho / PROPORCION

  return { x: (x0 + x1) / 2 - ancho / 2, y: (y0 + y1) / 2 - alto / 2, ancho, alto }
}

/** factor > 1 acerca, < 1 aleja. Siempre sobre el centro de lo que se ve. */
export function acercar(v: Vista, factor: number): Vista {
  const ancho = acotar(v.ancho / factor, ANCHO_MINIMO, ANCHO_MAXIMO)
  const alto = v.alto * (ancho / v.ancho)
  const cx = v.x + v.ancho / 2
  const cy = v.y + v.alto / 2
  return { x: cx - ancho / 2, y: cy - alto / 2, ancho, alto }
}

/** Mueve la vista en metros, sin dejar que se pierda lejos de donde puede haber algo. */
export function desplazar(v: Vista, dx: number, dy: number): Vista {
  return {
    ...v,
    x: acotar(v.x + dx, -v.ancho, COORDENADA_MAXIMA),
    y: acotar(v.y + dy, -v.alto, COORDENADA_MAXIMA),
  }
}

/**
 * Tamaño de fuente en metros para que en pantalla mida TEXTO_PX. Con el SVG en
 * `meet`, la escala es la menor de las dos. Sin medidas todavía (primer render),
 * una aproximación por el ancho de la vista.
 */
export function tamanoTexto(v: Vista, anchoPx: number, altoPx: number): number {
  const pxPorMetro = Math.min(anchoPx / v.ancho, altoPx / v.alto)
  return pxPorMetro > 0 ? TEXTO_PX / pxPorMetro : v.ancho / 28
}

/** Recorta un nombre para que entre en `ancho` metros. '' si no entra ni una letra útil. */
export function recortarTexto(texto: string, ancho: number, tamano: number): string {
  const caben = Math.floor(ancho / (tamano * ANCHO_CARACTER))
  if (caben >= texto.length) return texto
  if (caben < 3) return ''
  return `${texto.slice(0, caben - 1)}…`
}
