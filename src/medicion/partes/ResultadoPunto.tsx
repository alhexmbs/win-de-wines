import type { Punto } from '../../contrato'
import { Boton } from '../../ui/Boton'
import { IconoAviso } from '../../ui/Iconos'
import { Pantalla } from '../../ui/Pantalla'
import { CLASE_TEXTO, nivelDeIndice, porcentajeVsReferencia, type DatosSenal } from '../senal'

/**
 * Lo que midió ESTE punto, antes de guardarlo.
 *
 * POR QUÉ EXISTE: antes se medía y se volvía directo al mapa, donde el cuarto
 * ya aparece consolidado con la mediana de todos sus puntos. Entonces un punto
 * bueno archivado en el cuarto equivocado quedaba promediado con los de ese
 * cuarto, y en pantalla no había forma de notarlo: el usuario leía el número
 * mezclado y concluía que la medición había salido mal.
 *
 * Aquí el número del punto se ve solo, con el nombre del cuarto bien grande al
 * lado. Si dice «Sala» y la persona está arriba, se nota antes de guardar.
 */

/** A partir de cuántas veces de diferencia se sospecha que cambió de cuarto. */
const FACTOR_SOSPECHA = 2

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

export function ResultadoPunto({
  etiqueta,
  numero,
  punto,
  anteriores,
  referencia,
  onGuardar,
  onDescartar,
}: {
  /** Nombre del cuarto tal como se va a guardar. Es el dato que hay que revisar. */
  etiqueta: string
  /** Qué número de punto es dentro de ese cuarto. */
  numero: number
  punto: Punto
  /** Los puntos que ya tenía este cuarto, para detectar el salto. */
  anteriores: Punto[]
  referencia: DatosSenal | null
  onGuardar: () => void
  onDescartar: () => void
}) {
  const fallo = punto.error !== undefined
  const pct = fallo ? null : porcentajeVsReferencia(punto, referencia)
  const nivel = nivelDeIndice(pct ?? 0)

  /*
   * El salto que delata un cambio de cuarto no marcado: este punto mide muchas
   * veces más (o menos) que los que ya tenía el cuarto. No se bloquea nada —
   * puede ser real, por ejemplo al abrir una puerta— pero se pregunta.
   */
  const buenos = anteriores.filter((p) => p.error === undefined && p.descarga_mbps > 0)
  const previo =
    buenos.length === 0
      ? null
      : buenos.reduce((a, p) => a + p.descarga_mbps, 0) / buenos.length
  const saltoRaro =
    !fallo &&
    previo !== null &&
    previo > 0 &&
    punto.descarga_mbps > 0 &&
    (punto.descarga_mbps / previo >= FACTOR_SOSPECHA ||
      previo / punto.descarga_mbps >= FACTOR_SOSPECHA)

  return (
    <Pantalla
      paso={2}
      pie={
        <>
          <Boton onClick={onGuardar}>Guardar este punto</Boton>
          <Boton variante="texto" onClick={onDescartar}>
            Descartar y volver
          </Boton>
        </>
      }
    >
      <p className="text-sm font-semibold tracking-wide text-win-700 uppercase">
        Punto {numero} de
      </p>
      <h1 className="mt-1 text-3xl leading-tight font-bold text-win-900">{etiqueta}</h1>
      <p className="mt-2 text-sm text-gray-600">
        Revisa que el cuarto sea donde estás parado ahora. Si no lo es, descarta y cámbialo antes de
        volver a medir.
      </p>

      {fallo ? (
        <p className="mt-6 rounded-2xl bg-malo-bg p-4 text-sm leading-relaxed text-malo">
          No hubo respuesta en este punto. Se guarda como «sin señal», que para el mapa es el peor
          caso posible y es justo lo que se siente aquí.
        </p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Cifra etiqueta="Descarga" valor={punto.descarga_mbps.toFixed(1)} unidad="Mbps" />
            <Cifra etiqueta="Respuesta" valor={String(punto.latencia_ms)} unidad="ms" />
          </div>

          {pct !== null && (
            <p className={`mt-4 text-sm font-semibold ${CLASE_TEXTO[nivel]}`}>
              {pct}% de lo que da el router
            </p>
          )}
        </>
      )}

      {saltoRaro && previo !== null && (
        <div className="mt-6 flex gap-3 rounded-2xl border border-win-200 bg-win-100/70 p-4">
          <span className="mt-0.5 shrink-0 text-win-600">
            <IconoAviso />
          </span>
          <p className="text-sm leading-relaxed text-win-900">
            <strong className="font-bold">¿Sigues en {etiqueta}?</strong> Este punto dio{' '}
            {punto.descarga_mbps.toFixed(1)} Mbps y los anteriores de este cuarto rondan{' '}
            {previo.toFixed(1)} Mbps. Si te moviste a otro cuarto o cambiaste de piso, descarta y
            marca dónde estás: si lo guardas aquí, los dos números se promedian y el mapa muestra
            uno que no corresponde a ninguno de los dos sitios.
          </p>
        </div>
      )}
    </Pantalla>
  )
}
