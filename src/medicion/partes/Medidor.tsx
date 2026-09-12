import type { Progreso } from '../medir'
import { Boton } from '../../ui/Boton'
import { Pantalla } from '../../ui/Pantalla'

const TEXTO_FASE: Record<Progreso['fase'], string> = {
  latencia: 'Midiendo la respuesta de la red…',
  descarga: 'Midiendo la velocidad de descarga…',
}

/** Radio del anillo en el viewBox de 120x120. Grosor del trazo: 10. */
const RADIO = 52
const CIRCUNFERENCIA = 2 * Math.PI * RADIO

/**
 * Anillo tipo velocímetro: se llena con el progreso total de la medición
 * (igual que la barra que reemplaza) y muestra en el centro el número que
 * más importa según la fase actual — ms mientras mide latencia, Mbps
 * mientras descarga. Los dos números completos siguen abajo en las Cifra.
 */
function Anillo({ pct, valor, unidad }: { pct: number; valor: string; unidad: string }) {
  const offset = CIRCUNFERENCIA * (1 - pct / 100)
  return (
    <div className="relative mx-auto h-44 w-44">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={RADIO} fill="none" strokeWidth="10" className="stroke-win-100" />
        <circle
          cx="60"
          cy="60"
          r={RADIO}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          className="stroke-win-600"
          strokeDasharray={CIRCUNFERENCIA}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 200ms ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-4xl font-bold text-win-900 tabular-nums">{valor}</p>
        <p className="text-sm font-semibold text-gray-500">{unidad}</p>
      </div>
    </div>
  )
}

export function Medidor({
  cuarto,
  progreso,
  pantallaEncendida,
  onCancelar,
}: {
  cuarto: string
  progreso: Progreso | null
  pantallaEncendida: boolean
  onCancelar: () => void
}) {
  const pct = Math.round((progreso?.pct ?? 0) * 100)
  const enLatencia = progreso === null || progreso.fase === 'latencia'
  const valorAnillo = enLatencia
    ? (progreso?.latencia_ms ?? null) === null
      ? '—'
      : Math.round(progreso!.latencia_ms!).toString()
    : progreso!.mbps.toFixed(1)

  return (
    <Pantalla
      paso={2}
      titulo={cuarto}
      bajada="Quédate quieto en este punto hasta que termine. No cambies de cuarto ni bloquees la pantalla."
      pie={
        <Boton variante="texto" onClick={onCancelar}>
          Cancelar esta medición
        </Boton>
      }
    >
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-win-200/40">
        <Anillo pct={pct} valor={valorAnillo} unidad={enLatencia ? 'ms' : 'Mbps'} />

        <p className="mt-4 text-center text-sm text-gray-600">
          {progreso === null ? 'Preparando…' : TEXTO_FASE[progreso.fase]}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Cifra
            etiqueta="Descarga"
            valor={progreso === null || progreso.mbps === 0 ? '—' : progreso.mbps.toFixed(1)}
            unidad="Mbps"
          />
          <Cifra
            etiqueta="Respuesta"
            valor={
              progreso?.latencia_ms === null || progreso?.latencia_ms === undefined
                ? '—'
                : Math.round(progreso.latencia_ms).toString()
            }
            unidad="ms"
          />
        </div>
      </div>

      {!pantallaEncendida && (
        <p className="mt-4 rounded-xl bg-win-100 p-3 text-sm text-win-900">
          Tu navegador no nos deja mantener la pantalla encendida. Si se apaga a mitad de la
          medición, el resultado de este cuarto puede salir bajo.
        </p>
      )}
    </Pantalla>
  )
}

function Cifra({ etiqueta, valor, unidad }: { etiqueta: string; valor: string; unidad: string }) {
  return (
    <div className="rounded-xl bg-win-50 p-3">
      <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">{etiqueta}</p>
      <p className="mt-1 text-2xl font-bold text-win-900">
        {valor}
        <span className="ml-1 text-sm font-semibold text-gray-500">{unidad}</span>
      </p>
    </div>
  )
}
