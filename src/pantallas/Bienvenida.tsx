import { Boton } from '../ui/Boton'
import { IconoFlecha, IconoWifi } from '../ui/Iconos'
import { CabeceraWin } from '../ui/CabeceraWin'
import { PieWin } from '../ui/PieWin'

const PASOS: [string, string][] = [
  ['Cuéntanos de tu casa', 'Tres preguntas rápidas sobre tu plan y tu vivienda.'],
  ['Empieza junto al router', 'Esa primera medición es la referencia de tu casa.'],
  ['Camina cuarto por cuarto', 'Marcas dónde estás y medimos la señal en ese punto.'],
  ['Recibe tu reporte', 'Qué anda mal, por qué, y cómo se arregla.'],
]

/** Muestra de salida: casa de dos pisos con el router en la sala. */
const MUESTRA: [string, number][] = [
  ['Sala', 100],
  ['Comedor', 74],
  ['Cocina', 32],
  ['Estudio, 2.º piso', 4],
]

function colorDe(pct: number): string {
  if (pct >= 60) return 'bg-bueno'
  if (pct >= 25) return 'bg-regular'
  return 'bg-malo'
}

/** Ondas concéntricas de fondo. El contenedor las recorta contra la esquina. */
function Ondas() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      className="pointer-events-none absolute -top-12 -right-12 h-48 w-48 text-white/20 md:-top-20 md:-right-16 md:h-80 md:w-80"
    >
      <g fill="none" stroke="currentColor" strokeWidth="5">
        <circle cx="50" cy="50" r="14" />
        <circle cx="50" cy="50" r="28" />
        <circle cx="50" cy="50" r="42" />
      </g>
      <circle cx="50" cy="50" r="5" fill="currentColor" />
    </svg>
  )
}

/** Una de las dos conclusiones posibles del diagnóstico. */
function Respuesta({
  condicion,
  explicacion,
  salida,
  responsable,
}: {
  condicion: string
  explicacion: string
  salida: string
  responsable: 'win' | 'cliente'
}) {
  return (
    <div className="border-l-4 border-win-500 pl-5">
      <p className="text-[15px] font-bold text-win-900">{condicion}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{explicacion}</p>
      <p className="mt-3 flex gap-2 text-sm font-semibold text-win-700">
        <IconoFlecha className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {salida}{' '}
          <span className="font-normal text-gray-500">
            {responsable === 'win' ? '(lo resuelve WIN)' : '(lo resuelves tú)'}
          </span>
        </span>
      </p>
    </div>
  )
}

export function Bienvenida({ onEmpezar }: { onEmpezar: () => void }) {
  return (
    <div className="flex min-h-[100svh] flex-col">
      <CabeceraWin />

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-7 md:px-8 md:py-12">
        {/* ── Hero ── */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-win-600 to-win-500 px-6 py-8 text-white shadow-xl shadow-win-700/25 md:px-12 md:py-14 lg:px-14 lg:py-16">
          <Ondas />
          <h1 className="relative max-w-2xl text-[2.1rem] leading-[1.08] font-bold md:text-5xl lg:text-6xl">
            Descubre en qué cuarto se te cae el wifi
          </h1>
          <p className="relative mt-5 max-w-xl text-[15px] leading-relaxed text-white/90 md:text-lg lg:text-xl">
            Camina por tu casa con el celular en la mano. Al terminar sabrás dónde falla tu señal,
            por qué falla y qué hacer al respecto.
          </p>
          <p className="relative mt-5 text-sm text-white/75">
            Toma unos 5 minutos y no instalas nada.
          </p>

          <div className="relative mt-7 hidden md:block">
            <Boton
              onClick={onEmpezar}
              className="md:w-auto md:bg-white md:px-12 md:text-win-700 md:shadow-none md:hover:bg-win-50"
            >
              Empezar ahora
            </Boton>
          </div>
        </section>

        {/* ── Lo que recibes: la salida real, no una promesa ── */}
        <section className="mt-10 grid gap-8 md:mt-14 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-14">
          <div className="rounded-3xl bg-white p-5 shadow-lg shadow-win-900/5 ring-1 ring-win-200/50 md:p-7">
            <p className="font-bold text-win-900">Cuánto de tu señal llega a cada cuarto</p>
            <p className="mt-1 text-sm leading-snug text-gray-500">
              Comparado con la medición que tomaste junto al router, que en esta casa está en la
              sala.
            </p>

            <ul className="mt-6 space-y-4">
              {MUESTRA.map(([cuarto, pct]) => (
                <li key={cuarto}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-[15px] font-semibold text-win-900">{cuarto}</p>
                    <p className="shrink-0 text-sm font-bold text-win-900 tabular-nums">{pct}%</p>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-win-50">
                    <div
                      className={`h-full rounded-full ${colorDe(pct)}`}
                      style={{ width: `${Math.max(2, pct)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>

            <p className="mt-6 border-t border-win-200/70 pt-4 text-xs leading-relaxed text-gray-500">
              No leemos la señal de tu wifi: ningún navegador lo permite, por privacidad. Medimos
              cuánto tarda en llegarte la información, que es exactamente lo que sientes cuando algo
              va lento.
            </p>
          </div>

          <div>
            <h2 className="text-2xl leading-tight font-bold text-win-900 md:text-3xl">
              Un número suelto no dice nada
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-gray-600 md:text-base">
              Si en tu dormitorio salen 40 Mbps, ¿eso es bueno o malo? No hay forma de saberlo sin
              conocer cuánto había disponible para empezar. Por eso la primera medición se toma
              pegado al router: ese es el techo de tu casa, y todo lo demás se lee contra él.
            </p>

            <div className="mt-7 space-y-6">
              <Respuesta
                condicion="Si ya falla junto al router"
                explicacion="Ni siquiera a un metro hay buena conexión. Entonces el wifi no es el problema: lo que llega desde la calle viene mal."
                salida="Revisión del servicio"
                responsable="win"
              />
              <Respuesta
                condicion="Si solo falla en algunos cuartos"
                explicacion="La casa sí recibe buen internet, pero la señal no logra llegar hasta ahí. Paredes, distancia, o el router mal ubicado."
                salida="Repetidor, mover el router o cambiar de canal"
                responsable="cliente"
              />
            </div>
          </div>
        </section>

        {/* ── Cómo funciona ── */}
        <h2 className="mt-12 text-xl font-bold text-win-900 md:mt-16 md:text-2xl">Cómo funciona</h2>
        <ol className="mt-4 grid gap-2.5 md:grid-cols-2 md:gap-3 lg:grid-cols-4">
          {PASOS.map(([titulo, texto], i) => (
            <li
              key={titulo}
              className="flex gap-3.5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-win-200/40 lg:flex-col lg:gap-3 lg:p-5"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-win-100 text-sm font-bold text-win-700">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-win-900">{titulo}</p>
                <p className="mt-0.5 text-sm leading-snug text-gray-600">{texto}</p>
              </div>
            </li>
          ))}
        </ol>

        {/* ── Aviso ── */}
        <div className="mt-8 flex gap-3 rounded-2xl border border-win-200 bg-win-100/70 p-4 md:p-5">
          <span className="mt-0.5 shrink-0 text-win-600">
            <IconoWifi />
          </span>
          <p className="text-sm leading-snug text-win-900 md:text-[15px]">
            <strong className="font-bold">Antes de empezar:</strong> conéctate al wifi de tu casa, no
            a tus datos móviles, y ubica dónde está tu router. La primera medición se toma a su lado.
          </p>
        </div>
      </main>

      <PieWin />

      {/* En celular el botón vive fijo abajo; en escritorio ya está en el hero. */}
      <div className="sticky bottom-0 border-t border-win-200 bg-white/90 px-5 py-4 backdrop-blur md:hidden">
        <Boton onClick={onEmpezar}>Empezar</Boton>
      </div>
    </div>
  )
}
