import { useCallback, useRef, useState } from 'react'
import { type Accion, type EstadoPlano, reducirPlano } from './estado'

/**
 * El estado del plano para React. Como useReducer, pero `despachar` devuelve el
 * estado nuevo, o null si el reducer rechazó la acción. Así la pantalla puede
 * avisar («no hay lugar») o seleccionar lo que acaba de crear sin esperar otro
 * render.
 */
export function usePlano(inicial: () => EstadoPlano) {
  const [estado, setEstado] = useState(inicial)
  // Lo último aplicado: dos acciones en el mismo evento se encadenan bien, y un
  // arrastre que despacha en cada pointermove no lee un estado viejo.
  const ultimo = useRef(estado)

  const despachar = useCallback((accion: Accion): EstadoPlano | null => {
    const nuevo = reducirPlano(ultimo.current, accion)
    if (nuevo === ultimo.current) return null
    ultimo.current = nuevo
    setEstado(nuevo)
    return nuevo
  }, [])

  const reemplazar = useCallback((otro: EstadoPlano) => {
    ultimo.current = otro
    setEstado(otro)
  }, [])

  return { estado, despachar, reemplazar }
}
