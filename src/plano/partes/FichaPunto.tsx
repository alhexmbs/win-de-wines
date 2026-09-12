import { useState } from 'react'
import { Boton } from '../../ui/Boton'
import { IconoPapelera } from '../../ui/Iconos'
import {
  type Accion,
  type EstadoPlano,
  type PuntoPlano,
  habitacionPorId,
  puedeBorrarPunto,
  puntosDe,
} from '../estado'
import { DetallePunto } from './DetallePunto'
import { SelectorRayitas } from './SelectorRayitas'

/**
 * Un punto ya guardado, durante la caminata: lo medido, y qué se puede hacer
 * con él. Moverlo se hace arrastrándolo en el plano; aquí, repetir la medición
 * en el mismo lugar, corregir las rayitas o borrarlo. Montar con `key={punto.id}`.
 */
export function FichaPunto({
  estado,
  punto,
  indice,
  maximoRayitas,
  onCambiarMaximoRayitas,
  onAccion,
  onRepetir,
  onCerrar,
}: {
  estado: EstadoPlano
  punto: PuntoPlano
  indice: number | null
  maximoRayitas: number
  onCambiarMaximoRayitas: (maximo: number) => void
  onAccion: (accion: Accion) => EstadoPlano | null
  onRepetir: () => void
  onCerrar: () => void
}) {
  const [confirmando, setConfirmando] = useState(false)
  const habitacion = habitacionPorId(estado, punto.habitacion_id)
  if (habitacion === null) return null

  const numero = puntosDe(estado, habitacion.id).findIndex((p) => p.id === punto.id) + 1

  return (
    <DetallePunto
      punto={punto}
      habitacion={habitacion}
      numero={numero}
      indice={indice}
      onCerrar={onCerrar}
    >
      <p className="mt-3 text-sm text-gray-600">¿Quedó en otro lugar? Arrástralo en el plano.</p>

      <Boton variante="secundario" className="mt-3 py-3" onClick={onRepetir}>
        Repetir la medición aquí
      </Boton>
      <p className="mt-1 text-xs text-gray-500">
        Reemplaza las cifras de este punto; no suma uno nuevo.
      </p>

      <SelectorRayitas
        className="mt-4 border-t border-win-200/60 pt-4"
        valor={punto.senal_declarada ?? null}
        maximo={punto.senal_declarada?.maximo ?? maximoRayitas}
        onCambiar={(senal) => onAccion({ tipo: 'declarar_senal', id: punto.id, senal })}
        onCambiarMaximo={onCambiarMaximoRayitas}
      />

      {!puedeBorrarPunto(estado, punto.id) ? (
        <p className="mt-4 text-xs leading-relaxed text-gray-500">
          Es el único punto junto al router y toda la casa se compara contra él. Toma otro ahí
          antes de borrarlo.
        </p>
      ) : confirmando ? (
        <div className="mt-4 rounded-xl bg-malo-bg p-3">
          <p className="text-sm text-malo">¿Borrar este punto? Lo medido aquí se pierde.</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => onAccion({ tipo: 'borrar_punto', id: punto.id })}
              className="flex-1 rounded-xl bg-malo py-2 text-sm font-semibold text-white"
            >
              Sí, borrar
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="flex-1 rounded-xl bg-white py-2 text-sm font-semibold text-gray-700"
            >
              No
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="mt-4 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-malo transition hover:bg-malo-bg"
        >
          <IconoPapelera className="h-4 w-4" />
          Borrar punto
        </button>
      )}
    </DetallePunto>
  )
}
