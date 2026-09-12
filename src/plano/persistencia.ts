/**
 * persistencia.ts — guarda la caminata sobre plano en localStorage.
 *
 * POR QUÉ: medir una casa toma varios minutos con el celular en la mano, y en
 * ese rato la pestaña se recarga (Safari iOS descarta las de fondo sin avisar)
 * o se cierra sin querer. Sin esto se pierde el recorrido entero.
 *
 * Queda solo en este navegador y se borra al terminar. Todo va en try/catch:
 * modo privado, cuota llena o storage bloqueado no pueden romper la caminata.
 */
import { type EstadoPlano, esEstadoPlano } from './estado.ts'

const CLAVE = 'wintest.recorrido.v1'
/** Un recorrido de hace más de medio día ya no describe el wifi de hoy. */
const VIGENCIA_MS = 12 * 60 * 60 * 1000

function almacen(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    // Safari con cookies bloqueadas lanza con solo nombrar localStorage.
    return null
  }
}

export function guardarRecorrido(estado: EstadoPlano, ahora: number = Date.now()): void {
  try {
    almacen()?.setItem(CLAVE, JSON.stringify({ guardado_en: ahora, estado }))
  } catch {
    // Cuota llena o modo privado: la caminata sigue, solo que sin respaldo.
  }
}

/** null = no hay recorrido, está vencido o no tiene la forma esperada. */
export function cargarRecorrido(ahora: number = Date.now()): EstadoPlano | null {
  try {
    const crudo = almacen()?.getItem(CLAVE)
    if (crudo === null || crudo === undefined) return null
    const leido = JSON.parse(crudo) as { guardado_en?: unknown; estado?: unknown }
    if (typeof leido.guardado_en !== 'number' || ahora - leido.guardado_en > VIGENCIA_MS) {
      return null
    }
    return esEstadoPlano(leido.estado) ? leido.estado : null
  } catch {
    return null
  }
}

export function borrarRecorrido(): void {
  try {
    almacen()?.removeItem(CLAVE)
  } catch {
    // Nada que hacer: si no se puede borrar, tampoco se pudo guardar.
  }
}
