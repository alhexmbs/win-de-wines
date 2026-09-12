/**
 * geometria.ts — rectángulos del esquema de la vivienda. Puro, sin DOM.
 *
 * Todo en metros, origen arriba a la izquierda del piso, `y` hacia abajo. El
 * esquema no es a escala: sirve para ubicar puntos y dibujar el mapa, no para
 * medir distancias exactas.
 */

export interface Rect {
  x: number
  y: number
  ancho: number
  alto: number
}

export interface Posicion {
  x: number
  y: number
}

/** Tamaño con el que nace una habitación en el esquema automático. */
export const LADO_INICIAL = 3
export const LADO_MINIMO = 1
export const LADO_MAXIMO = 30
/** Tope de cordura: evita que un arrastre mande una habitación al infinito. */
export const COORDENADA_MAXIMA = 60
/** Paso de la grilla al mover o cambiar de tamaño. */
export const PASO_GRILLA = 0.5
/** Columnas del esquema automático antes de pasar a la fila siguiente. */
const COLUMNAS_AUTO = 3
/** Tolerancia al comparar bordes: 0.1 + 0.2 no da exacto en coma flotante. */
const EPSILON = 1e-6

export function redondear(v: number, decimales = 2): number {
  const f = 10 ** decimales
  return Math.round(v * f) / f
}

/** NaN cae al mínimo: un arrastre que devuelve basura no puede romper el plano. */
export function acotar(v: number, min: number, max: number): number {
  if (Number.isNaN(v)) return min
  return Math.min(max, Math.max(min, v))
}

export function ajustarAGrilla(v: number): number {
  return Math.round(v / PASO_GRILLA) * PASO_GRILLA
}

export function centro(r: Rect): Posicion {
  return { x: r.x + r.ancho / 2, y: r.y + r.alto / 2 }
}

/** Bordes incluidos. */
export function contiene(r: Rect, x: number, y: number): boolean {
  return (
    x >= r.x - EPSILON &&
    x <= r.x + r.ancho + EPSILON &&
    y >= r.y - EPSILON &&
    y <= r.y + r.alto + EPSILON
  )
}

/** Lleva una posición al interior del rectángulo, a `margen` de los bordes. */
export function llevarAdentro(r: Rect, x: number, y: number, margen = 0): Posicion {
  const m = Math.min(margen, r.ancho / 2, r.alto / 2)
  return {
    x: acotar(x, r.x + m, r.x + r.ancho - m),
    y: acotar(y, r.y + m, r.y + r.alto - m),
  }
}

/** Se pisan si comparten área. Compartir solo un borde NO cuenta: así quedan pegadas. */
export function sePisan(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.ancho - EPSILON &&
    b.x < a.x + a.ancho - EPSILON &&
    a.y < b.y + b.alto - EPSILON &&
    b.y < a.y + a.alto - EPSILON
  )
}

/**
 * Dónde cae una habitación nueva sin que nadie la dibuje.
 *
 * Con `juntoA`: pegada a esa habitación (derecha, abajo, izquierda, arriba).
 * Sin ella, o si no hay hueco: grilla de 3 columnas, fila por fila. El esquema
 * no pretende ser la casa real; pretende que nada se pise y que se lea claro.
 */
export function posicionLibre(
  ocupadas: Rect[],
  ancho: number,
  alto: number,
  juntoA: Rect | null = null,
): Posicion {
  const libre = ({ x, y }: Posicion) =>
    x >= 0 && y >= 0 && !ocupadas.some((o) => sePisan(o, { x, y, ancho, alto }))

  if (juntoA !== null) {
    const pegadas: Posicion[] = [
      { x: juntoA.x + juntoA.ancho, y: juntoA.y },
      { x: juntoA.x, y: juntoA.y + juntoA.alto },
      { x: juntoA.x - ancho, y: juntoA.y },
      { x: juntoA.x, y: juntoA.y - alto },
    ]
    const hueco = pegadas.find(libre)
    if (hueco !== undefined) return hueco
  }

  const filas = Math.ceil(COORDENADA_MAXIMA / LADO_INICIAL)
  for (let fila = 0; fila < filas; fila++) {
    for (let col = 0; col < COLUMNAS_AUTO; col++) {
      const p = { x: col * LADO_INICIAL, y: fila * LADO_INICIAL }
      if (libre(p)) return p
    }
  }

  // Grilla llena hasta el tope de cordura: debajo de todo, aunque se pase.
  const fondo = Math.max(0, ...ocupadas.map((o) => o.y + o.alto))
  return { x: 0, y: fondo }
}
