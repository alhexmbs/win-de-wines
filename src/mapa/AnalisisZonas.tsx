import { analizarCobertura } from './analisis.ts'
import type { EstadoPlano } from '../plano/estado.ts'

/**
 * F6: qué hacer con lo que muestra el mapa de calor. Zonas débiles agrupadas
 * por cercanía, punto sugerido para el repetidor, y si conviene mesh en vez
 * de un solo equipo. No decide nada sobre el proveedor -- eso lo sigue
 * diciendo reglas.ts con el % del plan, que es una pregunta distinta.
 */
export function AnalisisZonas({ estado }: { estado: EstadoPlano }) {
  const { zonas, necesitaMesh, sugerenciaRepetidor } = analizarCobertura(estado)
  if (zonas.length === 0) return null

  return (
    <div className="mt-4 space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-win-200/40">
      <h3 className="font-bold text-win-900">Zonas con problema de cobertura</h3>

      <ul className="space-y-2">
        {zonas.map((z, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span
              className={`mt-1 h-2 w-2 shrink-0 rounded-full ${z.puntoMuerto ? 'bg-malo' : 'bg-regular'}`}
            />
            <span className="text-gray-700">
              <strong className="font-semibold text-win-900">{z.cuartos.join(' + ')}</strong>{' '}
              (piso {z.piso}){z.puntoMuerto && ' — sin señal en algún punto'}
            </span>
          </li>
        ))}
      </ul>

      {sugerenciaRepetidor !== null && (
        <p className="rounded-xl bg-win-100 p-3 text-sm leading-relaxed text-win-900">
          <strong>Dónde poner el repetidor:</strong> cerca de {sugerenciaRepetidor.cercaDe}, piso{' '}
          {sugerenciaRepetidor.piso} — a medio camino entre el router y la zona débil.
        </p>
      )}

      <p className="rounded-xl bg-win-100 p-3 text-sm leading-relaxed text-win-900">
        <strong>{necesitaMesh ? 'Conviene un sistema mesh' : 'Un solo repetidor debería bastar'}</strong>
        {necesitaMesh
          ? ': hay más de una zona débil separada, y un solo equipo no cubre huecos en distintos lugares de la casa a la vez.'
          : ': hay una sola zona débil, concentrada en un lugar.'}
      </p>
    </div>
  )
}
