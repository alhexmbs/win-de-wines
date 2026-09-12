import type { PisoPlano } from '../../contrato'
import { PISO_MAXIMO } from '../../medicion/caminata'
import { IconoMas } from '../../ui/Iconos'

/** Pestañas de piso + botón para sumar el siguiente. Mismo estilo que SelectorUbicacion. */
export function SelectorPiso({
  pisos,
  piso,
  habitacionesPorPiso,
  onCambiar,
  onAgregar,
}: {
  pisos: PisoPlano[]
  piso: number
  /** número de piso → cuántas habitaciones tiene, para marcarlo en la pestaña. */
  habitacionesPorPiso: Record<number, number>
  onCambiar: (piso: number) => void
  onAgregar: () => void
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {pisos.map((p) => {
        const activo = p.numero === piso
        const n = habitacionesPorPiso[p.numero] ?? 0
        return (
          <button
            key={p.numero}
            type="button"
            aria-pressed={activo}
            onClick={() => onCambiar(p.numero)}
            className={`min-w-[5.5rem] flex-1 shrink-0 rounded-xl border-2 px-3 py-2 text-sm font-bold whitespace-nowrap transition active:scale-[0.97] ${
              activo ? 'border-win-700 bg-win-700 text-white' : 'border-win-200 bg-white text-win-700'
            }`}
          >
            {p.nombre}
            {n > 0 && <span className={activo ? 'text-win-100' : 'text-gray-400'}> · {n}</span>}
          </button>
        )
      })}

      {pisos.length < PISO_MAXIMO && (
        <button
          type="button"
          onClick={onAgregar}
          aria-label={`Agregar piso ${pisos.length + 1}`}
          title={`Agregar piso ${pisos.length + 1}`}
          className="flex shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-win-200 px-3 py-2 text-win-700 transition active:scale-[0.97] hover:border-win-500"
        >
          <IconoMas className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
