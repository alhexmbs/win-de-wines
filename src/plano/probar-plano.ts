/**
 * probar-plano.ts — el estado de la caminata sobre plano, sin navegador.
 *
 *   pnpm probar:plano                    reglas del reducer + recorrido de ejemplo
 *   pnpm probar:plano --escribir-mock    además regenera mocks/sesion_plano.json
 *
 * Sale con código 1 si alguna comprobación falla. El mock sale del MISMO
 * recorrido que se comprueba aquí, así que no pueden desalinearse.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import type { Contexto, Dispositivo, Medicion, Punto, Sesion } from '../contrato.ts'
import { crearSesion } from '../contrato.ts'
import { diagnosticar } from '../diagnostico/reglas.ts'
import { type Parada, PISO_MAXIMO, consolidar } from '../medicion/caminata.ts'
import { type Nivel, nivelDeIndice } from '../medicion/senal.ts'
import {
  type Accion,
  type EstadoPlano,
  buscarHabitacion,
  esEstadoPlano,
  estadoDesdeSesion,
  estadoInicial,
  habitacionDelRouter,
  habitacionPorId,
  habitacionesDelPiso,
  hayReferencia,
  indicesPorPunto,
  paradasDe,
  puntosDe,
  reducirPlano,
  resultadoDelPlano,
} from './estado.ts'
import { contiene, redondear, sePisan } from './geometria.ts'
import { borrarRecorrido, cargarRecorrido, guardarRecorrido } from './persistencia.ts'
import {
  ANCHO_MAXIMO,
  ANCHO_MINIMO,
  acercar,
  recortarTexto,
  tamanoTexto,
  vistaParaPiso,
} from './vista.ts'

const RUTA_MOCK = 'mocks/sesion_plano.json'
const MB = 1024 * 1024
const INICIO = '2026-09-12T18:00:00.000Z'
const CONTEXTO: Contexto = { plan_mbps: 200, tipo_vivienda: 'casa', pisos: 2 }
const DISPOSITIVO: Dispositivo = {
  conexion: 'wifi',
  navegador: 'Chrome 141 / Android',
  conexion_confirmada: true,
}

/** Solo para la salida de terminal de este script; la app usa <IconoNivel>. */
const EMOJI_NIVEL: Record<Nivel, string> = {
  fuerte: '🟢',
  media: '🟡',
  debil: '🔴',
}

let fallas = 0

function comprobar(ok: boolean, que: string): void {
  if (ok) {
    console.log(`  ✓ ${que}`)
  } else {
    fallas++
    console.log(`  ✗ ${que}`)
  }
}

function aplicar(estado: EstadoPlano, ...acciones: Accion[]): EstadoPlano {
  return acciones.reduce(reducirPlano, estado)
}

/** Habitación que la prueba da por existente. Si no está, la prueba está mal escrita. */
function habitacion(estado: EstadoPlano, piso: number, nombre: string) {
  const h = buscarHabitacion(estado, piso, nombre)
  if (h === null) throw new Error(`La prueba no tiene «${nombre}» en el piso ${piso}`)
  return h
}

function sesionDeEjemplo(e: EstadoPlano): Sesion {
  return crearSesion(CONTEXTO, { dispositivo: DISPOSITIVO, ...resultadoDelPlano(e) }, INICIO, 'demo-plano')
}

/**
 * El recorrido del ejemplo del diseño, tomado SIN dibujar: el usuario solo elige
 * piso y cuarto de la lista. Después se acomoda el esquema como en el dibujo
 * (cuartos apilados, pasillo sin medir en el 2.º piso) para ejercitar
 * mover_habitacion.
 *
 * Las cifras son datos de prueba, no una medición real: valores típicos de una
 * casa donde el wifi no atraviesa la losa.
 */
function recorridoDeEjemplo(): EstadoPlano {
  let reloj = Date.parse(INICIO)
  const p = (
    descarga_mbps: number,
    latencia_ms: number,
    jitter_ms: number,
    perdida_pct: number,
    barras?: number,
  ): Punto => {
    reloj += 60_000
    return {
      timestamp: new Date(reloj).toISOString(),
      descarga_mbps,
      latencia_ms,
      jitter_ms,
      perdida_pct,
      bytes: 3 * MB,
      ...(barras === undefined ? {} : { senal_declarada: { barras, maximo: 4 } }),
    }
  }
  const en = (piso: number, nombre: string, punto: Punto, junto_al_router = false): Accion => ({
    tipo: 'agregar_punto',
    destino: { piso, nombre },
    punto,
    junto_al_router,
  })

  const medido = aplicar(
    estadoInicial(2),
    // La referencia usa el perfil completo (20 MB); los demás puntos, el liviano.
    en(1, 'Sala', { ...p(152, 12, 5, 0, 4), bytes: 20 * MB }, true),
    en(1, 'Sala', p(148, 13, 6, 0)),
    en(1, 'Dormitorio', p(104, 18, 7, 0, 4)),
    en(1, 'Dormitorio', p(96, 21, 8, 0)),
    en(1, 'Baño', p(55, 34, 14, 0, 3)),
    en(2, 'Dormitorio', p(22, 118, 55, 12.5, 1)),
    en(2, 'Dormitorio', p(18, 131, 62, 12.5)),
    en(2, 'Baño', p(5, 262, 108, 25, 1)),
    { tipo: 'agregar_habitacion', piso: 2, nombre: 'Pasillo' },
  )

  // Apilar como en el dibujo. El orden importa: ningún movimiento puede pisar a otro.
  const id = (piso: number, nombre: string) => habitacion(medido, piso, nombre).id
  return aplicar(
    medido,
    { tipo: 'mover_habitacion', id: id(1, 'Baño'), x: 0, y: 6 },
    { tipo: 'mover_habitacion', id: id(1, 'Sala'), x: 0, y: 3 },
    { tipo: 'mover_habitacion', id: id(1, 'Dormitorio'), x: 0, y: 0 },
    { tipo: 'mover_habitacion', id: id(2, 'Baño'), x: 0, y: 6 },
    { tipo: 'mover_habitacion', id: id(2, 'Pasillo'), x: 0, y: 3 },
  )
}

function describir(e: EstadoPlano): void {
  const { mediciones } = resultadoDelPlano(e)
  for (const piso of e.plano.pisos) {
    console.log(`\n  ${piso.nombre}`)
    for (const h of e.plano.habitaciones.filter((x) => x.piso === piso.numero)) {
      const lugar = `(${h.x},${h.y}) ${h.ancho}×${h.alto} m`
      const m = mediciones.find((x) => x.habitacion_id === h.id)
      if (m === undefined) {
        console.log(`    ⬜   —  ${h.nombre.padEnd(24)} sin medir · ${lugar}`)
        continue
      }
      const indice = m.indice ?? 0
      const rayitas = m.puntos?.find((q) => q.senal_declarada !== undefined)?.senal_declarada
      console.log(
        `    ${EMOJI_NIVEL[nivelDeIndice(indice)]} ${String(indice).padStart(3)}  ${m.cuarto.padEnd(24)} ` +
          `${m.descarga_mbps} Mbps · ${m.latencia_ms} ms · ${m.puntos?.length ?? 0} puntos` +
          `${rayitas === undefined ? '' : ` · rayitas ${rayitas.barras}/${rayitas.maximo} (declaradas)`}` +
          ` · ${lugar}`,
      )
    }
  }
}

/* ───────────────────────── comprobaciones ───────────────────────── */

function revisarEsquemaAutomatico(): void {
  console.log('\n=== esquema automático: medir sin dibujar ===')
  const nombres = ['Sala', 'Cocina', 'Comedor', 'Dormitorio 1', 'Dormitorio 2', 'Baño', 'Estudio']
  const e = aplicar(
    estadoInicial(1),
    ...nombres.map((nombre): Accion => ({ tipo: 'agregar_habitacion', piso: 1, nombre })),
  )
  const hs = e.plano.habitaciones

  comprobar(hs.length === nombres.length, `${nombres.length} habitaciones creadas solas`)
  comprobar(hs.every((a) => hs.every((b) => a === b || !sePisan(a, b))), 'ninguna se pisa con otra')
  comprobar(hs.every((h) => h.x >= 0 && h.y >= 0), 'todas en coordenadas positivas')
  comprobar(e.plano.disposicion === 'auto', "la disposición sigue en 'auto'")

  const estudio = habitacion(e, 1, 'Estudio')
  const conPasillo = reducirPlano(e, {
    tipo: 'agregar_habitacion',
    piso: 1,
    nombre: 'Pasillo',
    junto_a: estudio.id,
  })
  const pasillo = habitacion(conPasillo, 1, 'Pasillo')
  comprobar(
    pasillo.x === estudio.x + estudio.ancho && pasillo.y === estudio.y,
    '«junto a» la deja pegada a esa habitación',
  )

  comprobar(
    reducirPlano(e, { tipo: 'agregar_habitacion', piso: 1, nombre: '  sala ' }) === e,
    'nombre repetido en el mismo piso: rechazado',
  )
  comprobar(
    reducirPlano(e, { tipo: 'agregar_habitacion', piso: 1, nombre: 'x' }) === e,
    'nombre de una letra: rechazado',
  )
  comprobar(
    reducirPlano(e, { tipo: 'agregar_habitacion', piso: 9, nombre: 'Terraza' }) === e,
    'piso que no existe: rechazado',
  )

  const muchos = aplicar(
    estadoInicial(1),
    ...Array.from({ length: 30 }, (): Accion => ({ tipo: 'agregar_piso' })),
  )
  comprobar(muchos.plano.pisos.length === PISO_MAXIMO, `pisos topeados en ${PISO_MAXIMO}`)
}

function revisarRecorrido(e: EstadoPlano): void {
  console.log('\n=== recorrido de ejemplo: router en la sala, 2 pisos ===')
  describir(e)
  console.log('')

  const { plano, mediciones } = resultadoDelPlano(e)
  const porCuarto = new Map(mediciones.map((m) => [m.cuarto, m]))
  const puntos = mediciones.flatMap((m) => m.puntos ?? [])

  comprobar(mediciones.length === 5, '5 mediciones: el pasillo sin puntos no inventa una')
  comprobar(
    mediciones[0]?.cuarto === 'Sala (junto al router)' && mediciones[0].es_referencia,
    'la sala del router es la referencia y va primero',
  )
  comprobar(habitacionDelRouter(e)?.nombre === 'Sala', 'el router quedó en la sala')
  comprobar(
    porCuarto.has('Dormitorio') && porCuarto.has('Dormitorio (piso 2)'),
    'mismo nombre en pisos distintos: etiquetas distintas',
  )
  comprobar(
    mediciones.every((m) => plano.habitaciones.some((h) => h.id === m.habitacion_id)),
    'cada medición apunta a una habitación del plano',
  )
  comprobar(
    puntos.every((q) => !('id' in q)),
    'el id interno del estado no viaja en el contrato',
  )
  comprobar(
    puntos.every((q) => {
      const h = plano.habitaciones.find((x) => x.id === q.habitacion_id)
      return h !== undefined && q.x !== undefined && q.y !== undefined && contiene(h, q.x, q.y)
    }),
    'cada punto está dentro de su habitación',
  )
  comprobar(plano.disposicion === 'usuario', "acomodar el esquema lo marca como 'usuario'")

  const esperado: [string, Nivel][] = [
    ['Sala (junto al router)', 'fuerte'],
    ['Dormitorio', 'fuerte'],
    ['Baño', 'media'],
    ['Dormitorio (piso 2)', 'debil'],
    ['Baño (piso 2)', 'debil'],
  ]
  for (const [cuarto, nivel] of esperado) {
    const indice = porCuarto.get(cuarto)?.indice
    comprobar(
      indice !== undefined && nivelDeIndice(indice) === nivel,
      `${cuarto}: señal ${nivel} (índice ${indice ?? '—'})`,
    )
  }

  // Las rayitas son auxiliares: quitarlas no puede mover el índice de nada.
  const sinRayitas = aplicar(
    e,
    ...e.puntos.map((q): Accion => ({ tipo: 'declarar_senal', id: q.id, senal: null })),
  )
  const indices = (ms: Medicion[]) =>
    JSON.stringify(ms.map((m) => [m.indice, m.puntos?.map((q) => q.indice)]))
  comprobar(
    indices(resultadoDelPlano(sinRayitas).mediciones) === indices(mediciones),
    'las rayitas declaradas no cambian ningún índice',
  )
  comprobar(
    puntos.some((q) => q.senal_declarada?.barras === 4),
    'las rayitas declaradas viajan dentro del punto',
  )
}

function revisarReglas(e: EstadoPlano): void {
  console.log('\n=== reglas del reducer ===')
  const original = JSON.stringify(e)
  const sala = habitacion(e, 1, 'Sala')
  const dormitorio = habitacion(e, 1, 'Dormitorio')
  const bano = habitacion(e, 1, 'Baño')
  const pasillo = habitacion(e, 2, 'Pasillo')
  const [ref1, ref2] = puntosDe(e, sala.id)
  const [dorm1] = puntosDe(e, dormitorio.id)

  // Referencia
  comprobar(
    reducirPlano(e, { tipo: 'borrar_habitacion', id: sala.id }) === e,
    'no se borra la habitación del router si tiene puntos',
  )
  const unaRef = reducirPlano(e, { tipo: 'borrar_punto', id: ref1.id })
  comprobar(puntosDe(unaRef, sala.id).length === 1, 'sí se quita un punto sobrante de la referencia')
  comprobar(
    reducirPlano(unaRef, { tipo: 'borrar_punto', id: ref2.id }) === unaRef,
    'no se quita el último punto de la referencia',
  )
  const noSale = reducirPlano(unaRef, { tipo: 'mover_punto', id: ref2.id, x: 1.5, y: 1.5 })
  comprobar(
    noSale.puntos.find((q) => q.id === ref2.id)?.habitacion_id === sala.id,
    'el último punto de la referencia no se arrastra fuera de ella',
  )

  // Router
  comprobar(
    reducirPlano(e, { tipo: 'ubicar_router', habitacion_id: dormitorio.id }) === e,
    'el router no se muda con la referencia ya medida',
  )
  const routerMovido = reducirPlano(e, {
    tipo: 'ubicar_router',
    habitacion_id: sala.id,
    x: 0.5,
    y: 3.5,
  })
  comprobar(
    routerMovido.plano.router?.x === 0.5 && routerMovido.plano.router.y === 3.5,
    'el router sí se mueve dentro de su habitación',
  )
  const vacio = aplicar(
    estadoInicial(1),
    { tipo: 'agregar_habitacion', piso: 1, nombre: 'Sala' },
    { tipo: 'agregar_habitacion', piso: 1, nombre: 'Cocina' },
  )
  const [h1, h2] = vacio.plano.habitaciones
  const conRouter = aplicar(
    vacio,
    { tipo: 'ubicar_router', habitacion_id: h1.id },
    { tipo: 'ubicar_router', habitacion_id: h2.id },
  )
  comprobar(
    conRouter.plano.router?.habitacion_id === h2.id,
    'antes de medir la referencia, el router sí cambia de habitación',
  )
  comprobar(
    reducirPlano(conRouter, { tipo: 'borrar_habitacion', id: h2.id }).plano.router === null,
    'borrar la habitación del router sin medir lo desmarca',
  )

  // Nombres
  const renombrado = reducirPlano(e, {
    tipo: 'renombrar_habitacion',
    id: dormitorio.id,
    nombre: 'Dormitorio principal',
  })
  comprobar(
    resultadoDelPlano(renombrado).mediciones.some(
      (m) =>
        m.cuarto === 'Dormitorio principal' &&
        m.habitacion_id === dormitorio.id &&
        m.puntos?.length === 2,
    ),
    'renombrar conserva el id y los puntos',
  )
  comprobar(
    reducirPlano(e, { tipo: 'renombrar_habitacion', id: dormitorio.id, nombre: 'SALA' }) === e,
    'renombrar a un nombre usado en el piso: rechazado',
  )

  // Geometría
  const movida = reducirPlano(e, { tipo: 'mover_habitacion', id: sala.id, x: 3, y: 3 })
  const antes = puntosDe(e, sala.id)
  comprobar(
    movida.plano.router?.x === redondear((e.plano.router?.x ?? 0) + 3) &&
      puntosDe(movida, sala.id).every((q, i) => q.x === redondear(antes[i].x + 3)),
    'mover una habitación arrastra su router y sus puntos',
  )
  comprobar(
    reducirPlano(e, { tipo: 'mover_habitacion', id: sala.id, x: 0, y: 4 }) === e,
    'encimar una habitación sobre otra: rechazado',
  )
  const chica = reducirPlano(e, {
    tipo: 'redimensionar_habitacion',
    id: dormitorio.id,
    ancho: 1,
    alto: 1,
  })
  const dormChico = habitacionPorId(chica, dormitorio.id)
  comprobar(
    dormChico !== null && puntosDe(chica, dormitorio.id).every((q) => contiene(dormChico, q.x, q.y)),
    'achicar una habitación deja sus puntos adentro',
  )
  comprobar(
    reducirPlano(e, { tipo: 'redimensionar_habitacion', id: dormitorio.id, ancho: 3, alto: 4 }) ===
      e,
    'agrandar encima de otra: rechazado',
  )

  // Puntos
  const aBano = reducirPlano(e, { tipo: 'mover_punto', id: dorm1.id, x: 1.5, y: 7.5 })
  comprobar(
    aBano.puntos.find((q) => q.id === dorm1.id)?.habitacion_id === bano.id,
    'arrastrar un punto a otro cuarto lo cambia de habitación',
  )
  const tocado = reducirPlano(e, {
    tipo: 'agregar_punto',
    destino: { habitacion_id: pasillo.id, x: 99, y: 99 },
    punto: e.puntos[0],
  })
  const nuevo = tocado.puntos.at(-1)
  comprobar(
    nuevo !== undefined && nuevo.habitacion_id === pasillo.id && contiene(pasillo, nuevo.x, nuevo.y),
    'un toque fuera de la habitación queda dentro de ella',
  )
  comprobar(
    reducirPlano(e, { tipo: 'borrar_habitacion', id: pasillo.id }).plano.habitaciones.every(
      (h) => h.id !== pasillo.id,
    ),
    'se borra una habitación sin medir',
  )
  comprobar(
    puntosDe(reducirPlano(e, { tipo: 'borrar_habitacion', id: bano.id }), bano.id).length === 0,
    'borrar una habitación borra sus puntos',
  )

  // Rayitas
  comprobar(
    reducirPlano(e, { tipo: 'declarar_senal', id: dorm1.id, senal: { barras: 5, maximo: 4 } }) === e,
    'rayitas imposibles (5 de 4): rechazadas',
  )
  comprobar(
    reducirPlano(e, { tipo: 'declarar_senal', id: dorm1.id, senal: { barras: 1.5, maximo: 4 } }) ===
      e,
    'rayitas con decimales: rechazadas',
  )
  const conSenal = reducirPlano(e, {
    tipo: 'declarar_senal',
    id: dorm1.id,
    senal: { barras: 2, maximo: 3 },
  })
  comprobar(
    conSenal.puntos.find((q) => q.id === dorm1.id)?.senal_declarada?.maximo === 3,
    'se pueden corregir las rayitas de un punto',
  )
  const sinSenal = reducirPlano(conSenal, { tipo: 'declarar_senal', id: dorm1.id, senal: null })
  comprobar(
    !('senal_declarada' in (sinSenal.puntos.find((q) => q.id === dorm1.id) ?? {})),
    'quitar las rayitas borra el campo, no lo deja en null',
  )

  // Repetir
  const posicion = e.puntos.findIndex((q) => q.id === dorm1.id)
  const repetido = reducirPlano(e, {
    tipo: 'reemplazar_punto',
    id: dorm1.id,
    punto: { ...e.puntos[0], descarga_mbps: 7, latencia_ms: 99 },
  })
  const nuevoDorm = repetido.puntos[posicion]
  comprobar(
    nuevoDorm.id === dorm1.id &&
      nuevoDorm.habitacion_id === dorm1.habitacion_id &&
      nuevoDorm.x === dorm1.x &&
      nuevoDorm.y === dorm1.y &&
      nuevoDorm.descarga_mbps === 7 &&
      repetido.puntos.length === e.puntos.length,
    'repetir un punto cambia sus cifras y conserva id, lugar y orden',
  )
  comprobar(
    (indicesPorPunto(repetido).get(dorm1.id) ?? 100) < (indicesPorPunto(e).get(dorm1.id) ?? 0),
    'repetir recalcula el índice del punto',
  )
  comprobar(
    reducirPlano(e, { tipo: 'reemplazar_punto', id: 'p999', punto: e.puntos[0] }) === e,
    'repetir un punto que no existe: rechazado',
  )
  comprobar(
    hayReferencia(e) && !hayReferencia(estadoInicial(1)) && !hayReferencia(conRouter),
    'hay referencia solo si la habitación del router tiene puntos',
  )

  comprobar(JSON.stringify(e) === original, 'ninguna acción modificó el estado original')
}

function revisarCompatibilidad(e: EstadoPlano): void {
  console.log('\n=== compatibilidad hacia atrás ===')
  const { mediciones } = resultadoDelPlano(e)

  // Las mismas paradas sin nada del plano, tal como las arma FlujoCaminata.
  const clasicas: Parada[] = paradasDe(e).map(({ piso, cuarto, es_referencia, puntos }) => ({
    piso,
    cuarto,
    es_referencia,
    puntos: puntos.map(({ timestamp, descarga_mbps, latencia_ms, jitter_ms, perdida_pct, bytes }) => ({
      timestamp,
      descarga_mbps,
      latencia_ms,
      jitter_ms,
      perdida_pct,
      bytes,
    })),
  }))
  const resumen = (ms: Medicion[]) =>
    JSON.stringify(
      ms.map((m) => [
        m.cuarto,
        m.es_referencia,
        m.descarga_mbps,
        m.latencia_ms,
        m.indice,
        m.puntos?.map((q) => q.indice),
      ]),
    )
  comprobar(
    resumen(consolidar(clasicas)) === resumen(mediciones),
    'consolidar da lo mismo con o sin plano (mediana, índice, etiquetas)',
  )

  const sinPlano = crearSesion(
    CONTEXTO,
    { dispositivo: DISPOSITIVO, mediciones: consolidar(clasicas) },
    INICIO,
    'sin-plano',
  )
  comprobar(!('plano' in sinPlano), 'una sesión sin plano no gana la clave «plano»')
  const conPlano = sesionDeEjemplo(e)
  comprobar(conPlano.plano === e.plano, 'crearSesion pasa el plano tal cual')

  const reporte = diagnosticar(conPlano)
  comprobar(
    reporte.cuartos.length === mediciones.length,
    'reglas.ts diagnostica la sesión con plano sin cambios',
  )
  comprobar(
    !reporte.requiere_visita_tecnica,
    'referencia buena y cuartos lejanos malos: no culpa al proveedor',
  )
}

function revisarPersistencia(e: EstadoPlano): void {
  console.log('\n=== respaldo en localStorage ===')
  const memoria = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => memoria.get(k) ?? null,
      setItem: (k: string, v: string) => void memoria.set(k, v),
      removeItem: (k: string) => void memoria.delete(k),
    },
  })

  const t0 = Date.parse(INICIO)
  guardarRecorrido(e, t0)
  comprobar(
    JSON.stringify(cargarRecorrido(t0 + 60_000)) === JSON.stringify(e),
    'guardar y cargar devuelve el mismo recorrido',
  )
  comprobar(
    cargarRecorrido(t0 + 13 * 3_600_000) === null,
    'un recorrido de hace más de 12 h no se ofrece',
  )

  const [clave] = memoria.keys()
  memoria.set(clave, JSON.stringify({ guardado_en: t0, estado: { basura: true } }))
  comprobar(cargarRecorrido(t0) === null, 'datos con otra forma no rompen la carga')
  memoria.set(clave, '{no es json')
  comprobar(cargarRecorrido(t0) === null, 'JSON roto no rompe la carga')

  borrarRecorrido()
  comprobar(memoria.size === 0, 'borrar el respaldo lo quita del almacenamiento')
  comprobar(esEstadoPlano(JSON.parse(JSON.stringify(e))), 'el estado sobrevive a JSON')
}

function revisarMock(e: EstadoPlano): void {
  console.log(`\n=== ${RUTA_MOCK} ===`)
  const esperado = `${JSON.stringify(sesionDeEjemplo(e), null, 2)}\n`

  if (process.argv.includes('--escribir-mock')) {
    writeFileSync(RUTA_MOCK, esperado)
    console.log('  escrito')
  }
  if (!existsSync(RUTA_MOCK)) {
    comprobar(false, `${RUTA_MOCK} existe (correr con --escribir-mock)`)
    return
  }
  // git en Windows puede devolverlo con CRLF.
  const enDisco = readFileSync(RUTA_MOCK, 'utf8').replace(/\r\n/g, '\n')
  comprobar(enDisco === esperado, 'el mock coincide con el recorrido de ejemplo')
}

/** JSON con las claves ordenadas: compara contenido sin depender del orden de armado. */
function canonico(valor: unknown): string {
  return JSON.stringify(valor, (_, v: unknown) =>
    v !== null && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  )
}

function revisarDesdeSesion(e: EstadoPlano): void {
  console.log('\n=== estado desde una sesión guardada ===')
  const sesion = JSON.parse(JSON.stringify(sesionDeEjemplo(e))) as Sesion
  const reconstruido = estadoDesdeSesion(sesion)

  comprobar(
    reconstruido !== null && canonico(resultadoDelPlano(reconstruido)) === canonico(resultadoDelPlano(e)),
    'sesión → estado → contrato devuelve lo mismo',
  )
  comprobar(
    estadoDesdeSesion({ mediciones: sesion.mediciones }) === null,
    'una sesión sin plano no arma estado',
  )
  if (reconstruido !== null) {
    const ids = [
      ...reconstruido.plano.habitaciones.map((h) => h.id),
      ...reconstruido.puntos.map((q) => q.id),
    ]
    const cocina = buscarHabitacion(
      reducirPlano(reconstruido, { tipo: 'agregar_habitacion', piso: 1, nombre: 'Cocina' }),
      1,
      'Cocina',
    )
    comprobar(
      new Set(ids).size === ids.length && cocina !== null && !ids.includes(cocina.id),
      'los ids nuevos no chocan con los de la sesión',
    )
  }

  const indices = indicesPorPunto(e)
  comprobar(
    indices.size === e.puntos.length &&
      resultadoDelPlano(e).mediciones.every((m) =>
        (m.puntos ?? []).every((q, i) => {
          const propios = puntosDe(e, m.habitacion_id ?? '')
          return (
            i < propios.length &&
            propios[i].timestamp === q.timestamp &&
            indices.get(propios[i].id) === q.indice
          )
        }),
      ),
    'cada punto del estado recibe el índice que le corresponde',
  )
}

function revisarVista(e: EstadoPlano): void {
  console.log('\n=== vista del editor ===')
  const vacia = vistaParaPiso([])
  comprobar(
    vacia.ancho >= 8 && Math.abs(vacia.ancho / vacia.alto - 4 / 3) < 1e-9,
    'un piso vacío se ve de al menos 8 m de ancho, en 4:3',
  )
  for (const piso of e.plano.pisos) {
    const hs = habitacionesDelPiso(e, piso.numero)
    const v = vistaParaPiso(hs)
    comprobar(
      hs.every(
        (h) =>
          h.x >= v.x && h.y >= v.y && h.x + h.ancho <= v.x + v.ancho && h.y + h.alto <= v.y + v.alto,
      ) && Math.abs(v.ancho / v.alto - 4 / 3) < 1e-9,
      `${piso.nombre}: ajustar deja todas las habitaciones a la vista, en 4:3`,
    )
  }

  let cerca = vacia
  let lejos = vacia
  for (let i = 0; i < 20; i++) {
    cerca = acercar(cerca, 2)
    lejos = acercar(lejos, 0.5)
  }
  comprobar(cerca.ancho === ANCHO_MINIMO, `acercar topea en ${ANCHO_MINIMO} m`)
  comprobar(lejos.ancho === ANCHO_MAXIMO, `alejar topea en ${ANCHO_MAXIMO} m`)
  const zoom = acercar(vacia, 2)
  comprobar(
    Math.abs(zoom.x + zoom.ancho / 2 - (vacia.x + vacia.ancho / 2)) < 1e-9 &&
      Math.abs(zoom.y + zoom.alto / 2 - (vacia.y + vacia.alto / 2)) < 1e-9,
    'acercar mantiene el centro',
  )

  const pxPorMetro = Math.min(360 / vacia.ancho, 270 / vacia.alto)
  comprobar(
    Math.abs(tamanoTexto(vacia, 360, 270) * pxPorMetro - 13) < 1e-9,
    'las etiquetas miden 13 px en pantalla',
  )
  const recortado = recortarTexto('Dormitorio principal', 1.5, 0.3)
  comprobar(
    recortado.endsWith('…') && recortado.length < 'Dormitorio principal'.length,
    `un nombre largo se recorta («${recortado}»)`,
  )
  comprobar(recortarTexto('Baño', 3, 0.3) === 'Baño', 'un nombre que entra no se toca')
}

revisarEsquemaAutomatico()
const ejemplo = recorridoDeEjemplo()
revisarRecorrido(ejemplo)
revisarReglas(ejemplo)
revisarCompatibilidad(ejemplo)
revisarPersistencia(ejemplo)
revisarMock(ejemplo)
revisarDesdeSesion(ejemplo)
revisarVista(ejemplo)

if (fallas > 0) {
  console.log(`\n${fallas} ${fallas === 1 ? 'comprobación falló' : 'comprobaciones fallaron'}.`)
  process.exit(1)
}
console.log('\nTodo en orden.')
