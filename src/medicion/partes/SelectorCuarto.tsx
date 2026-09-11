import { useState } from 'react'
import { CUARTOS_SUGERIDOS, limpiar, yaExiste } from '../cuartos'

/**
 * Botones rápidos + escribir otro. La lista fija no es pereza: si cada quien
 * escribe "mi pieza" o "dorm 1", el reporte queda con etiquetas que no se
 * pueden comparar entre cuartos ni dibujar en el mapa del día 2.
 */
export function SelectorCuarto({
  valor,
  usados,
  onCambiar,
}: {
  valor: string
  usados: string[]
  onCambiar: (cuarto: string) => void
}) {
  const [escribiendo, setEscribiendo] = useState(false)

  const disponibles = CUARTOS_SUGERIDOS.filter((c) => !yaExiste(c, usados))
  const esDeLaLista = disponibles.some((c) => c === valor)
  const repetido = valor !== '' && yaExiste(valor, usados)

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {disponibles.map((cuarto) => (
          <button
            key={cuarto}
            type="button"
            onClick={() => {
              setEscribiendo(false)
              onCambiar(cuarto)
            }}
            className={`rounded-full border-2 px-4 py-2 text-sm font-semibold transition active:scale-[0.97] ${
              valor === cuarto
                ? 'border-win-700 bg-win-700 text-white'
                : 'border-win-200 bg-white text-win-700'
            }`}
          >
            {cuarto}
          </button>
        ))}

        <button
          type="button"
          onClick={() => {
            setEscribiendo(true)
            if (esDeLaLista) onCambiar('')
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
          value={esDeLaLista ? '' : valor}
          onChange={(e) => onCambiar(limpiar(e.target.value))}
          placeholder="¿Cómo le dices a este cuarto?"
          maxLength={40}
          className="mt-3 w-full rounded-2xl border-2 border-win-200 bg-white px-4 py-3 text-win-900 outline-none focus:border-win-500"
        />
      )}

      {repetido && (
        <p className="mt-2 text-sm text-malo">
          Ya mediste «{valor}». Usa otro nombre o repite esa medición desde la lista.
        </p>
      )}
    </div>
  )
}
