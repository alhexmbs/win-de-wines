import type { ReactNode } from 'react'

/**
 * Barra de marca. Va de borde a borde de la pantalla y alinea su contenido a un
 * contenedor ancho, para que en laptop el logo quede en el borde de la página y
 * no flotando dentro de la columna de lectura.
 *
 * La franja naranja de abajo es el recurso de marca más barato que existe: se
 * reconoce sin leer nada, y sirve de línea divisoria al mismo tiempo.
 */
export function CabeceraWin({ derecha }: { derecha?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20">
      <div className="bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3 md:px-8 md:py-4">
          <span className="flex shrink-0 items-center gap-2.5">
            <img src="/logo.png" alt="WIN" className="h-6 w-auto md:h-7" />
            <span className="border-l border-win-200 pl-2.5 text-sm font-semibold text-gray-500 md:text-base">
              WinTest
            </span>
          </span>
          {derecha}
        </div>
      </div>
      <div className="h-1 bg-gradient-to-r from-win-700 via-win-500 to-win-200" />
    </header>
  )
}
