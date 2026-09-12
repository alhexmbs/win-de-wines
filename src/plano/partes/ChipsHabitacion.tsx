import { type ReactNode, useState } from 'react'
import type { Habitacion } from '../../contrato'
import { CUARTOS_SUGERIDOS, limpiar, yaExiste } from '../../medicion/cuartos'

/**
 * «¿Dónde estás?» sin tocar el plano. Primero las habitaciones que ya están en
 * este piso (con cuántos puntos llevan), después las sugeridas y «Otro…». Una
 * que todavía no existe se crea sola en el esquema al guardar el punto.
 */
export function ChipsHabitacion({
  habitaciones,
  puntosPorHabitacion,
  elegida,
  nombreNuevo,
  onElegirHabitacion,
  onElegirNombre,
}: {
  /** Las habitaciones del piso actual. */
  habitaciones: Habitacion[]
  /** id → cuántos puntos tiene. */
  puntosPorHabitacion: Record<string, number>
  /** id de la habitación elegida, si es una que ya existe. */
  elegida: string | null
  /** Nombre elegido o escrito que todavía no es una habitación. */
  nombreNuevo: string
  onElegirHabitacion: (id: string) => void
  onElegirNombre: (nombre: string) => void
}) {
  const [escribiendo, setEscribiendo] = useState(false)
  const sugeridas = CUARTOS_SUGERIDOS.filter(
    (c) =>
      !yaExiste(
        c,
        habitaciones.map((h) => h.nombre),
      ),
  )
  const buscado = limpiar(nombreNuevo).toLowerCase()

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {habitaciones.map((h) => {
          const activo = h.id === elegida
          const n = puntosPorHabitacion[h.id] ?? 0
          return (
            <Chip
              key={h.id}
              activo={activo}
              onClick={() => {
                setEscribiendo(false)
                onElegirHabitacion(h.id)
              }}
            >
              {h.nombre}
              {n > 0 && <span className={activo ? 'text-win-100' : 'text-gray-400'}> · {n}</span>}
            </Chip>
          )
        })}

        {sugeridas.map((c) => (
          <Chip
            key={c}
            activo={elegida === null && !escribiendo && c.toLowerCase() === buscado}
            onClick={() => {
              setEscribiendo(false)
              onElegirNombre(c)
            }}
          >
            {c}
          </Chip>
        ))}

        <button
          type="button"
          onClick={() => {
            setEscribiendo(true)
            onElegirNombre('')
          }}
          className={`rounded-full border-2 border-dashed px-4 py-2 text-sm font-semibold transition active:scale-[0.97] ${
            escribiendo ? 'border-win-700 text-win-700' : 'border-win-200 text-gray-500'
          }`}
        >
          Otro…
        </button>
      </div>

      {escribiendo && (
        <input
          autoFocus
          type="text"
          value={nombreNuevo}
          onChange={(e) => onElegirNombre(e.target.value)}
          placeholder="¿Cómo le dices a este cuarto?"
          maxLength={40}
          aria-label="Nombre del cuarto donde estás"
          className="mt-3 w-full rounded-2xl border-2 border-win-200 bg-white px-4 py-3 text-win-900 outline-none focus:border-win-500"
        />
      )}
    </div>
  )
}

function Chip({
  activo,
  onClick,
  children,
}: {
  activo: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={`rounded-full border-2 px-4 py-2 text-sm font-semibold transition active:scale-[0.97] ${
        activo ? 'border-win-700 bg-win-700 text-white' : 'border-win-200 bg-white text-win-700'
      }`}
    >
      {children}
    </button>
  )
}
