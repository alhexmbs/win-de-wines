import { CLASE_FONDO, CLASE_TEXTO, EMOJI_NIVEL, nivelDeIndice } from '../medicion/senal'

/**
 * El árbol de cobertura por piso. Una sola pieza de presentación, usada por el
 * mapa en vivo de la caminata y por el mapa final del reporte, para que el
 * cliente vea exactamente el mismo dibujo antes y después.
 */
export interface FilaMapa {
  piso: number
  cuarto: string
  indice: number
  puntos: number
  es_referencia: boolean
  /** Línea chica de abajo: Mbps, ms, % vs router. */
  detalle: string
}

/**
 * El contrato guarda «Dormitorio (piso 2)» para que dos cuartos con el mismo
 * nombre no choquen, pero debajo del título «Piso 2» eso se lee redundante.
 */
function sinPiso(cuarto: string): string {
  return cuarto.replace(/ \(piso \d+\)/, '')
}

const CALIFICATIVO = (indice: number): string => {
  if (indice >= 85) return 'Excelente'
  if (indice >= 70) return 'Buena'
  if (indice >= 50) return 'Regular'
  if (indice >= 30) return 'Débil'
  if (indice > 0) return 'Muy débil'
  return 'Sin señal'
}

export function ArbolCobertura({ filas }: { filas: FilaMapa[] }) {
  const pisos = [...new Set(filas.map((f) => f.piso))].sort((a, b) => a - b)

  return (
    <div className="space-y-5">
      {pisos.map((piso) => {
        const delPiso = filas.filter((f) => f.piso === piso)
        return (
          <div key={piso}>
            <p className="mb-2 text-sm font-bold tracking-wide text-win-700 uppercase">
              Piso {piso}
            </p>

            <ul className="space-y-2">
              {delPiso.map((fila, i) => {
                const nivel = nivelDeIndice(fila.indice)
                const ultimo = i === delPiso.length - 1
                return (
                  <li key={`${fila.cuarto}-${i}`} className="flex items-start gap-2">
                    <span
                      className="mt-3 font-mono text-sm text-win-200 select-none"
                      aria-hidden="true"
                    >
                      {ultimo ? '└──' : '├──'}
                    </span>

                    <div className="min-w-0 flex-1 rounded-2xl bg-white p-3 shadow-sm">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate font-semibold text-win-900">
                          {sinPiso(fila.cuarto)}
                          {fila.es_referencia && (
                            <span className="ml-1 text-xs font-normal text-gray-400">
                              · referencia
                            </span>
                          )}
                        </p>
                        <p className={`shrink-0 text-sm font-bold ${CLASE_TEXTO[nivel]}`}>
                          {EMOJI_NIVEL[nivel]} {CALIFICATIVO(fila.indice)}
                        </p>
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={`h-full rounded-full ${CLASE_FONDO[nivel]}`}
                            style={{ width: `${Math.max(3, fila.indice)}%` }}
                          />
                        </div>
                        <span className="w-10 shrink-0 text-right text-sm font-bold text-gray-500">
                          {fila.indice}
                        </span>
                      </div>

                      <p className="mt-1.5 text-xs text-gray-500">
                        {fila.detalle}
                        {fila.puntos > 1 && ` · ${fila.puntos} puntos medidos`}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

export function LeyendaCobertura() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
      <span>🟢 70-100 fuerte</span>
      <span>🟡 30-69 media</span>
      <span>🔴 0-29 débil</span>
    </div>
  )
}
