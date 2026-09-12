import { useMemo, useState } from 'react'
import ejemplo from '../../mocks/sesion_plano.json'
import type { Sesion } from '../contrato'
import { Boton } from '../ui/Boton'
import { Pantalla } from '../ui/Pantalla'
import {
  type EstadoPlano,
  estadoDesdeSesion,
  estadoInicial,
  habitacionPorId,
  habitacionesDelPiso,
  indicesPorPunto,
  puntosDe,
  resultadoDelPlano,
} from './estado'
import { DetallePunto } from './partes/DetallePunto'
import { EditorPlano } from './partes/EditorPlano'
import { PanelEsquema } from './partes/PanelEsquema'
import { SelectorPiso } from './partes/SelectorPiso'
import { usePlano } from './usePlano'
import type { Seleccion } from './vista'

/**
 * Banco de pruebas del editor del esquema, solo, sin medir nada.
 *
 *   pnpm dev  →  http://localhost:5173/lab.html?plano
 *
 * Arranca con mocks/sesion_plano.json para tener algo que mirar y mover.
 */

function estadoDeEjemplo(): EstadoPlano {
  return estadoDesdeSesion(ejemplo as unknown as Sesion) ?? estadoInicial(2)
}

export function LabPlano() {
  const { estado, despachar, reemplazar } = usePlano(estadoDeEjemplo)
  const [piso, setPiso] = useState(1)
  const [seleccion, setSeleccion] = useState<Seleccion>(null)
  const [verJson, setVerJson] = useState(false)

  const indices = useMemo(() => indicesPorPunto(estado), [estado])
  const habitacionesPorPiso = Object.fromEntries(
    estado.plano.pisos.map((p) => [p.numero, habitacionesDelPiso(estado, p.numero).length]),
  )

  const puntoElegido =
    seleccion?.tipo === 'punto' ? (estado.puntos.find((p) => p.id === seleccion.id) ?? null) : null
  const habitacionDelPunto =
    puntoElegido === null ? null : habitacionPorId(estado, puntoElegido.habitacion_id)

  function cambiarPiso(numero: number) {
    setPiso(numero)
    setSeleccion(null)
  }

  function agregarPiso() {
    const nuevo = despachar({ tipo: 'agregar_piso' })
    if (nuevo !== null) cambiarPiso(Math.max(...nuevo.plano.pisos.map((p) => p.numero)))
  }

  function cargar(otro: EstadoPlano) {
    reemplazar(otro)
    cambiarPiso(1)
  }

  return (
    <Pantalla
      titulo="Esquema de la vivienda"
      bajada="Lab del editor: el esquema solo, sin medir. Arranca con el recorrido de ejemplo."
      pie={
        <>
          <Boton variante="secundario" onClick={() => cargar(estadoDeEjemplo())}>
            Cargar el ejemplo
          </Boton>
          <Boton variante="texto" onClick={() => cargar(estadoInicial(2))}>
            Empezar vacío
          </Boton>
        </>
      }
    >
      <SelectorPiso
        pisos={estado.plano.pisos}
        piso={piso}
        habitacionesPorPiso={habitacionesPorPiso}
        onCambiar={cambiarPiso}
        onAgregar={agregarPiso}
      />

      <EditorPlano
        estado={estado}
        piso={piso}
        indices={indices}
        seleccion={seleccion}
        onSeleccionar={setSeleccion}
        onAccion={despachar}
        className="mt-3 aspect-[4/3]"
      />

      <p className="mt-2 text-xs leading-relaxed text-gray-500">
        {estado.plano.disposicion === 'auto'
          ? 'Esquema automático: las habitaciones no están a escala ni en su lugar real, y no hace falta acomodarlas para medir.'
          : 'Acomodaste el esquema. Sigue siendo aproximado: no es un plano a escala.'}
      </p>

      <div className="mt-4">
        {puntoElegido !== null && habitacionDelPunto !== null ? (
          <DetallePunto
            punto={puntoElegido}
            habitacion={habitacionDelPunto}
            numero={puntosDe(estado, habitacionDelPunto.id).findIndex((p) => p.id === puntoElegido.id) + 1}
            indice={indices.get(puntoElegido.id) ?? null}
            onCerrar={() => setSeleccion(null)}
          />
        ) : (
          <PanelEsquema
            estado={estado}
            piso={piso}
            habitacionId={seleccion?.tipo === 'habitacion' ? seleccion.id : null}
            onSeleccionarHabitacion={(id) => setSeleccion(id === null ? null : { tipo: 'habitacion', id })}
            onAccion={despachar}
          />
        )}
      </div>

      <button
        type="button"
        onClick={() => setVerJson((v) => !v)}
        className="mt-6 text-sm font-semibold text-win-700 underline underline-offset-4"
      >
        {verJson ? 'Ocultar lo que viaja en el contrato' : 'Ver lo que viaja en el contrato'}
      </button>
      {verJson && (
        <pre className="mt-3 max-h-[50vh] overflow-auto rounded-2xl bg-win-900 p-4 text-xs leading-relaxed text-win-100">
          {JSON.stringify(resultadoDelPlano(estado), null, 2)}
        </pre>
      )}

      <a href="/lab.html" className="mt-6 block text-sm text-gray-500 underline underline-offset-4">
        Ir al lab de medición
      </a>
    </Pantalla>
  )
}
