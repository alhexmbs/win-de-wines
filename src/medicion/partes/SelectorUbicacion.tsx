import { useState } from 'react'
import { CUARTOS_SUGERIDOS, limpiar } from '../cuartos'
import { PISOS } from '../caminata'

/**
 * Piso + habitación. A diferencia del selector del día 1, aquí SÍ se puede
 * volver a un cuarto ya medido: cada pulsación de «Tomar punto» agrega otro
 * punto a esa habitación, que es justamente lo que la hace más precisa.
 */
export function SelectorUbicacion({
  piso,
  cuarto,
  puntosPorCuarto,
  onCambiarPiso,
  onCambiarCuarto,
}: {
  piso: number
  cuarto: string
  /** clave `piso|cuarto` → cuántos puntos lleva, para marcarlo en el chip. */
  puntosPorCuarto: Record<string, number>
  onCambiarPiso: (piso: number) => void
  onCambiarCuarto: (cuarto: string) => void
}) {
  const [escribiendo, setEscribiendo] = useState(false)

  const propios = Object.keys(puntosPorCuarto)
    .filter((k) => k.startsWith(`${piso}|`))
    .map((k) => k.slice(k.indexOf('|') + 1))

  // Los cuartos que el usuario escribió a mano tienen que seguir apareciendo.
  const lista = [
    ...CUARTOS_SUGERIDOS,
    ...propios
      .filter((c) => !CUARTOS_SUGERIDOS.some((s) => s.toLowerCase() === c))
      .map((c) => c.charAt(0).toUpperCase() + c.slice(1)),
  ]

  const esDeLaLista = lista.some((c) => c === cuarto)

  return (
    <div>
      <div className="mb-3 flex gap-2">
        {PISOS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onCambiarPiso(n)}
            className={`flex-1 rounded-xl border-2 py-2 text-sm font-bold transition active:scale-[0.97] ${
              piso === n
                ? 'border-win-700 bg-win-700 text-white'
                : 'border-win-200 bg-white text-win-700'
            }`}
          >
            Piso {n}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {lista.map((nombre) => {
          const n = puntosPorCuarto[`${piso}|${nombre.toLowerCase()}`] ?? 0
          return (
            <button
              key={nombre}
              type="button"
              onClick={() => {
                setEscribiendo(false)
                onCambiarCuarto(nombre)
              }}
              className={`rounded-full border-2 px-4 py-2 text-sm font-semibold transition active:scale-[0.97] ${
                cuarto === nombre
                  ? 'border-win-700 bg-win-700 text-white'
                  : 'border-win-200 bg-white text-win-700'
              }`}
            >
              {nombre}
              {n > 0 && (
                <span className={cuarto === nombre ? 'text-win-100' : 'text-gray-400'}>
                  {' '}
                  · {n}
                </span>
              )}
            </button>
          )
        })}

        <button
          type="button"
          onClick={() => {
            setEscribiendo(true)
            if (esDeLaLista) onCambiarCuarto('')
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
          value={esDeLaLista ? '' : cuarto}
          onChange={(e) => onCambiarCuarto(limpiar(e.target.value))}
          placeholder="¿Cómo le dices a este cuarto?"
          maxLength={40}
          className="mt-3 w-full rounded-2xl border-2 border-win-200 bg-white px-4 py-3 text-win-900 outline-none focus:border-win-500"
        />
      )}
    </div>
  )
}
