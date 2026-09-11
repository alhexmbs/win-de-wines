/**
 * probar.ts — B, prueba local sin celular, sin hotspot, sin key.
 *
 * Uso:
 *   node src/diagnostico/probar.ts mocks/sesion_ok.json
 *   node src/diagnostico/probar.ts mocks/sesion_*.json   (PowerShell no expande *, este script sí)
 *
 * Sin ANTHROPIC_API_KEY (o sin .env.local) imprime el reporte de plantilla.
 * Con la key puesta en .env.local, imprime el reporte con generado_por:'ia'.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Sesion } from '../contrato.ts'
import { generarReporte } from './generarReporte.ts'

try {
  // Se asume cwd = raíz del repo (así lo corre `pnpm probar`).
  process.loadEnvFile(join(process.cwd(), '.env.local'))
} catch {
  // .env.local no existe: se corre sin key, sale la plantilla. Es el caso esperado.
}

function resolverArchivos(patrones: string[]): string[] {
  const archivos: string[] = []
  for (const patron of patrones) {
    if (existsSync(patron)) {
      archivos.push(patron)
      continue
    }
    // Glob simple de un solo nivel (ej: mocks/sesion_*.json), para shells que no expanden *.
    const dir = dirname(patron)
    const regex = new RegExp(`^${patron.split(/[\\/]/).pop()!.replace(/[.]/g, '\\.').replace(/\*/g, '.*')}$`)
    for (const nombre of readdirSync(dir)) {
      if (regex.test(nombre)) archivos.push(join(dir, nombre))
    }
  }
  return archivos
}

async function main() {
  const patrones = process.argv.slice(2)
  if (patrones.length === 0) {
    console.error('Uso: node src/diagnostico/probar.ts <archivo-o-patron.json> [...]')
    process.exit(1)
  }

  const archivos = resolverArchivos(patrones)
  if (archivos.length === 0) {
    console.error('No se encontró ningún archivo con esos patrones.')
    process.exit(1)
  }

  for (const archivo of archivos) {
    const sesion = JSON.parse(readFileSync(archivo, 'utf-8')) as Sesion
    const reporte = await generarReporte(sesion)
    console.log(`\n=== ${archivo} (generado_por: ${reporte.generado_por}) ===`)
    console.log(JSON.stringify(reporte, null, 2))
  }
}

void main()
