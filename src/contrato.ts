/**
 * contrato.ts — v1.1
 *
 * Regla 1: cada campo tiene UN solo dueño (anotado abajo).
 * Regla 2: el contrato SOLO CRECE. Durante el día 1 no se renombra ni se borra
 *          un campo; lo nuevo entra como opcional y se avisa en el grupo.
 */

export const VERSION_CONTRATO = '1.1'

/* ───────────── A — src/medicion/ ───────────── */

/**
 * Detectado por A con las APIs del navegador (navigator.connection, userAgent).
 *
 * Ojo: navigator.connection NO existe en Safari/iOS ni en Firefox, y `type`
 * (el único campo que distingue wifi de celular) tampoco está garantizado en
 * Chrome de escritorio. Por eso `conexion: 'desconocida'` es el caso normal,
 * no la excepción, y A además le pregunta al usuario.
 */
export interface Dispositivo {
  conexion: 'wifi' | 'celular' | 'desconocida'
  navegador: string
  /** true = el usuario confirmó a mano que está en el wifi de su casa. */
  conexion_confirmada?: boolean
  /** Network Information API. Referencial: Chrome redondea y topea downlink. */
  effective_type?: string
  downlink_mbps?: number
  rtt_ms?: number
  ahorro_datos?: boolean
}

/**
 * Un punto suelto medido dentro de una habitación. Varios puntos en el mismo
 * cuarto = resultado más confiable (el wifi cambia dentro de un mismo cuarto:
 * junto a la ventana no es lo mismo que detrás del refrigerador).
 */
export interface Punto {
  timestamp: string
  descarga_mbps: number
  latencia_ms: number
  jitter_ms: number
  perdida_pct?: number
  /** 0-100 vs la medición de referencia junto al router. Ver senal.ts. */
  indice?: number
  /** Datos gastados en este punto. Se suman para el contador de la caminata. */
  bytes?: number
  error?: string
}

/**
 * Ping suelto tomado mientras el usuario camina, para el semáforo en vivo.
 * No es RSSI: ningún navegador expone la potencia del radio wifi. Es el tiempo
 * de ida y vuelta a un archivo de 3 bytes, que se degrada donde el wifi flojea.
 */
export interface MuestraRecorrido {
  t: string
  cuarto: string
  piso: number
  /** null = el ping no respondió dentro del timeout. */
  latencia_ms: number | null
}

/** Una medición = un cuarto. A produce una por cada parada de la caminata. */
export interface Medicion {
  cuarto: string
  /** true = medición tomada junto al router (línea base de la casa). */
  es_referencia: boolean
  /** ISO 8601. */
  timestamp: string
  descarga_mbps: number
  latencia_ms: number
  jitter_ms: number
  /** % de pings sin respuesta dentro del timeout. No es pérdida de paquetes ICMP. */
  perdida_pct?: number
  muestras?: number
  /** Cuántos bytes y en cuánto tiempo salió descarga_mbps. Sirve para descartar
   *  mediciones demasiado cortas para ser confiables. */
  bytes_descargados?: number
  duracion_ms?: number
  /** Si el test falló en ese cuarto (sin señal, timeout, etc.). */
  error?: string
  /** Piso de la vivienda. 1 = planta baja. Ausente = casa de un piso. */
  piso?: number
  /** Los puntos individuales que se promediaron para esta medición. */
  puntos?: Punto[]
  /** 0-100 vs la referencia junto al router. Es lo que pinta el mapa de calor. */
  indice?: number
}

/** Lo único que A entrega al terminar la caminata. */
export interface ResultadoMedicion {
  dispositivo: Dispositivo
  mediciones: Medicion[]
  /** Pings continuos de la caminata. Solo alimenta el mapa; B puede ignorarlo. */
  recorrido?: MuestraRecorrido[]
}

/* ───────────── C — onboarding + armado ───────────── */

/** Lo que el cliente responde en el onboarding. WIN no nos da estos datos. */
export interface Contexto {
  plan_mbps: number | null
  tipo_vivienda: 'casa' | 'departamento'
  pisos: number
}

/** C junta lo suyo con el ResultadoMedicion de A. Esto es lo que consume B. */
export interface Sesion {
  version: string
  sesion_id: string
  inicio: string
  contexto: Contexto
  dispositivo: Dispositivo
  mediciones: Medicion[]
  /** Pings de la caminata. Opcional: las sesiones del día 1 no lo traen. */
  recorrido?: MuestraRecorrido[]
}

/* ───────────── B — src/diagnostico/ + api/reporte.ts ───────────── */

export type Estado = 'bueno' | 'regular' | 'malo'

export interface CuartoReporte {
  cuarto: string
  estado: Estado
  /** % de la velocidad del plan que llega a ese cuarto. null si no hay plan. */
  velocidad_vs_plan_pct: number | null
  /** Una o dos frases, lenguaje de cliente, sin jerga. */
  explicacion: string
}

export interface Recomendacion {
  titulo: string
  detalle: string
  responsable: 'cliente' | 'win'
}

export interface Reporte {
  version: string
  /** 'plantilla' = el LLM falló y se usó el respaldo por reglas. */
  generado_por: 'ia' | 'plantilla'
  calificacion_general: Estado
  titular: string
  resumen: string
  cuartos: CuartoReporte[]
  causa_probable: string
  recomendaciones: Recomendacion[]
  requiere_visita_tecnica: boolean
}

/* ───────────── C — envío ───────────── */

export interface Contacto {
  nombre: string
  telefono: string
}

export interface SolicitudEnvio {
  sesion: Sesion
  reporte: Reporte
  contacto: Contacto
}

export interface RespuestaEnvio {
  ok: boolean
  ticket: string
  /** false = se generó el ticket pero no se pudo persistir (modo demo). */
  guardado: boolean
}

/* ───────────── Helpers de C ───────────── */

export function nuevoSesionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/** Punto exacto donde lo de C y lo de A se juntan. */
export function crearSesion(
  contexto: Contexto,
  resultado: ResultadoMedicion,
  inicio: string,
  sesionId: string,
): Sesion {
  return {
    version: VERSION_CONTRATO,
    sesion_id: sesionId,
    inicio,
    contexto,
    dispositivo: resultado.dispositivo,
    mediciones: resultado.mediciones,
    ...(resultado.recorrido === undefined ? {} : { recorrido: resultado.recorrido }),
  }
}
