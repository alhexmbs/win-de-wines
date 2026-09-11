import type { ReactNode } from 'react'

interface Props {
  titulo?: string
  bajada?: string
  children: ReactNode
  /** Botones que quedan fijos abajo, al alcance del pulgar. */
  pie?: ReactNode
}

export function Pantalla({ titulo, bajada, children, pie }: Props) {
  return (
    <div className="mx-auto flex min-h-[100svh] w-full max-w-lg flex-col">
      <main className="flex-1 px-5 pt-8 pb-6">
        {titulo && <h1 className="text-3xl leading-tight font-bold text-win-900">{titulo}</h1>}
        {bajada && <p className="mt-2 text-base text-gray-600">{bajada}</p>}
        <div className={titulo ? 'mt-7' : ''}>{children}</div>
      </main>
      {pie && (
        <div className="no-imprimir sticky bottom-0 space-y-3 border-t border-win-200 bg-white/90 px-5 py-4 backdrop-blur">
          {pie}
        </div>
      )}
    </div>
  )
}
