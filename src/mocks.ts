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

/*
 * Aquí vivía reporteMockPara(): elegía uno de los tres reportes enlatados para
 * una sesión cualquiera. Se eliminó porque devolvía texto que hablaba de los
 * cuartos del mock, no de los que el cliente acababa de medir. El doble de
 * api.ts ahora llama a diagnosticar() de reglas.ts sobre las mediciones reales.
 *
 * MOCKS sigue aquí porque lo usa el atajo de demo ?mock= de App.tsx, que sí
 * carga a propósito una sesión de ejemplo completa (sesión + reporte que se
 * corresponden entre sí) para poder mostrar el reporte sin caminar la casa.
 */
