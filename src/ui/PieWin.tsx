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

/**
 * Marcas de las redes, como paths de RELLENO.
 *
 * Antes se dibujaban con `fill="none" stroke="currentColor"`, pero los paths de
 * Facebook y YouTube son siluetas cerradas: al trazarlas salia el contorno
 * hueco del logo en vez del logo. Y la de X era `M4 4l16 16M20 4L4 20`, o sea
 * dos rayas cruzadas — una equis cualquiera, no la marca.
 */
const REDES: [string, string][] = [
  [
    'Instagram',
    'M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.43.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.43.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.43-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.43-.16 1.06-.36 2.23-.41 1.27-.06 1.65-.07 4.85-.07zm0 2.16c-3.14 0-3.51.01-4.75.07-1.15.05-1.77.24-2.18.4-.55.21-.94.47-1.35.88-.41.41-.67.8-.88 1.35-.16.41-.35 1.03-.4 2.18-.06 1.24-.07 1.61-.07 4.75s.01 3.51.07 4.75c.05 1.15.24 1.77.4 2.18.21.55.47.94.88 1.35.41.41.8.67 1.35.88.41.16 1.03.35 2.18.4 1.24.06 1.61.07 4.75.07s3.51-.01 4.75-.07c1.15-.05 1.77-.24 2.18-.4.55-.21.94-.47 1.35-.88.41-.41.67-.8.88-1.35.16-.41.35-1.03.4-2.18.06-1.24.07-1.61.07-4.75s-.01-3.51-.07-4.75c-.05-1.15-.24-1.77-.4-2.18a3.6 3.6 0 0 0-.88-1.35 3.6 3.6 0 0 0-1.35-.88c-.41-.16-1.03-.35-2.18-.4-1.24-.06-1.61-.07-4.75-.07zm0 3.67a6.17 6.17 0 1 1 0 12.34 6.17 6.17 0 0 1 0-12.34zm0 2.17a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm6.41-3.85a1.44 1.44 0 1 1 0 2.88 1.44 1.44 0 0 1 0-2.88z',
  ],
  [
    'Facebook',
    'M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.49-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.45 2.91h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94z',
  ],
  [
    'X',
    'M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-5.22-6.82-5.96 6.82H1.68l7.73-8.84L1.25 2.25h6.83l4.71 6.23zm-1.16 17.52h1.83L7.08 4.13H5.12z',
  ],
  [
    'YouTube',
    'M23.5 6.2a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.51A3.02 3.02 0 0 0 .5 6.2C0 8.07 0 12 0 12s0 3.93.5 5.8a3.02 3.02 0 0 0 2.12 2.14c1.88.51 9.38.51 9.38.51s7.5 0 9.38-.51a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.8zM9.55 15.57V8.43L15.82 12z',
  ],
]

function IconoRed({ nombre, d }: { nombre: string; d: string }) {
  return (
    <a
      href="#"
      aria-label={nombre}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-win-100 transition hover:bg-win-500 hover:text-white"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d={d} />
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
              {REDES.map(([nombre, d]) => (
                <IconoRed key={nombre} nombre={nombre} d={d} />
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
