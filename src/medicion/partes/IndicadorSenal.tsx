import { CLASE_FONDO, CLASE_FONDO_SUAVE, CLASE_TEXTO, EMOJI_NIVEL, TEXTO_NIVEL, nivelDeIndice } from '../senal'

/**
 * El router y la señal que llega ahora mismo. Tres arcos que se encienden según
 * el nivel, el índice grande, y las últimas lecturas como barritas.
 *
 * El texto dice "respuesta de la red", no "dBm": lo que se está viendo son
 * pings, no la potencia del radio, que ningún navegador expone.
 */
export function IndicadorSenal({
  indice,
  ubicacion,
  latencia,
  ultimas,
}: {
  indice: number | null
  ubicacion: string
  latencia: number | null
  ultimas: (number | null)[]
}) {
  const nivel = indice === null ? 'media' : nivelDeIndice(indice)
  const arcos = indice === null ? 0 : indice >= 70 ? 3 : indice >= 30 ? 2 : 1

  return (
    <div className={`rounded-2xl p-5 ${CLASE_FONDO_SUAVE[nivel]}`}>
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 64 64" className="h-16 w-16 shrink-0" aria-hidden="true">
          {[1, 2, 3].map((i) => (
            <path
              key={i}
              d={
                i === 1
                  ? 'M24 30a11 11 0 0 1 16 0'
                  : i === 2
                    ? 'M18 24a19 19 0 0 1 28 0'
                    : 'M12 18a28 28 0 0 1 40 0'
              }
              fill="none"
              strokeWidth={4}
              strokeLinecap="round"
              className={
                indice !== null && arcos >= i
                  ? CLASE_TEXTO[nivel]
                  : 'text-gray-300'
              }
              stroke="currentColor"
              opacity={indice !== null && arcos >= i ? 1 : 0.35}
            />
          ))}
          <rect x="16" y="40" width="32" height="14" rx="4" fill="currentColor" className="text-win-700" />
          <circle cx="23" cy="47" r="2" fill="#fff" />
          <circle cx="30" cy="47" r="2" fill="#fff" />
        </svg>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-600">{ubicacion}</p>
          <p className={`text-3xl font-bold ${CLASE_TEXTO[nivel]}`}>
            {indice === null ? '—' : indice}
            <span className="ml-1 text-base font-semibold text-gray-500">/100</span>
          </p>
          <p className={`text-sm font-semibold ${CLASE_TEXTO[nivel]}`}>
            {EMOJI_NIVEL[nivel]} {indice === null ? 'Midiendo…' : TEXTO_NIVEL[nivel]}
            {latencia !== null && (
              <span className="font-normal text-gray-500"> · {Math.round(latencia)} ms</span>
            )}
          </p>
        </div>
      </div>

      <div className="mt-4 flex h-8 items-end gap-1" aria-hidden="true">
        {ultimas.slice(-24).map((ms, i) => (
          <div
            key={i}
            className={`flex-1 rounded-sm ${ms === null ? 'bg-malo' : CLASE_FONDO[nivel]}`}
            style={{
              height: ms === null ? '100%' : `${Math.max(12, 100 - Math.min(95, ms / 4))}%`,
              opacity: ms === null ? 0.9 : 0.35 + (0.65 * (i + 1)) / Math.min(24, ultimas.length),
            }}
          />
        ))}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-gray-500">
        Medido con pings reales a internet, no con la potencia del radio: ningún navegador la
        expone. El número firme de cada punto sale al pulsar «Tomar punto aquí».
      </p>
    </div>
  )
}
