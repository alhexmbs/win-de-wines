import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import type { Contexto, ResultadoMedicion } from '../contrato'
import { crearSesion, nuevoSesionId } from '../contrato'
import { Boton } from '../ui/Boton'
import { Pantalla } from '../ui/Pantalla'
import { MapaCalor } from '../mapa/MapaCalor'
import { FlujoPlano } from '../plano/FlujoPlano'
import { LabPlano } from '../plano/LabPlano'
import { FlujoCaminata } from './FlujoCaminata'

/**
 * Banco de pruebas de F1. No es parte de la app: es mi página para abrir en el
 * celular real sin pasar por la bienvenida ni el onboarding de C, y sin
 * depender del endpoint de B.
 *
 *   pnpm dev  →  http://localhost:5173/lab.html
 *
 * Ojo: por LAN (http://192.168.x.x) el Wake Lock no funciona, porque no es
 * contexto seguro. Para probar eso hace falta el preview de Vercel en https.
 */

const parametros = new URLSearchParams(window.location.search)

/**
 * Qué prueba el lab. Sin nada, lo mismo que usa la app (la caminata sobre
 * plano); ?caminata, el respaldo sin plano; ?plano, el editor del esquema solo.
 */
const FlujoMedicion = parametros.has('caminata') ? FlujoCaminata : FlujoPlano

/** Contexto de mentira, solo para poder armar una Sesion comparable con los mocks. */
const CONTEXTO_FALSO: Contexto = { plan_mbps: 200, tipo_vivienda: 'casa', pisos: 2 }

const TEXTO_COPIA: Record<EstadoCopia, string> = {
  inicial: 'Copiar JSON al portapapeles',
  copiado: 'Copiado',
  falló: 'Sin portapapeles aquí: selecciona el texto de abajo',
}

/**
 * navigator.clipboard NO existe fuera de contexto seguro, y por LAN estamos en
 * http. Acceder a .writeText ahí revienta, así que va guardado.
 */
async function copiar(texto: string, avisar: (e: EstadoCopia) => void) {
  try {
    await navigator.clipboard.writeText(texto)
    avisar('copiado')
  } catch {
    avisar('falló')
  }
}

function descargar(nombre: string, datos: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' }),
  )
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

type EstadoCopia = 'inicial' | 'copiado' | 'falló'

function Lab() {
  const [resultado, setResultado] = useState<ResultadoMedicion | null>(null)
  const [copia, setCopia] = useState<EstadoCopia>('inicial')

  if (resultado === null) return <FlujoMedicion onTerminar={setResultado} />

  const sesion = crearSesion(
    CONTEXTO_FALSO,
    resultado,
    new Date().toISOString(),
    nuevoSesionId(),
  )
  const json = JSON.stringify(sesion, null, 2)

  return (
    <Pantalla
      titulo="Salida de F1"
      bajada="Esto es lo que recibe C. La Sesion de abajo usa un contexto de mentira para poder compararla con mocks/sesion_*.json."
      pie={
        <>
          <Boton onClick={() => descargar('sesion.json', sesion)}>Descargar sesion.json</Boton>
          <Boton variante="secundario" onClick={() => descargar('resultado.json', resultado)}>
            Descargar resultado.json (lo real)
          </Boton>
          <Boton variante="texto" onClick={() => setResultado(null)}>
            Medir de nuevo
          </Boton>
        </>
      }
    >
      <MapaCalor sesion={sesion} />

      <div className="mt-6 grid grid-cols-3 gap-2">
        <Dato etiqueta="Cuartos" valor={resultado.mediciones.length.toString()} />
        <Dato
          etiqueta="Con error"
          valor={resultado.mediciones.filter((m) => m.error !== undefined).length.toString()}
        />
        <Dato
          etiqueta="MB usados"
          valor={(
            resultado.mediciones.reduce((a, m) => a + (m.bytes_descargados ?? 0), 0) /
            1024 /
            1024
          ).toFixed(1)}
        />
      </div>

      <button
        type="button"
        onClick={() => void copiar(json, setCopia)}
        className="mt-3 w-full rounded-xl border-2 border-win-200 bg-white py-2 text-sm font-semibold text-win-700"
      >
        {TEXTO_COPIA[copia]}
      </button>

      <pre className="mt-3 max-h-[50vh] overflow-auto rounded-2xl bg-win-900 p-4 text-xs leading-relaxed text-win-100">
        {json}
      </pre>
    </Pantalla>
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-xl bg-white p-3 text-center shadow-sm ring-1 ring-win-200/40">
      <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">{etiqueta}</p>
      <p className="mt-1 text-xl font-bold text-win-900">{valor}</p>
    </div>
  )
}

/** lab.html?plano abre el banco de pruebas del esquema de la vivienda en vez del de medición. */
const modoPlano = parametros.has('plano')

createRoot(document.getElementById('root')!).render(
  <StrictMode>{modoPlano ? <LabPlano /> : <Lab />}</StrictMode>,
)
