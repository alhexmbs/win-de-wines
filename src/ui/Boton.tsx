import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variante = 'primario' | 'secundario' | 'texto'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
  cargando?: boolean
  children: ReactNode
}

const BASE =
  'w-full rounded-2xl px-5 py-4 font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100'

const ESTILOS: Record<Variante, string> = {
  primario: 'bg-win-700 text-white shadow-lg shadow-win-700/20 hover:bg-win-900',
  secundario: 'bg-white text-win-700 border-2 border-win-200 hover:border-win-500',
  texto: 'bg-transparent text-win-700 underline underline-offset-4 py-2',
}

/**
 * Mientras carga, el boton conserva SU etiqueta y le suma un disco girando.
 *
 * Antes la reemplazaba por «Un momento…», el mismo texto para todos: al pulsar
 * «Enviar reporte» la pantalla dejaba de decir que se estaba enviando algo, y
 * el usuario perdia la unica confirmacion de que habia pulsado lo que queria.
 * El giro comunica la espera; la etiqueta sigue comunicando la accion.
 */
export function Boton({ variante = 'primario', cargando = false, children, ...resto }: Props) {
  return (
    <button
      type="button"
      {...resto}
      disabled={resto.disabled || cargando}
      aria-busy={cargando}
      className={`${BASE} ${ESTILOS[variante]} ${resto.className ?? ''}`}
    >
      <span className="flex items-center justify-center gap-2.5">
        {cargando && (
          <span
            aria-hidden="true"
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current/30 border-t-current"
          />
        )}
        {children}
      </span>
    </button>
  )
}
