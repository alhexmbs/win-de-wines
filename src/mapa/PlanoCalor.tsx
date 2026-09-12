import { useId, useState } from 'react'
import { celdasDeCalor, colorDeIndice, type PuntoCalor } from './calor.ts'
import {
  type EstadoPlano,
  habitacionesDelPiso,
  indicesPorPunto,
  puntosDe,
} from '../plano/estado.ts'
import { EditorPlano } from '../plano/partes/EditorPlano.tsx'

/**
 * F4 + F5: el plano de un piso, de solo lectura (sin `onAccion`, EditorPlano
 * no deja editar nada), con el mapa de calor por interpolación debajo de las
 * habitaciones y los puntos medidos encima — mismo dibujo que la caminata,
 * para que el cliente reconozca el esquema que él mismo armó.
 */
function CapaCalor({
  estado,
  piso,
  indices,
}: {
  estado: EstadoPlano
  piso: number
  indices: Map<string, number>
}) {
  const clip = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const habitaciones = habitacionesDelPiso(estado, piso)
  if (habitaciones.length === 0) return null

  const puntos: PuntoCalor[] = habitaciones.flatMap((h) =>
    puntosDe(estado, h.id)
      .map((p) => ({ x: p.x, y: p.y, indice: indices.get(p.id) }))
      .filter((p): p is PuntoCalor => p.indice !== undefined),
  )

  const area = {
    x: Math.min(...habitaciones.map((h) => h.x)),
    y: Math.min(...habitaciones.map((h) => h.y)),
    ancho: Math.max(...habitaciones.map((h) => h.x + h.ancho)) - Math.min(...habitaciones.map((h) => h.x)),
    alto: Math.max(...habitaciones.map((h) => h.y + h.alto)) - Math.min(...habitaciones.map((h) => h.y)),
  }
  const celdas = celdasDeCalor(puntos, area)

  return (
    <>
      <defs>
        <clipPath id={clip}>
          {habitaciones.map((h) => (
            <rect key={h.id} x={h.x} y={h.y} width={h.ancho} height={h.alto} />
          ))}
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        {celdas.map((c, i) => (
          <rect key={i} x={c.x} y={c.y} width={c.lado} height={c.lado} fill={colorDeIndice(c.indice)} />
        ))}
      </g>
    </>
  )
}

export function PlanoCalor({ estado }: { estado: EstadoPlano }) {
  const { pisos } = estado.plano
  const [piso, setPiso] = useState(pisos[0]?.numero ?? 1)
  const indices = indicesPorPunto(estado)

  return (
    <div>
      {pisos.length > 1 && (
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {pisos.map((p) => (
            <button
              key={p.numero}
              type="button"
              aria-pressed={p.numero === piso}
              onClick={() => setPiso(p.numero)}
              className={`min-w-[5.5rem] shrink-0 rounded-xl border-2 px-3 py-2 text-sm font-bold whitespace-nowrap transition ${
                p.numero === piso
                  ? 'border-win-700 bg-win-700 text-white'
                  : 'border-win-200 bg-white text-win-700'
              }`}
            >
              {p.nombre}
            </button>
          ))}
        </div>
      )}

      <EditorPlano
        estado={estado}
        piso={piso}
        indices={indices}
        seleccion={null}
        onSeleccionar={() => {}}
        className="aspect-[4/3]"
        fondo={<CapaCalor estado={estado} piso={piso} indices={indices} />}
      />

      <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-400" />
        Gris = sin datos suficientes cerca para estimar.
      </p>
    </div>
  )
}
