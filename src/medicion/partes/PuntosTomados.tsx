import { IconoPapelera } from '../../ui/Iconos'
import { CLASE_TEXTO, nivelDeIndice, porcentajeVsReferencia, type DatosSenal } from '../senal'
import { etiquetaDeCuarto, type Parada } from '../caminata'

/**
 * Todo lo tomado hasta ahora, punto por punto, con borrado individual.
 *
 * POR QUÉ EXISTE: antes solo había un botón, «Borrar el último punto de X», y
 * X era el cuarto que estuviera seleccionado en ese momento. Para llegar al 2º
 * de cuatro puntos había que borrar los dos de arriba, y para tocar otro cuarto
 * había que volver a seleccionarlo en el selector. Aquí se borra el que sea,
 * donde sea, sin perder los demás.
 *
 * La referencia está protegida: de ella cuelga el índice de toda la casa, así
 * que se le pueden quitar puntos sobrantes pero nunca quedarse sin ninguno.
 */
export function PuntosTomados({
  paradas,
  referencia,
  onBorrarPunto,
  onBorrarCuarto,
}: {
  paradas: Parada[]
  referencia: DatosSenal | null
  onBorrarPunto: (piso: number, cuarto: string, indice: number) => void
  onBorrarCuarto: (piso: number, cuarto: string) => void
}) {
  const conPuntos = paradas.filter((p) => p.puntos.length > 0)
  if (conPuntos.length === 0) return null

  return (
    <ul className="space-y-3">
      {conPuntos.map((parada) => {
        const etiqueta = etiquetaDeCuarto(parada.piso, parada.cuarto, parada.es_referencia)
        const ultimoDeLaReferencia = parada.es_referencia && parada.puntos.length === 1

        return (
          <li key={`${parada.piso}|${parada.cuarto}`} className="rounded-2xl bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate font-semibold text-win-900">{etiqueta}</p>

              {parada.es_referencia ? (
                <span className="shrink-0 text-xs font-semibold text-gray-400">
                  no se puede quitar
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onBorrarCuarto(parada.piso, parada.cuarto)}
                  aria-label={`Borrar ${etiqueta} entero`}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-malo transition hover:bg-malo-bg"
                >
                  <IconoPapelera className="h-4 w-4" />
                  Todo el cuarto
                </button>
              )}
            </div>

            <ul className="mt-2 divide-y divide-win-200/50">
              {parada.puntos.map((punto, i) => {
                const fallo = punto.error !== undefined
                const pct = fallo ? null : porcentajeVsReferencia(punto, referencia)
                const nivel = nivelDeIndice(pct ?? 0)

                return (
                  <li key={`${punto.timestamp}-${i}`} className="flex items-center gap-3 py-2">
                    <span className="w-6 shrink-0 text-sm font-bold text-gray-400 tabular-nums">
                      {i + 1}
                    </span>

                    <span className="min-w-0 flex-1 text-sm">
                      {fallo ? (
                        <span className="font-semibold text-malo">Sin señal</span>
                      ) : (
                        <>
                          <span className="font-semibold text-win-900 tabular-nums">
                            {punto.descarga_mbps.toFixed(1)} Mbps
                          </span>
                          <span className="text-gray-500"> · {punto.latencia_ms} ms</span>
                          {pct !== null && (
                            <span className={`font-semibold ${CLASE_TEXTO[nivel]}`}> · {pct}%</span>
                          )}
                        </>
                      )}
                    </span>

                    <button
                      type="button"
                      disabled={ultimoDeLaReferencia}
                      onClick={() => onBorrarPunto(parada.piso, parada.cuarto, i)}
                      aria-label={`Borrar el punto ${i + 1} de ${etiqueta}`}
                      className="shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-malo-bg hover:text-malo disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                    >
                      <IconoPapelera className="h-4 w-4" />
                    </button>
                  </li>
                )
              })}
            </ul>

            {ultimoDeLaReferencia && (
              <p className="mt-1 text-xs text-gray-500">
                Es el único punto de la referencia y de él cuelga el índice de toda la casa. Toma
                otro aquí antes de borrarlo.
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}
