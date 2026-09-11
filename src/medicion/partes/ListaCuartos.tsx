import type { ReactNode } from 'react'
import type { Medicion } from '../../contrato'
import { SIN_SENAL } from '../medir'

/**
 * Lista de lo ya medido, con repetir y borrar.
 *
 * El % que se muestra es SOLO para orientar al cliente durante la caminata:
 * cuánto de lo que llega junto al router llega a ese cuarto. El diagnóstico de
 * verdad (bueno/regular/malo, causa, recomendaciones) lo hace B con la sesión
 * completa. Aquí no se emite ningún veredicto.
 */
export function ListaCuartos({
  mediciones,
  onRepetir,
  onBorrar,
}: {
  mediciones: Medicion[]
  onRepetir: (cuarto: string) => void
  onBorrar: (cuarto: string) => void
}) {
  const referencia = mediciones.find((m) => m.es_referencia)

  return (
    <ul className="space-y-2.5">
      {mediciones.map((m) => (
        <li
          key={m.cuarto}
          className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-win-200/40"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-win-900">{m.cuarto}</p>
            <p className="mt-0.5 text-sm text-gray-600">{resumen(m)}</p>
          </div>

          <Pastilla medicion={m} referencia={referencia} />

          <div className="flex shrink-0 gap-1">
            <IconoBoton titulo={`Repetir ${m.cuarto}`} onClick={() => onRepetir(m.cuarto)}>
              <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
            </IconoBoton>
            <IconoBoton titulo={`Borrar ${m.cuarto}`} onClick={() => onBorrar(m.cuarto)}>
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
            </IconoBoton>
          </div>
        </li>
      ))}
    </ul>
  )
}

function resumen(m: Medicion): string {
  if (m.error === SIN_SENAL) return 'No hubo respuesta en este punto'
  if (m.error !== undefined) return 'La medición no se pudo completar'
  return `${m.descarga_mbps} Mbps · ${m.latencia_ms} ms`
}

function Pastilla({ medicion, referencia }: { medicion: Medicion; referencia?: Medicion }) {
  if (medicion.es_referencia) {
    return (
      <span className="shrink-0 rounded-full bg-win-100 px-2.5 py-1 text-xs font-bold text-win-700">
        Referencia
      </span>
    )
  }

  if (medicion.error !== undefined) {
    return <span className="shrink-0 rounded-full bg-malo-bg px-2.5 py-1 text-xs font-bold text-malo">0%</span>
  }

  if (referencia === undefined || referencia.descarga_mbps <= 0) return null

  const pct = Math.round((medicion.descarga_mbps / referencia.descarga_mbps) * 100)
  const estilo =
    pct >= 60
      ? 'bg-bueno-bg text-bueno'
      : pct >= 25
        ? 'bg-regular-bg text-regular'
        : 'bg-malo-bg text-malo'

  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${estilo}`}>{pct}%</span>
  )
}

function IconoBoton({
  titulo,
  onClick,
  children,
}: {
  titulo: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={titulo}
      aria-label={titulo}
      className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-400 transition active:scale-95 hover:bg-win-50 hover:text-win-700"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        {children}
      </svg>
    </button>
  )
}
