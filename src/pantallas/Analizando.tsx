import { useEffect, useState } from 'react'
import { Pantalla } from '../ui/Pantalla'

const PASOS = [
  'Ordenando tus mediciones…',
  'Comparando cada cuarto con la referencia del router…',
  'Buscando el patrón de la falla…',
  'Escribiendo tu reporte…',
]

export function Analizando() {
  const [i, setI] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setI((n) => Math.min(n + 1, PASOS.length - 1)), 1600)
    return () => clearInterval(id)
  }, [])

  return (
    <Pantalla paso={3}>
      <div className="flex min-h-[70svh] flex-col items-center justify-center text-center">
        <div className="h-14 w-14 animate-spin rounded-full border-4 border-win-200 border-t-win-700" />
        <h1 className="mt-8 text-2xl font-bold text-win-900">Analizando tu casa</h1>
        <p className="mt-3 min-h-12 text-gray-600" aria-live="polite">
          {PASOS[i]}
        </p>
        <p className="mt-6 text-sm text-gray-500">Esto toma unos segundos. No cierres la pantalla.</p>
      </div>
    </Pantalla>
  )
}
