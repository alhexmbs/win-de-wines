import type { Sesion } from '../contrato'
import { nivelDeIndice } from '../medicion/senal'
import { IconoNivel } from '../ui/Iconos'
import { ArbolCobertura, LeyendaCobertura } from './ArbolCobertura'
import { filasDeMediciones } from './filas'

/**
 * Mapa de cobertura del reporte. Recibe la Sesion tal como viaja en el
 * contrato, así que también dibuja las sesiones del día 1 y los mocks, que no
 * traen `piso` ni `indice`: en ese caso el índice se calcula a partir de las
 * mismas mediciones y todo se cuelga del piso 1.
 */
export function MapaCalor({ sesion }: { sesion: Sesion }) {
  const filas = filasDeMediciones(sesion.mediciones)
  if (filas.length === 0) return null

  const debiles = filas.filter((f) => nivelDeIndice(f.indice) === 'debil')
  const medias = filas.filter((f) => nivelDeIndice(f.indice) === 'media')
  const pisos = new Set(filas.map((f) => f.piso)).size

  /**
   * El índice mide REPARTO dentro de la casa, no lo que llega desde la calle.
   * Si el router mismo está muy por debajo del plan, el mapa sale todo verde y
   * sin esta aclaración el cliente lo lee como "está todo bien" mientras el
   * reporte le dice lo contrario. Son dos problemas distintos y hay que
   * nombrarlos por separado.
   */
  const referencia = sesion.mediciones.find((m) => m.es_referencia) ?? sesion.mediciones[0]
  const plan = sesion.contexto.plan_mbps
  const pctDelPlan =
    plan !== null && plan > 0 && referencia.error === undefined
      ? Math.round((referencia.descarga_mbps / plan) * 100)
      : null
  const routerFlojo = pctDelPlan !== null && pctDelPlan < 40

  return (
    <section className="rounded-3xl bg-win-50 p-5 ring-1 ring-win-200/50">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-bold text-win-900">Mapa de cobertura</h2>
        <span className="text-xs text-gray-500">
          {filas.length} {filas.length === 1 ? 'habitación' : 'habitaciones'}
          {pisos > 1 && ` · ${pisos} pisos`}
        </span>
      </div>

      {routerFlojo && (
        <p className="mb-4 rounded-2xl bg-malo-bg p-4 text-sm leading-relaxed text-malo">
          <strong>Ojo con este mapa:</strong> tu wifi reparte bien la señal dentro de la casa, pero
          junto al router solo llegan {referencia.descarga_mbps.toFixed(1)} Mbps, el {pctDelPlan}%
          de tu plan. El problema no es la cobertura entre cuartos: es lo que entra desde la calle.
        </p>
      )}

      <ArbolCobertura filas={filas} />

      <div className="mt-5 border-t border-win-200/60 pt-4">
        <LeyendaCobertura />
        <p className="mt-3 text-xs leading-relaxed text-gray-500">
          El índice compara cada habitación contra la medición tomada junto al router, usando
          velocidad, latencia y estabilidad reales. No es una lectura de dBm: ningún navegador
          expone la potencia del radio wifi. Y un índice bajo no significa «lejos»: una pared de
          concreto, un espejo grande o un microondas encendido tumban la señal de un cuarto
          contiguo, mientras que un cuarto lejano con la puerta abierta puede andar bien.
        </p>

        {debiles.length > 0 && (
          <p className="mt-3 flex items-start gap-2 text-sm font-semibold text-malo">
            <IconoNivel nivel="debil" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Señal débil en: {debiles.map((f) => f.cuarto).join(', ')}</span>
          </p>
        )}
        {medias.length > 0 && (
          <p className="mt-1 flex items-start gap-2 text-sm font-semibold text-regular">
            <IconoNivel nivel="media" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Señal media en: {medias.map((f) => f.cuarto).join(', ')}</span>
          </p>
        )}
      </div>
    </section>
  )
}
