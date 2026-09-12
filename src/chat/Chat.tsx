import { useState } from 'react'
import type { Reporte, Sesion } from '../contrato'
import { ErrorApi, preguntarChat } from '../api'
import { Boton } from '../ui/Boton'

interface Mensaje {
  pregunta: string
  respuesta: string
}

/** 3 preguntas fijas que cubren casi toda la duda típica sin que el cliente tenga que pensar qué escribir. */
const SUGERIDAS = ['¿Qué hago primero?', '¿Por qué pasa esto?', '¿Esto lo arreglo yo o WIN?']

function mensajeDeError(e: unknown): string {
  if (e instanceof ErrorApi && e.estado === 404) {
    return 'El chat no está disponible en este momento (revisa las recomendaciones arriba).'
  }
  return 'No pudimos enviar tu pregunta. Intenta de nuevo.'
}

/**
 * Sin historial entre preguntas a propósito: cada una manda el reporte
 * completo de nuevo, así el LLM nunca depende de un estado que se pueda
 * perder o desincronizar. Ver chat.ts para las reglas de qué puede responder.
 */
export function Chat({ sesion, reporte }: { sesion: Sesion; reporte: Reporte }) {
  const [pregunta, setPregunta] = useState('')
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  /** F8: la respuesta que se está escribiendo ahora, trozo a trozo. */
  const [enProgreso, setEnProgreso] = useState<Mensaje | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function enviar(texto: string) {
    const limpia = texto.trim()
    if (limpia.length === 0 || cargando) return

    setCargando(true)
    setError(null)
    setPregunta('')
    setEnProgreso({ pregunta: limpia, respuesta: '' })
    try {
      let ultimaRespuesta = ''
      await preguntarChat(sesion, reporte, limpia, (acumulado) => {
        ultimaRespuesta = acumulado
        setEnProgreso({ pregunta: limpia, respuesta: acumulado })
      })
      setMensajes((prev) => [...prev, { pregunta: limpia, respuesta: ultimaRespuesta }])
    } catch (e) {
      setError(mensajeDeError(e))
    } finally {
      setEnProgreso(null)
      setCargando(false)
    }
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-win-200/40">
      <h2 className="text-lg font-bold text-win-900">¿Alguna duda sobre tu reporte?</h2>

      {mensajes.length === 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGERIDAS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void enviar(s)}
              disabled={cargando}
              className="rounded-full border-2 border-win-200 px-3.5 py-1.5 text-sm font-semibold text-win-700 transition hover:border-win-500 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {(mensajes.length > 0 || enProgreso !== null) && (
        <ul className="mt-4 space-y-4" aria-live="polite">
          {mensajes.map((m, i) => (
            <li key={i}>
              <p className="text-sm font-semibold text-win-900">Tú: {m.pregunta}</p>
              <p className="mt-1 text-[15px] leading-relaxed text-gray-700">{m.respuesta}</p>
            </li>
          ))}
          {enProgreso !== null && (
            <li>
              <p className="text-sm font-semibold text-win-900">Tú: {enProgreso.pregunta}</p>
              <p className="mt-1 text-[15px] leading-relaxed text-gray-700">
                {enProgreso.respuesta === '' ? 'Pensando…' : enProgreso.respuesta}
              </p>
            </li>
          )}
        </ul>
      )}

      {error !== null && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void enviar(pregunta)
        }}
      >
        <label htmlFor="pregunta-chat" className="sr-only">
          Tu pregunta sobre el reporte
        </label>
        <input
          id="pregunta-chat"
          type="text"
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          placeholder="Escribe tu pregunta…"
          maxLength={300}
          disabled={cargando}
          className="min-w-0 flex-1 rounded-2xl border-2 border-win-200 bg-white px-4 py-3 text-win-900 outline-none focus:border-win-500 disabled:opacity-50"
        />
        <Boton
          type="submit"
          disabled={cargando || pregunta.trim().length === 0}
          className="w-auto shrink-0 px-5"
        >
          Enviar
        </Boton>
      </form>
    </div>
  )
}
