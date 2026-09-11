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

export function Boton({ variante = 'primario', cargando = false, children, ...resto }: Props) {
  return (
    <button
      type="button"
      {...resto}
      disabled={resto.disabled || cargando}
      className={`${BASE} ${ESTILOS[variante]} ${resto.className ?? ''}`}
    >
      {cargando ? 'Un momento…' : children}
    </button>
  )
}
