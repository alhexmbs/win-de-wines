import { useState } from 'react'
import type { ReactNode } from 'react'
import type { Contexto } from '../contrato'
import { Boton } from '../ui/Boton'
import { Pantalla } from '../ui/Pantalla'

/** Planes típicos de fibra. El cliente elige; WIN no nos da este dato. */
const PLANES: { etiqueta: string; valor: number | null }[] = [
  { etiqueta: '100 Mbps', valor: 100 },
  { etiqueta: '200 Mbps', valor: 200 },
  { etiqueta: '400 Mbps', valor: 400 },
  { etiqueta: '600 Mbps', valor: 600 },
  { etiqueta: 'No lo sé', valor: null },
]

function Grupo({ titulo, ayuda, children }: { titulo: string; ayuda?: string; children: ReactNode }) {
  return (
    <fieldset className="mb-7">
      <legend className="mb-1 text-lg font-semibold text-win-900">{titulo}</legend>
      {ayuda && <p className="mb-3 text-sm text-gray-600">{ayuda}</p>}
      {children}
    </fieldset>
  )
}

function Opcion({
  activa,
  onClick,
  children,
}: {
  activa: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={`rounded-xl border-2 px-4 py-3 font-semibold transition ${
        activa
          ? 'border-win-700 bg-win-700 text-white'
          : 'border-win-200 bg-white text-win-900 hover:border-win-500'
      }`}
    >
      {children}
    </button>
  )
}

export function Onboarding({ onListo }: { onListo: (contexto: Contexto) => void }) {
  const [planElegido, setPlanElegido] = useState<string | null>(null)
  const [tipoVivienda, setTipoVivienda] = useState<Contexto['tipo_vivienda'] | null>(null)
  const [pisos, setPisos] = useState<number | null>(null)

  const completo = planElegido !== null && tipoVivienda !== null && pisos !== null

  function continuar() {
    if (!completo) return
    const plan = PLANES.find((p) => p.etiqueta === planElegido)
    onListo({
      plan_mbps: plan ? plan.valor : null,
      tipo_vivienda: tipoVivienda,
      pisos,
    })
  }

  return (
    <Pantalla
      titulo="Cuéntanos de tu casa"
      bajada="Sirve para comparar lo que mides contra lo que deberías recibir."
      pie={
        <Boton onClick={continuar} disabled={!completo}>
          {completo ? 'Continuar' : 'Responde las 3 preguntas'}
        </Boton>
      }
    >
      <Grupo titulo="¿Qué plan tienes contratado?" ayuda="Está en tu recibo o en la app de WIN. Si no lo sabes, no pasa nada.">
        <div className="grid grid-cols-2 gap-3">
          {PLANES.map((p) => (
            <Opcion
              key={p.etiqueta}
              activa={planElegido === p.etiqueta}
              onClick={() => setPlanElegido(p.etiqueta)}
            >
              {p.etiqueta}
            </Opcion>
          ))}
        </div>
      </Grupo>

      <Grupo titulo="¿Dónde vives?">
        <div className="grid grid-cols-2 gap-3">
          <Opcion activa={tipoVivienda === 'casa'} onClick={() => setTipoVivienda('casa')}>
            Casa
          </Opcion>
          <Opcion
            activa={tipoVivienda === 'departamento'}
            onClick={() => setTipoVivienda('departamento')}
          >
            Departamento
          </Opcion>
        </div>
      </Grupo>

      <Grupo titulo="¿Cuántos pisos vas a medir?">
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((n) => (
            <Opcion key={n} activa={pisos === n} onClick={() => setPisos(n)}>
              {n === 4 ? '4+' : n}
            </Opcion>
          ))}
        </div>
      </Grupo>
    </Pantalla>
  )
}
