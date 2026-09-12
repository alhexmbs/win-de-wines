import type { ReactNode } from 'react'
import type { Nivel } from '../medicion/senal'

/**
 * Sistema de iconos de la app.
 *
 * POR QUÉ EXISTE ESTE ARCHIVO: antes los estados se dibujaban con los emojis
 * 🟢🟡🔴. Un emoji lo pinta la fuente del sistema, no nosotros: en Windows sale
 * de Segoe UI Emoji, en iPhone de Apple Color Emoji y en Android de Noto. Cada
 * uno con distinto tamaño, distinto brillo y distinta línea base, así que el
 * mismo reporte se veía diferente en cada dispositivo y ninguno alineaba con el
 * texto de al lado. Además el color del emoji no es el nuestro: convivía un
 * verde ajeno con el --color-bueno de la marca.
 *
 * Todo lo de aquí es SVG con `currentColor`, así que hereda el color del token
 * que le toque y escala con la tipografía.
 */

export function Icono({
  children,
  className = 'h-6 w-6',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  )
}

/** Cuántas barras se encienden en cada nivel. */
const BARRAS: Record<Nivel, number> = { fuerte: 3, media: 2, debil: 1 }

/**
 * El reemplazo de 🟢🟡🔴: tres barras ascendentes, como la señal de un celular.
 *
 * Se eligió esta forma y no un punto de color porque dice el nivel dos veces
 * —por cuántas barras se encienden y por el color— y así sigue siendo legible
 * para quien no distingue verde de rojo, que es ~8% de los hombres.
 */
export function IconoNivel({
  nivel,
  className = 'h-4 w-4',
}: {
  nivel: Nivel
  className?: string
}) {
  const encendidas = BARRAS[nivel]
  const barras: [number, number, number][] = [
    [3, 15, 6],
    [9.5, 10, 11],
    [16, 5, 16],
  ]

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      {barras.map(([x, y, alto], i) => (
        <rect
          key={x}
          x={x}
          y={y}
          width="5"
          height={alto}
          rx="1.5"
          opacity={i < encendidas ? 1 : 0.2}
        />
      ))}
    </svg>
  )
}

export function IconoCheck({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <Icono className={className}>
      <path d="M4.5 12.75l5.25 5.25L19.5 7.5" />
    </Icono>
  )
}

export function IconoFlecha({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <Icono className={className}>
      <path d="M4 12h15M13 6l6 6-6 6" />
    </Icono>
  )
}

/** Ondas de wifi sobre un punto. Se usa en los avisos de la landing. */
export function IconoWifi({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <Icono className={className}>
      <path d="M5 12.55a11 11 0 0 1 14 0M8.5 16.1a6 6 0 0 1 7 0" />
      <circle cx="12" cy="20" r="1" fill="currentColor" stroke="none" />
    </Icono>
  )
}

export function IconoMas({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <Icono className={className}>
      <path d="M12 5v14M5 12h14" />
    </Icono>
  )
}

export function IconoPapelera({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <Icono className={className}>
      <path d="M4 7h16M10 11v6M14 11v6" />
      <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </Icono>
  )
}

/** Punto de exclamacion en triangulo. Avisos que piden una decision, no errores. */
export function IconoAviso({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <Icono className={className}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4" />
      <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
    </Icono>
  )
}
