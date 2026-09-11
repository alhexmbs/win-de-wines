/**
 * reglas.ts — B, día 1.
 *
 * Única fuente de verdad para los números del reporte (estado por cuarto,
 * % vs plan, calificación general). El LLM en prompt.ts/generarReporte.ts
 * SOLO reescribe el texto en lenguaje humano a partir de este resultado —
 * nunca inventa ni recalcula los números. Así, si el LLM falla, este mismo
 * reporte (generado_por: 'plantilla') es la respuesta final y ya es correcta.
 */
import type { CuartoReporte, Estado, Medicion, Recomendacion, Reporte, Sesion } from '../contrato.ts'

/** Umbrales absolutos (Mbps) cuando no sabemos el plan contratado. */
const UMBRAL_BUENO_ABS = 50
const UMBRAL_REGULAR_ABS = 15

function estadoDeCuarto(m: Medicion, planMbps: number | null): { estado: Estado; pct: number | null } {
  if (m.error !== undefined) return { estado: 'malo', pct: 0 }

  let estado: Estado
  let pct: number | null = null

  if (planMbps !== null && planMbps > 0) {
    pct = Math.round((m.descarga_mbps / planMbps) * 100)
    estado = pct >= 70 ? 'bueno' : pct >= 30 ? 'regular' : 'malo'
  } else {
    estado =
      m.descarga_mbps >= UMBRAL_BUENO_ABS
        ? 'bueno'
        : m.descarga_mbps >= UMBRAL_REGULAR_ABS
          ? 'regular'
          : 'malo'
  }

  // Latencia o pérdida altas degradan un nivel, aunque la velocidad esté bien.
  const inestable = m.latencia_ms > 100 || (m.perdida_pct ?? 0) > 3
  if (inestable && estado === 'bueno') estado = 'regular'
  else if (inestable && estado === 'regular') estado = 'malo'

  return { estado, pct }
}

function explicacionDeCuarto(m: Medicion, estado: Estado, pct: number | null): string {
  if (m.error !== undefined) return 'El dispositivo no logró conectarse aquí. La señal wifi no llega a este cuarto.'
  const base = pct !== null ? `Llega ${pct}% de la velocidad de tu plan.` : `Se midieron ${m.descarga_mbps} Mbps.`
  if (estado === 'bueno') return `${base} Suficiente para cualquier uso normal.`
  if (estado === 'regular') return `${base} Alcanza para lo básico, pero puede fallar con varios dispositivos conectados o videollamadas.`
  return `${base} Muy por debajo de lo esperado: videos y videollamadas se van a cortar.`
}

function peorEstado(estados: Estado[]): Estado {
  if (estados.includes('malo')) return 'malo'
  if (estados.includes('regular')) return 'regular'
  return 'bueno'
}

/** Función pura: mismos datos de entrada → mismo reporte siempre. Sin red, sin I/O. */
export function diagnosticar(sesion: Sesion): Reporte {
  const { mediciones, contexto } = sesion
  const referencia = mediciones.find((m) => m.es_referencia) ?? mediciones[0]

  const cuartos: CuartoReporte[] = mediciones.map((m) => {
    const { estado, pct } = estadoDeCuarto(m, contexto.plan_mbps)
    return {
      cuarto: m.cuarto,
      estado,
      velocidad_vs_plan_pct: pct,
      explicacion: explicacionDeCuarto(m, estado, pct),
    }
  })

  const { estado: estadoReferencia } = estadoDeCuarto(referencia, contexto.plan_mbps)
  const calificacion_general = peorEstado(cuartos.map((c) => c.estado))

  const fallaEnElOrigen = estadoReferencia !== 'bueno'
  const otrosCuartos = cuartos.filter((c) => c.cuarto !== referencia.cuarto)
  const hayCaidaDeCobertura = !fallaEnElOrigen && otrosCuartos.some((c) => c.estado !== 'bueno')

  let causa_probable: string
  if (fallaEnElOrigen) {
    causa_probable =
      'La señal ya llega débil o inestable justo al lado del router. Esto apunta a un problema de la conexión que WIN entrega a la casa, no del wifi interno.'
  } else if (hayCaidaDeCobertura) {
    causa_probable =
      'Junto al router la señal es buena, pero se pierde en otros cuartos. Es un problema de alcance del wifi dentro de la casa (distancia, paredes o pisos entre el router y esos cuartos).'
  } else {
    causa_probable = 'No se detectaron problemas relevantes: la señal se mantiene estable en toda la casa.'
  }

  const recomendaciones: Recomendacion[] = []
  if (fallaEnElOrigen) {
    recomendaciones.push({
      titulo: 'Revisión técnica de la conexión',
      detalle: 'La velocidad no llega ni junto al router. Se necesita una visita para revisar la instalación o la línea.',
      responsable: 'win',
    })
  }
  if (hayCaidaDeCobertura) {
    recomendaciones.push({
      titulo: 'Repetidor o equipo mesh para los cuartos con mala señal',
      detalle: 'Un segundo punto de wifi cerca de esos cuartos suele resolver la caída de cobertura.',
      responsable: 'win',
    })
    recomendaciones.push({
      titulo: 'Reubica el router a un lugar alto y despejado',
      detalle: 'Sácalo de muebles cerrados o detrás de la TV; mejora el alcance sin costo.',
      responsable: 'cliente',
    })
  }
  if (recomendaciones.length === 0) {
    recomendaciones.push({
      titulo: 'Sin acción pendiente',
      detalle: 'La señal está dentro de lo esperado en todos los cuartos medidos.',
      responsable: 'cliente',
    })
  }

  const nombreCuartoPeor = [...otrosCuartos].sort((a, b) => (a.velocidad_vs_plan_pct ?? 0) - (b.velocidad_vs_plan_pct ?? 0))[0]

  const titular = fallaEnElOrigen
    ? 'La señal llega débil desde el origen'
    : hayCaidaDeCobertura
      ? `Tu internet llega bien, pero no alcanza ${nombreCuartoPeor?.cuarto ?? 'algunos cuartos'}`
      : 'Tu wifi cubre bien toda la casa'

  const resumen = `Calificación general: ${calificacion_general}. ${causa_probable}`

  return {
    version: sesion.version,
    generado_por: 'plantilla',
    calificacion_general,
    titular,
    resumen,
    cuartos,
    causa_probable,
    recomendaciones,
    requiere_visita_tecnica: fallaEnElOrigen,
  }
}
