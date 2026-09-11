import type { Reporte, ResultadoMedicion, Sesion } from './contrato'

import reporteCobertura from '../mocks/reporte_cobertura.json'
import reporteGeneral from '../mocks/reporte_general.json'
import reporteOk from '../mocks/reporte_ok.json'
import sesionCobertura from '../mocks/sesion_cobertura.json'
import sesionGeneral from '../mocks/sesion_general.json'
import sesionOk from '../mocks/sesion_ok.json'

export type NombreMock = 'ok' | 'cobertura' | 'general'

export const NOMBRES_MOCK: NombreMock[] = ['ok', 'cobertura', 'general']

export const ETIQUETA_MOCK: Record<NombreMock, string> = {
  ok: 'Todo bien',
  cobertura: 'Falla de cobertura',
  general: 'Falla general',
}

export const MOCKS: Record<NombreMock, { sesion: Sesion; reporte: Reporte }> = {
  ok: {
    sesion: sesionOk as unknown as Sesion,
    reporte: reporteOk as unknown as Reporte,
  },
  cobertura: {
    sesion: sesionCobertura as unknown as Sesion,
    reporte: reporteCobertura as unknown as Reporte,
  },
  general: {
    sesion: sesionGeneral as unknown as Sesion,
    reporte: reporteGeneral as unknown as Reporte,
  },
}

export function esNombreMock(valor: string | null): valor is NombreMock {
  return valor !== null && (NOMBRES_MOCK as string[]).includes(valor)
}

/** Lo que el componente real de A va a entregar: solo dispositivo + mediciones. */
export function resultadoMock(nombre: NombreMock): ResultadoMedicion {
  const { sesion } = MOCKS[nombre]
  return { dispositivo: sesion.dispositivo, mediciones: sesion.mediciones }
}

/** Elige el reporte mock que mejor calza con una sesión cualquiera. */
export function reporteMockPara(sesion: Sesion): Reporte {
  const referencia = sesion.mediciones.find((m) => m.es_referencia)
  const plan = sesion.contexto.plan_mbps
  if (referencia && plan && referencia.descarga_mbps < plan * 0.35) {
    return MOCKS.general.reporte
  }
  const hayCuartoMalo = sesion.mediciones.some(
    (m) => m.error !== undefined || (plan !== null && m.descarga_mbps < plan * 0.2),
  )
  return hayCuartoMalo ? MOCKS.cobertura.reporte : MOCKS.ok.reporte
}
