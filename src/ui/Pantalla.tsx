import type { ReactNode } from 'react'
import { CabeceraWin } from './CabeceraWin'
import { PasosCabecera } from './PasosCabecera'

interface Props {
  titulo?: string
  bajada?: string
  children: ReactNode
  /** Botones que quedan fijos abajo, al alcance del pulgar. */
  pie?: ReactNode
  /** 1 Tu casa · 2 Medición · 3 Reporte · 4 Enviar. Omitir = sin indicador. */
  paso?: number
}

/**
 * Marco de todas las pantallas de tarea (onboarding, medición, reporte, envío).
 *
 * Dos anchos distintos a propósito: la barra de marca va de borde a borde y se
 * alinea a un contenedor ancho, mientras que el contenido se queda en columna
 * angosta. Son formularios y texto, y una línea de 900 px se lee peor. Lo que
 * estaba mal antes no era el ancho del texto sino que no había marco alrededor.
 */
export function Pantalla({ titulo, bajada, children, pie, paso }: Props) {
  return (
    <div className="flex min-h-[100svh] flex-col">
      <CabeceraWin derecha={paso === undefined ? undefined : <PasosCabecera actual={paso} />} />

      <main className="mx-auto w-full max-w-lg flex-1 px-5 pt-7 pb-8 md:max-w-2xl md:px-8 md:pt-12">
        {titulo && (
          <h1 className="text-3xl leading-tight font-bold text-win-900 md:text-4xl">{titulo}</h1>
        )}
        {bajada && <p className="mt-2 text-base text-gray-600 md:text-lg">{bajada}</p>}
        <div className={titulo ? 'mt-7' : ''}>{children}</div>
      </main>

      {pie && (
        <div className="no-imprimir sticky bottom-0 border-t border-win-200 bg-white/90 backdrop-blur">
          <div className="mx-auto w-full max-w-lg space-y-3 px-5 py-4 md:max-w-2xl md:px-8">
            {pie}
          </div>
        </div>
      )}
    </div>
  )
}
