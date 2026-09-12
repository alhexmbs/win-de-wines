import type { ReactNode } from 'react'
import type { Habitacion } from '../../contrato'
import { CLASE_TEXTO, TEXTO_NIVEL, nivelDeIndice } from '../../medicion/senal'
import { IconoNivel } from '../../ui/Iconos'
import type { PuntoPlano } from '../estado'

/**
 * Lo que se midió en un punto, solo lectura. Separa lo medido de lo declarado:
 * las rayitas las indicó el usuario y así se dice.
 */
export function DetallePunto({
  punto,
  habitacion,
  numero,
  indice,
  onCerrar,
  children,
}: {
  punto: PuntoPlano
  habitacion: Habitacion
  /** Qué número de punto es dentro de su habitación. */
  numero: number
  indice: number | null
  onCerrar: () => void
  /** Acciones debajo del detalle: la caminata agrega repetir, rayitas y borrar. */
  children?: ReactNode
}) {
  const fallo = punto.error !== undefined
  const nivel = indice === null ? null : nivelDeIndice(indice)
  const rayitas = punto.senal_declarada

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-win-200/40">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
          Punto {numero} · {habitacion.nombre}
        </p>
        <button
          type="button"
          onClick={onCerrar}
          className="text-sm font-semibold text-win-700 underline underline-offset-4"
        >
          Listo
        </button>
      </div>

      {fallo ? (
        <p className="mt-3 rounded-xl bg-malo-bg p-3 text-sm font-semibold text-malo">
          Sin señal: el celular no logró conectarse en este punto.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Cifra etiqueta="Descarga" valor={punto.descarga_mbps.toFixed(1)} unidad="Mbps" />
          <Cifra etiqueta="Respuesta" valor={String(punto.latencia_ms)} unidad="ms" />
        </div>
      )}

      {nivel !== null && indice !== null && (
        <p className={`mt-3 flex items-center gap-1.5 text-sm font-semibold ${CLASE_TEXTO[nivel]}`}>
          <IconoNivel nivel={nivel} />
          {TEXTO_NIVEL[nivel]} · {indice}/100 comparado con el router
        </p>
      )}

      {rayitas !== undefined && (
        <p className="mt-2 text-sm text-gray-600">
          Rayitas de wifi: {rayitas.barras} de {rayitas.maximo}.{' '}
          <span className="text-gray-500">Lo indicaste tú; no es una medición.</span>
        </p>
      )}
      {children}
    </section>
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
