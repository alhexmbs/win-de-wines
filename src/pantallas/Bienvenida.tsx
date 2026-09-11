import { Boton } from '../ui/Boton'
import { Pantalla } from '../ui/Pantalla'

export function Bienvenida({ onEmpezar }: { onEmpezar: () => void }) {
  return (
    <Pantalla
      titulo="Mide el wifi de tu casa"
      bajada="En 5 minutos sabrás en qué cuartos falla tu señal y por qué."
      pie={<Boton onClick={onEmpezar}>Empezar</Boton>}
    >
      <ol className="space-y-4">
        {[
          ['1', 'Cuéntanos de tu casa', 'Tres preguntas rápidas sobre tu plan y tu vivienda.'],
          ['2', 'Camina cuarto por cuarto', 'Marcas dónde estás y medimos la señal en ese punto.'],
          ['3', 'Recibe tu reporte', 'Qué anda mal, por qué y cómo se arregla.'],
          ['4', 'Envíalo a WIN', 'En un click, sin estrés.'],
        ].map(([n, titulo, texto]) => (
          <li key={n} className="flex gap-4 rounded-2xl bg-white p-4 shadow-sm">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-win-100 font-bold text-win-700">
              {n}
            </span>
            <div>
              <p className="font-semibold text-win-900">{titulo}</p>
              <p className="text-sm text-gray-600">{texto}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-6 rounded-xl bg-win-100 p-4 text-sm text-win-900">
        <strong>Antes de empezar:</strong> conéctate al wifi de tu casa. Asegúrate de no estar conectado a tus datos móviles
        y ten a la mano dónde está tu router.
      </p>
    </Pantalla>
  )
}
