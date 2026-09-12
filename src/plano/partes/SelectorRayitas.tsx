import type { SenalDeclarada } from '../../contrato'

/**
 * Cuánto wifi marca el celular, según lo ve el usuario. Opcional y DECLARADO:
 * ningún navegador expone la potencia de la señal, así que es lo único parecido
 * que se puede tener sin inventar. No entra en el índice ni pinta el mapa.
 *
 * Se pregunta por el abanico de wifi y no por las barras: las barras son la
 * señal del celular, que no tiene nada que ver con el wifi de la casa.
 */
export function SelectorRayitas({
  valor,
  maximo,
  onCambiar,
  onCambiarMaximo,
  className = 'mt-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-win-200/40',
}: {
  valor: SenalDeclarada | null
  /** Niveles del ícono en ese equipo: 3 en iPhone, 4 en casi todo lo demás. */
  maximo: number
  onCambiar: (senal: SenalDeclarada | null) => void
  onCambiarMaximo: (maximo: number) => void
  className?: string
}) {
  const otro = maximo === 3 ? 4 : 3

  return (
    <fieldset className={className}>
      <legend className="sr-only">Wifi que marca tu celular</legend>
      <p className="font-semibold text-win-900">¿Cuánto wifi marca tu celular?</p>
      <p className="mt-1 text-sm leading-snug text-gray-600">
        Opcional. Mira el ícono de wifi arriba en la pantalla (el abanico, no las barras de señal
        del celular). Es lo que dice tu teléfono: nosotros no podemos leerlo.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {Array.from({ length: maximo + 1 }, (_, barras) => {
          const activo = valor !== null && valor.barras === barras && valor.maximo === maximo
          return (
            <button
              key={barras}
              type="button"
              aria-pressed={activo}
              aria-label={`${barras} de ${maximo} rayitas`}
              title={`${barras} de ${maximo}`}
              onClick={() => onCambiar({ barras, maximo })}
              className={`flex h-12 min-w-12 items-center justify-center rounded-xl border-2 px-2 transition active:scale-[0.97] ${
                activo ? 'border-win-700 bg-win-700 text-white' : 'border-win-200 bg-white text-win-700'
              }`}
            >
              <IconoRayitas barras={barras} maximo={maximo} />
            </button>
          )
        })}
        <button
          type="button"
          aria-pressed={valor === null}
          onClick={() => onCambiar(null)}
          className={`rounded-xl border-2 px-4 text-sm font-semibold transition active:scale-[0.97] ${
            valor === null
              ? 'border-win-700 bg-win-700 text-white'
              : 'border-dashed border-win-200 bg-white text-gray-500'
          }`}
        >
          No sé
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          onCambiarMaximo(otro)
          if (valor !== null) onCambiar(null)
        }}
        className="mt-3 text-sm font-semibold text-win-700 underline underline-offset-4"
      >
        Mi ícono de wifi tiene {otro} niveles
      </button>
    </fieldset>
  )
}

/** Abanico de wifi con `maximo` niveles: el punto de abajo y los arcos. */
function IconoRayitas({ barras, maximo }: { barras: number; maximo: number }) {
  const cx = 12
  const cy = 19
  const arcos = maximo - 1

  return (
    <svg
      viewBox="0 0 24 22"
      className="h-6 w-6"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
    >
      <circle cx={cx} cy={cy} r={1.8} fill="currentColor" stroke="none" opacity={barras >= 1 ? 1 : 0.25} />
      {Array.from({ length: arcos }, (_, i) => {
        const r = 5 + (i * 11) / Math.max(1, arcos - 1)
        return (
          <path
            key={i}
            d={`M ${cx - r * 0.72} ${cy - r * 0.7} A ${r} ${r} 0 0 1 ${cx + r * 0.72} ${cy - r * 0.7}`}
            opacity={barras >= i + 2 ? 1 : 0.25}
          />
        )
      })}
    </svg>
  )
}
