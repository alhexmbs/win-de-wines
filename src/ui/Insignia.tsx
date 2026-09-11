import type { Estado } from '../contrato'

const ESTILOS: Record<Estado, string> = {
  bueno: 'bg-bueno-bg text-bueno',
  regular: 'bg-regular-bg text-regular',
  malo: 'bg-malo-bg text-malo',
}

const TEXTO: Record<Estado, string> = {
  bueno: 'Bien',
  regular: 'Regular',
  malo: 'Mal',
}

export function Insignia({ estado }: { estado: Estado }) {
  return (
    <span className={`rounded-full px-3 py-1 text-sm font-bold ${ESTILOS[estado]}`}>
      {TEXTO[estado]}
    </span>
  )
}
