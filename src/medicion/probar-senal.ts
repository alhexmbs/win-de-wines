/**
 * probar-senal.ts — calibración del índice de cobertura sin abrir el navegador.
 *
 *   node src/medicion/probar-senal.ts            (los 4 mocks)
 *   node src/medicion/probar-senal.ts mocks/sesion_cobertura.json
 *
 * Sirve para dos cosas: ver que las bandas 🟢🟡🔴 caen donde deben, y tener a
 * mano el ejemplo de que la mediana aguanta un punto malo dentro de un cuarto.
 */
import { readFileSync } from 'node:fs'
import type { Sesion } from '../contrato.ts'
import { type Parada, consolidar, mediana } from './caminata.ts'
import { type Nivel, indiceDeCobertura, indiceEnVivo, nivelDeIndice } from './senal.ts'

/** Solo para la salida de terminal de este script; la app usa <IconoNivel>. */
const EMOJI_NIVEL: Record<Nivel, string> = {
  fuerte: '🟢',
  media: '🟡',
  debil: '🔴',
}

const POR_DEFECTO = [
  'mocks/sesion_ok.json',
  'mocks/sesion_cobertura.json',
  'mocks/sesion_general.json',
  'mocks/sesion_caminata.json',
]

function fila(indice: number, texto: string, detalle: string): string {
  const emoji = EMOJI_NIVEL[nivelDeIndice(indice)]
  return `  ${emoji} ${String(indice).padStart(3)}  ${texto.padEnd(34)} ${detalle}`
}

function revisar(ruta: string): void {
  const sesion = JSON.parse(readFileSync(ruta, 'utf8')) as Sesion
  const referencia = sesion.mediciones.find((m) => m.es_referencia) ?? sesion.mediciones[0]

  console.log(`\n=== ${ruta} · plan ${sesion.contexto.plan_mbps ?? '—'} Mbps ===`)
  for (const m of sesion.mediciones) {
    const indice = m.indice ?? indiceDeCobertura(m, referencia)
    const puntos = m.puntos === undefined ? '' : ` · ${m.puntos.length} puntos`
    console.log(
      fila(
        indice,
        m.cuarto,
        m.error === undefined
          ? `${m.descarga_mbps} Mbps · ${m.latencia_ms} ms${puntos}`
          : `SIN SEÑAL (${m.error})`,
      ),
    )
  }
}

function demostrarMediana(): void {
  const punto = (mbps: number, lat: number) => ({
    timestamp: new Date().toISOString(),
    descarga_mbps: mbps,
    latencia_ms: lat,
    jitter_ms: 6,
    perdida_pct: 0,
  })

  // El tercer punto de la sala cae por una interferencia momentánea.
  const paradas: Parada[] = [
    { piso: 1, cuarto: 'Sala', es_referencia: true, puntos: [punto(95, 18), punto(91, 21), punto(2, 19)] },
  ]

  const [sala] = consolidar(paradas)
  console.log('\n=== mediana vs promedio dentro de un cuarto ===')
  console.log(`  puntos medidos: 95, 91, 2 Mbps`)
  console.log(`  mediana (lo que usamos): ${mediana([95, 91, 2])} Mbps → índice ${sala.indice}`)
  console.log(`  promedio (lo que NO usamos): ${((95 + 91 + 2) / 3).toFixed(1)} Mbps`)
}

function demostrarEnVivo(): void {
  console.log('\n=== semáforo en vivo (referencia: 20 ms) ===')
  const casos: [string, (number | null)[]][] = [
    ['junto al router', [18, 22, 19]],
    ['cuarto contiguo', [60, 75, 58]],
    ['lejos o con pared', [220, 260, 310]],
    ['se está cayendo', [null, null, 400]],
    ['sin señal', [null, null, null]],
  ]
  for (const [nombre, pings] of casos) {
    const indice = indiceEnVivo(pings, 20) ?? 0
    console.log(fila(indice, nombre, JSON.stringify(pings)))
  }
}

const rutas = process.argv.slice(2)
for (const ruta of rutas.length > 0 ? rutas : POR_DEFECTO) revisar(ruta)
if (rutas.length === 0) {
  demostrarMediana()
  demostrarEnVivo()
}
