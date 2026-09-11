import { useState } from 'react'
import { ErrorApi, enviarReporte, obtenerReporte } from './api'
import type { Contacto, Contexto, Reporte as TipoReporte, ResultadoMedicion, Sesion } from './contrato'
import { crearSesion, nuevoSesionId } from './contrato'
import { MOCKS, esNombreMock } from './mocks'
import { Analizando } from './pantallas/Analizando'
import { Bienvenida } from './pantallas/Bienvenida'
import { Confirmacion } from './pantallas/Confirmacion'
import { Enviar } from './pantallas/Enviar'
import { ErrorPantalla } from './pantallas/ErrorPantalla'
import { Onboarding } from './pantallas/Onboarding'
import { Reporte } from './pantallas/Reporte'

/**
 * INTEGRACIÓN 1 — única línea que cambia para conectar lo de A:
 *   import { FlujoMedicion } from './medicion/FlujoMedicion'
 * y usarlo abajo en lugar de FlujoMedicionFalso. Mismas props.
 */
import { FlujoMedicionFalso as FlujoMedicion } from './dobles/FlujoMedicionFalso'

type Paso =
  | 'bienvenida'
  | 'onboarding'
  | 'medicion'
  | 'analizando'
  | 'reporte'
  | 'enviar'
  | 'confirmacion'

interface EstadoApp {
  paso: Paso
  sesionId: string
  inicio: string
  contexto: Contexto | null
  sesion: Sesion | null
  reporte: TipoReporte | null
  ticket: string | null
  guardado: boolean
  error: string | null
  enviando: boolean
}

function estadoInicial(): EstadoApp {
  const base: EstadoApp = {
    paso: 'bienvenida',
    sesionId: nuevoSesionId(),
    inicio: new Date().toISOString(),
    contexto: null,
    sesion: null,
    reporte: null,
    ticket: null,
    guardado: false,
    error: null,
    enviando: false,
  }

  /** Atajo de demo: ?mock=ok | cobertura | general arranca en el reporte. */
  const nombre = new URLSearchParams(window.location.search).get('mock')
  if (!esNombreMock(nombre)) return base

  const { sesion, reporte } = MOCKS[nombre]
  return { ...base, paso: 'reporte', sesion, reporte, contexto: sesion.contexto }
}

function mensajeDeError(e: unknown, porDefecto: string): string {
  if (e instanceof ErrorApi) return `${porDefecto} (${e.estado}). ${e.message}`.slice(0, 300)
  if (e instanceof DOMException && e.name === 'AbortError') {
    return `${porDefecto} La conexión tardó demasiado. Revisa tu señal y reintenta.`
  }
  if (e instanceof Error) return `${porDefecto} ${e.message}`
  return porDefecto
}

export default function App() {
  const [s, setS] = useState<EstadoApp>(estadoInicial)

  function reiniciar() {
    setS(estadoInicial())
  }

  function alTerminarOnboarding(contexto: Contexto) {
    setS((prev) => ({ ...prev, contexto, paso: 'medicion' }))
  }

  /** Punto de unión con A: su ResultadoMedicion + el contexto de C = Sesion. */
  async function alTerminarMedicion(resultado: ResultadoMedicion) {
    if (s.contexto === null) return
    const sesion = crearSesion(s.contexto, resultado, s.inicio, s.sesionId)
    setS((prev) => ({ ...prev, sesion, paso: 'analizando', error: null }))
    await pedirReporte(sesion)
  }

  /** Punto de unión con B: /api/reporte. Hoy lo cubre el doble en api.ts. */
  async function pedirReporte(sesion: Sesion) {
    try {
      const reporte = await obtenerReporte(sesion)
      setS((prev) => ({ ...prev, reporte, paso: 'reporte' }))
    } catch (e) {
      setS((prev) => ({
        ...prev,
        error: mensajeDeError(e, 'No pudimos generar tu reporte.'),
      }))
    }
  }

  async function confirmarEnvio(contacto: Contacto) {
    if (s.sesion === null || s.reporte === null) return
    setS((prev) => ({ ...prev, enviando: true, error: null }))
    try {
      const res = await enviarReporte(s.sesion, s.reporte, contacto)
      setS((prev) => ({
        ...prev,
        enviando: false,
        ticket: res.ticket,
        guardado: res.guardado,
        paso: 'confirmacion',
      }))
    } catch (e) {
      setS((prev) => ({
        ...prev,
        enviando: false,
        error: mensajeDeError(e, 'No pudimos enviar tu reporte.'),
      }))
    }
  }

  if (s.error !== null) {
    return (
      <ErrorPantalla
        mensaje={s.error}
        onReintentar={() => {
          setS((prev) => ({ ...prev, error: null }))
          if (s.paso === 'analizando' && s.sesion !== null) void pedirReporte(s.sesion)
        }}
        onVolver={reiniciar}
      />
    )
  }

  switch (s.paso) {
    case 'bienvenida':
      return <Bienvenida onEmpezar={() => setS((prev) => ({ ...prev, paso: 'onboarding' }))} />

    case 'onboarding':
      return <Onboarding onListo={alTerminarOnboarding} />

    case 'medicion':
      return <FlujoMedicion onTerminar={(r) => void alTerminarMedicion(r)} />

    case 'analizando':
      return <Analizando />

    case 'reporte':
      if (s.sesion === null || s.reporte === null) return <Bienvenida onEmpezar={reiniciar} />
      return (
        <Reporte
          sesion={s.sesion}
          reporte={s.reporte}
          onEnviar={() => setS((prev) => ({ ...prev, paso: 'enviar' }))}
          /* DÍA 2: mapa={<MapaCalor sesion={s.sesion} reporte={s.reporte} />} */
          /* DÍA 2: chat={<Chat sesion={s.sesion} reporte={s.reporte} />} */
        />
      )

    case 'enviar':
      return (
        <Enviar
          cargando={s.enviando}
          onConfirmar={(c) => void confirmarEnvio(c)}
          onCancelar={() => setS((prev) => ({ ...prev, paso: 'reporte' }))}
        />
      )

    case 'confirmacion':
      return (
        <Confirmacion
          ticket={s.ticket ?? '—'}
          guardado={s.guardado}
          onVerReporte={() => setS((prev) => ({ ...prev, paso: 'reporte' }))}
          onEmpezarDeNuevo={reiniciar}
        />
      )
  }
}
