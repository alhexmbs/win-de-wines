import { useState } from 'react'
import { Boton } from '../../ui/Boton'
import { IconoMas } from '../../ui/Iconos'
import {
  type Accion,
  type EstadoPlano,
  buscarHabitacion,
  habitacionPorId,
  habitacionesDelPiso,
} from '../estado'
import { AgregarHabitacion } from './AgregarHabitacion'
import { PanelHabitacion } from './PanelHabitacion'

/**
 * Acomodar el esquema: agregar habitaciones o editar la seleccionada. Lo usan el
 * lab del editor y la caminata sobre plano en «Acomodar habitaciones».
 */
export function PanelEsquema({
  estado,
  piso,
  habitacionId,
  onSeleccionarHabitacion,
  onAccion,
}: {
  estado: EstadoPlano
  piso: number
  habitacionId: string | null
  onSeleccionarHabitacion: (id: string | null) => void
  onAccion: (accion: Accion) => EstadoPlano | null
}) {
  /*
   * «Agregando» recuerda desde qué selección y qué piso empezó: si el usuario
   * toca otra habitación o cambia de piso, se cancela solo, sin un efecto.
   */
  const [agregando, setAgregando] = useState<{
    juntoA: string | null
    desde: string | null
    piso: number
  } | null>(null)
  const activo =
    agregando !== null && agregando.desde === habitacionId && agregando.piso === piso ? agregando : null
  const habitacion = habitacionId === null ? null : habitacionPorId(estado, habitacionId)

  function agregar(nombre: string) {
    const nuevo = onAccion({
      tipo: 'agregar_habitacion',
      piso,
      nombre,
      junto_a: activo?.juntoA ?? undefined,
    })
    const creada = nuevo === null ? null : buscarHabitacion(nuevo, piso, nombre)
    setAgregando(null)
    onSeleccionarHabitacion(creada?.id ?? null)
  }

  if (activo !== null) {
    return (
      <AgregarHabitacion
        piso={piso}
        ocupados={habitacionesDelPiso(estado, piso).map((h) => h.nombre)}
        alLadoDe={
          activo.juntoA === null ? null : (habitacionPorId(estado, activo.juntoA)?.nombre ?? null)
        }
        onAgregar={agregar}
        onCancelar={() => setAgregando(null)}
      />
    )
  }

  if (habitacion !== null && habitacion.piso === piso) {
    return (
      <PanelHabitacion
        key={habitacion.id}
        estado={estado}
        habitacion={habitacion}
        onAccion={onAccion}
        onAgregarAlLado={() => setAgregando({ juntoA: habitacion.id, desde: habitacion.id, piso })}
        onCerrar={() => onSeleccionarHabitacion(null)}
      />
    )
  }

  return (
    <>
      <Boton
        variante="secundario"
        onClick={() => setAgregando({ juntoA: null, desde: habitacionId, piso })}
      >
        <IconoMas className="h-5 w-5" />
        Agregar habitación
      </Boton>
      <p className="mt-2 text-sm leading-relaxed text-gray-500">
        Toca una habitación para cambiarle el nombre, moverla, cambiar su tamaño o marcar el router.
      </p>
    </>
  )
}
