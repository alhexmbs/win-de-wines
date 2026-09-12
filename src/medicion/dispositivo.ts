import type { Dispositivo } from '../contrato'

/**
 * Lo que el navegador deja saber del dispositivo. Todo es best-effort:
 * navigator.connection no existe en Safari/iOS ni en Firefox, y `type` —el único
 * campo que separa wifi de celular— tampoco está garantizado en Chrome de
 * escritorio. Por eso 'desconocida' es el resultado normal y el flujo le
 * pregunta al usuario en vez de adivinar.
 */

interface ConexionRed {
  type?: string
  effectiveType?: string
  downlink?: number
  rtt?: number
  saveData?: boolean
}

function conexionRed(): ConexionRed | undefined {
  const nav = navigator as Navigator & {
    connection?: ConexionRed
    mozConnection?: ConexionRed
    webkitConnection?: ConexionRed
  }
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection
}

function clasificar(tipo: string | undefined): Dispositivo['conexion'] {
  if (tipo === 'wifi' || tipo === 'ethernet') return 'wifi'
  if (tipo === 'cellular') return 'celular'
  return 'desconocida'
}

const NAVEGADORES: [string, RegExp][] = [
  ['Edge', /Edg(?:e|A|iOS)?\/(\d+)/],
  ['Opera', /OPR\/(\d+)/],
  ['Samsung Internet', /SamsungBrowser\/(\d+)/],
  ['Firefox', /(?:Firefox|FxiOS)\/(\d+)/],
  ['Chrome', /(?:Chrome|CriOS)\/(\d+)/],
  ['Safari', /Version\/(\d+).*Safari/],
]

const SISTEMAS: [string, RegExp][] = [
  ['Android', /Android/],
  ['iPadOS', /iPad/],
  ['iOS', /iPhone|iPod/],
  ['Windows', /Windows NT/],
  ['macOS', /Mac OS X/],
  ['Linux', /Linux/],
]

/** Formato "Chrome 141 / Android", igual que en los mocks. */
export function describirNavegador(ua: string = navigator.userAgent): string {
  let nombre = 'Navegador'
  let version = ''
  for (const [n, re] of NAVEGADORES) {
    const m = re.exec(ua)
    if (m !== null) {
      nombre = n
      version = m[1]
      break
    }
  }

  let so = 'desconocido'
  for (const [s, re] of SISTEMAS) {
    if (re.test(ua)) {
      so = s
      break
    }
  }

  return `${nombre}${version === '' ? '' : ` ${version}`} / ${so}`
}

export function detectarDispositivo(): Dispositivo {
  const c = conexionRed()
  const d: Dispositivo = {
    conexion: clasificar(c?.type),
    navegador: describirNavegador(),
  }

  if (c?.effectiveType !== undefined) d.effective_type = c.effectiveType
  if (c?.downlink !== undefined) d.downlink_mbps = c.downlink
  if (c?.rtt !== undefined) d.rtt_ms = c.rtt
  if (c?.saveData !== undefined) d.ahorro_datos = c.saveData

  return d
}

/** true = el navegador sí sabe distinguir wifi de datos móviles. */
export function sabeDistinguirConexion(): boolean {
  return conexionRed()?.type !== undefined
}

/** navigator.connection cambia durante la caminata; nos quedamos con lo último. */
export function datosDeRedFrescos(): Partial<Dispositivo> {
  const d = detectarDispositivo()
  const fresco: Partial<Dispositivo> = {
    effective_type: d.effective_type,
    downlink_mbps: d.downlink_mbps,
    rtt_ms: d.rtt_ms,
    ahorro_datos: d.ahorro_datos,
  }
  if (sabeDistinguirConexion()) fresco.conexion = d.conexion
  return fresco
}
