import { useState } from 'react'
import type { ResultadoMedicion } from '../contrato'
import { ETIQUETA_MOCK, NOMBRES_MOCK, resultadoMock, type NombreMock } from '../mocks'
import { Boton } from '../ui/Boton'
import { Pantalla } from '../ui/Pantalla'

/**
 * DOBLE #2 — reemplaza al FlujoMedicion de A (src/medicion/).
 * Props idénticas al componente real: solo onTerminar(resultado).
 * En la Integración 1 se cambia el import en App.tsx y este archivo se borra.
 */
export function FlujoMedicionFalso({
  onTerminar,
}: {
  onTerminar: (resultado: ResultadoMedicion) => void
}) {
  const [midiendo, setMidiendo] = useState<NombreMock | null>(null)

  function simular(nombre: NombreMock) {
    setMidiendo(nombre)
    setTimeout(() => onTerminar(resultadoMock(nombre)), 1200)
  }

  return (
    <Pantalla
      titulo="Caminata por la casa"
      bajada="Esta pantalla es un doble. El flujo real de medición lo entrega A; aquí solo elegimos un resultado de prueba."
    >
      <div className="rounded-2xl border-2 border-dashed border-win-200 bg-white p-4">
        <p className="mb-4 text-sm font-semibold tracking-wide text-gray-500 uppercase">
          Escenario simulado
        </p>
        <div className="space-y-3">
          {NOMBRES_MOCK.map((nombre) => (
            <Boton
              key={nombre}
              variante="secundario"
              cargando={midiendo === nombre}
              disabled={midiendo !== null}
              onClick={() => simular(nombre)}
            >
              {ETIQUETA_MOCK[nombre]}
            </Boton>
          ))}
        </div>
      </div>
    </Pantalla>
  )
}
