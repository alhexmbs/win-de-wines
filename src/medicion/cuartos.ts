/**
 * Nombres de cuarto. Lista fija + "otro" a propósito: si cada usuario escribe
 * lo que quiere, el reporte de B y el mapa del día 2 quedan con etiquetas
 * inconsistentes ("cuarto", "mi pieza", "dorm 1") y no se pueden comparar.
 */

export const CUARTOS_SUGERIDOS = [
  'Sala',
  'Comedor',
  'Cocina',
  'Dormitorio 1',
  'Dormitorio 2',
  'Dormitorio 3',
  'Baño',
  'Estudio',
  'Terraza',
  'Patio',
  'Garaje',
  'Pasillo',
]

/** Los mocks de sesión usan este sufijo. B lo muestra tal cual en el reporte. */
export const SUFIJO_REFERENCIA = ' (junto al router)'

export function nombreDeReferencia(cuarto: string): string {
  return `${limpiar(cuarto)}${SUFIJO_REFERENCIA}`
}

export function limpiar(nombre: string): string {
  return nombre.trim().replace(/\s+/g, ' ').slice(0, 40)
}

export function esValido(nombre: string): boolean {
  return limpiar(nombre).length >= 2
}

/** Para no medir dos veces el mismo cuarto sin darse cuenta. */
export function yaExiste(nombre: string, usados: string[]): boolean {
  const n = limpiar(nombre).toLowerCase()
  return usados.some((u) => u.toLowerCase() === n)
}

/** Sugiere el siguiente cuarto no usado, para que el selector arranque útil. */
export function siguienteSugerido(usados: string[]): string {
  return CUARTOS_SUGERIDOS.find((c) => !yaExiste(c, usados)) ?? ''
}
