import { useEffect, useRef, useState } from 'react'

/**
 * Mantiene la pantalla encendida mientras el cliente camina midiendo.
 *
 * Dos cosas que rompen esto y no son bugs:
 *  - Necesita contexto seguro. En http://192.168.x.x:5173 (celular por LAN)
 *    NO funciona; hace falta el preview de Vercel en https.
 *  - El sistema suelta el bloqueo cuando la pestaña deja de verse, así que hay
 *    que volver a pedirlo en cada visibilitychange.
 */

interface CentinelaWakeLock {
  released: boolean
  release(): Promise<void>
}

interface ApiWakeLock {
  request(tipo: 'screen'): Promise<CentinelaWakeLock>
}

function apiWakeLock(): ApiWakeLock | undefined {
  return (navigator as unknown as { wakeLock?: ApiWakeLock }).wakeLock
}

export type EstadoWakeLock = 'inactivo' | 'activo' | 'no_disponible'

export function useWakeLock(activo: boolean): EstadoWakeLock {
  const centinela = useRef<CentinelaWakeLock | null>(null)
  const [estado, setEstado] = useState<EstadoWakeLock>('inactivo')

  useEffect(() => {
    const api = apiWakeLock()
    if (api === undefined) {
      setEstado('no_disponible')
      return
    }
    if (!activo) return

    // Copia ya estrechada: dentro de una function declaration TS pierde el narrowing.
    const wl = api
    let vivo = true

    async function pedir() {
      if (!vivo || document.visibilityState !== 'visible') return
      try {
        centinela.current = await wl.request('screen')
        if (!vivo) {
          void centinela.current.release().catch(() => undefined)
          return
        }
        setEstado('activo')
      } catch {
        setEstado('no_disponible')
      }
    }

    function alCambiarVisibilidad() {
      if (centinela.current === null || centinela.current.released) void pedir()
    }

    void pedir()
    document.addEventListener('visibilitychange', alCambiarVisibilidad)

    return () => {
      vivo = false
      document.removeEventListener('visibilitychange', alCambiarVisibilidad)
      void centinela.current?.release().catch(() => undefined)
      centinela.current = null
      setEstado('inactivo')
    }
  }, [activo])

  return estado
}
