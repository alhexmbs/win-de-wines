import { useState } from 'react'
import { CUARTOS_SUGERIDOS, esValido, limpiar, yaExiste } from '../../medicion/cuartos'

/**
 * Elegir el nombre de una habitación nueva. No se dibuja nada: la habitación
 * aparece sola en el esquema y, si el usuario quiere, la acomoda después.
 */
export function AgregarHabitacion({
  piso,
  ocupados,
  alLadoDe,
  onAgregar,
  onCancelar,
}: {
  piso: number
  /** Nombres que ya existen en este piso: no se ofrecen otra vez. */
  ocupados: string[]
  /** Nombre de la habitación junto a la que va a quedar, si hay una. */
  alLadoDe: string | null
  onAgregar: (nombre: string) => void
  onCancelar: () => void
}) {
  const [otro, setOtro] = useState('')
  const libres = CUARTOS_SUGERIDOS.filter((c) => !yaExiste(c, ocupados))
  const repetido = esValido(otro) && yaExiste(otro, ocupados)
  const puedeAgregarOtro = esValido(otro) && !repetido

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-win-200/40">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold text-win-900">
          {alLadoDe === null ? `Agregar habitación al piso ${piso}` : `Agregar al lado de ${alLadoDe}`}
        </p>
        <button
          type="button"
          onClick={onCancelar}
          className="shrink-0 text-sm font-semibold text-win-700 underline underline-offset-4"
        >
          Cancelar
        </button>
      </div>
      <p className="mt-1 text-sm text-gray-600">
        Aparece sola en el esquema. Después, si quieres, la acomodas.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {libres.map((nombre) => (
          <button
            key={nombre}
            type="button"
            onClick={() => onAgregar(nombre)}
            className="rounded-full border-2 border-win-200 bg-white px-4 py-2 text-sm font-semibold text-win-700 transition active:scale-[0.97] hover:border-win-500"
          >
            {nombre}
          </button>
        ))}
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (puedeAgregarOtro) onAgregar(limpiar(otro))
        }}
      >
        <input
          type="text"
          value={otro}
          onChange={(e) => setOtro(e.target.value)}
          maxLength={40}
          placeholder="Otro nombre…"
          aria-label="Nombre de otra habitación"
          className="min-w-0 flex-1 rounded-xl border-2 border-win-200 bg-white px-3 py-2 text-win-900 outline-none focus:border-win-500"
        />
        <button
          type="submit"
          disabled={!puedeAgregarOtro}
          className="shrink-0 rounded-xl bg-win-700 px-4 py-2 text-sm font-semibold text-white transition active:scale-[0.97] disabled:opacity-50"
        >
          Agregar
        </button>
      </form>
      {repetido && (
        <p className="mt-2 text-sm text-malo">Ya hay una habitación con ese nombre en este piso.</p>
      )}
    </section>
  )
}
