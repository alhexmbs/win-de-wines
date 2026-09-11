import type { ReactNode } from 'react'

/**
 * Pie de la landing, con estructura de sitio en producción.
 *
 * PENDIENTE antes de mostrarlo como algo real: los href son marcadores. Hay que
 * reemplazarlos por las URLs de WIN, o quitar la columna que no aplique. No se
 * inventan aquí ni teléfonos de atención ni la URL del Libro de Reclamaciones:
 * un dato falso de una operadora real manda gente al lugar equivocado.
 */

const COLUMNAS: [string, string[]][] = [
  ['WinTest', ['Cómo funciona', 'Qué medimos', 'Preguntas frecuentes']],
  ['Ayuda', ['Centro de ayuda', 'Contáctanos', 'Estado del servicio']],
  ['Legal', ['Términos y condiciones', 'Política de privacidad', 'Libro de reclamaciones']],
]

const REDES: [string, string][] = [
  [
    'Facebook',
    'M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z',
  ],
  ['X', 'M4 4l16 16M20 4L4 20'],
  [
    'YouTube',
    'M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33zM9.75 15.02V8.48l5.75 3.27-5.75 3.27z',
  ],
]

function Instagram() {
  return (
    <>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <path d="M17.5 6.5h.01" />
    </>
  )
}

function IconoRed({ nombre, children }: { nombre: string; children: ReactNode }) {
  return (
    <a
      href="#"
      aria-label={nombre}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-win-100 transition hover:bg-win-500 hover:text-white"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        {children}
      </svg>
    </a>
  )
}

export function PieWin() {
  return (
    <footer className="bg-win-900 text-win-100">
      <div className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)] lg:gap-8">
          <div>
            <img src="/logo.png" alt="WIN" className="h-7 w-auto brightness-0 invert" />
            <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-win-100/70">
              Mide la calidad de tu wifi cuarto por cuarto desde el navegador, sin instalar nada, y
              envíale el reporte a WIN en un clic.
            </p>

            <div className="mt-6 flex gap-2.5">
              <IconoRed nombre="Instagram">
                <Instagram />
              </IconoRed>
              {REDES.map(([nombre, d]) => (
                <IconoRed key={nombre} nombre={nombre}>
                  <path d={d} />
                </IconoRed>
              ))}
            </div>
          </div>

          {COLUMNAS.map(([titulo, enlaces]) => (
            <nav key={titulo} aria-label={titulo}>
              <p className="text-xs font-bold tracking-[0.1em] text-win-500 uppercase">{titulo}</p>
              <ul className="mt-4 space-y-2.5">
                {enlaces.map((texto) => (
                  <li key={texto}>
                    <a
                      href="#"
                      className="text-[15px] text-win-100/75 transition hover:text-white hover:underline hover:underline-offset-4"
                    >
                      {texto}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 text-sm text-win-100/50 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} WIN. Todos los derechos reservados.</p>
          <p>Prototipo · Reto 01 · Hackatón WIN Chiclayo</p>
        </div>
      </div>
    </footer>
  )
}
