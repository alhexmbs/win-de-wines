import { IconoCheck } from './Iconos'

const NOMBRES = ['Tu casa', 'Medición', 'Reporte', 'Enviar']

/**
 * Indicador de paso. Ocupa el lado derecho de la cabecera con información real
 * —en qué punto del proceso va el cliente— en vez de una etiqueta de adorno.
 *
 * En celular no cabe la versión completa, así que se reduce a "2 de 4".
 */
export function PasosCabecera({ actual }: { actual: number }) {
  return (
    <>
      <span className="rounded-full bg-win-100 px-3 py-1 text-xs font-bold text-win-700 md:hidden">
        {actual} de {NOMBRES.length}
      </span>

      <ol className="hidden items-center md:flex">
        {NOMBRES.map((nombre, i) => {
          const numero = i + 1
          const hecho = numero < actual
          const activo = numero === actual

          return (
            <li key={nombre} className="flex items-center">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  hecho
                    ? 'bg-win-700 text-white'
                    : activo
                      ? 'bg-win-700 text-white ring-4 ring-win-200/60'
                      : 'bg-win-100 text-win-700/50'
                }`}
              >
                {hecho ? <IconoCheck className="h-3.5 w-3.5" /> : numero}
              </span>
              <span
                className={`ml-2 text-sm font-semibold ${
                  activo ? 'text-win-900' : 'text-gray-400'
                }`}
              >
                {nombre}
              </span>
              {numero < NOMBRES.length && (
                <span
                  className={`mx-3 h-px w-5 lg:w-8 ${hecho ? 'bg-win-500' : 'bg-win-200'}`}
                  aria-hidden="true"
                />
              )}
            </li>
          )
        })}
      </ol>
    </>
  )
}
