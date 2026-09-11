import type { Progreso } from '../medir'
import { Boton } from '../../ui/Boton'
import { Pantalla } from '../../ui/Pantalla'

const TEXTO_FASE: Record<Progreso['fase'], string> = {
  latencia: 'Midiendo la respuesta de la red…',
  descarga: 'Midiendo la velocidad de descarga…',
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
        <div className="h-3 overflow-hidden rounded-full bg-win-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-win-600 to-win-500 transition-[width] duration-200 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>

        <p className="mt-3 text-sm text-gray-600">
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
