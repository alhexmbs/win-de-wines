import { useState } from 'react'
import type { ReactNode } from 'react'
import type { CuartoReporte, Estado, Reporte as TipoReporte, Sesion } from '../contrato'
import { Boton } from '../ui/Boton'
import { Insignia } from '../ui/Insignia'
import { Pantalla } from '../ui/Pantalla'

const COLOR_BARRA: Record<Estado, string> = {
  bueno: 'bg-bueno',
  regular: 'bg-regular',
  malo: 'bg-malo',
}

const TITULO_GENERAL: Record<Estado, string> = {
  bueno: 'Tu wifi está bien',
  regular: 'Tu wifi falla en algunos puntos',
  malo: 'Tu wifi tiene un problema serio',
}

function FilaCuarto({ cuarto, sesion }: { cuarto: CuartoReporte; sesion: Sesion }) {
  const medicion = sesion.mediciones.find((m) => m.cuarto === cuarto.cuarto)
  const pct = cuarto.velocidad_vs_plan_pct
  return (
    <li className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold text-win-900">{cuarto.cuarto}</p>
        <Insignia estado={cuarto.estado} />
      </div>

      {pct !== null && (
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full ${COLOR_BARRA[cuarto.estado]}`}
            style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
          />
        </div>
      )}

      <p className="mt-2 text-sm text-gray-500">
        {medicion && medicion.error === undefined
          ? `${medicion.descarga_mbps.toFixed(1)} Mbps · ${medicion.latencia_ms} ms de demora`
          : 'Sin señal en este punto'}
        {pct !== null && ` · ${pct}% de tu plan`}
      </p>

      <p className="mt-2 text-[15px] leading-relaxed text-gray-700">{cuarto.explicacion}</p>
    </li>
  )
}

export function Reporte({
  sesion,
  reporte,
  onEnviar,
  mapa,
  chat,
}: {
  sesion: Sesion
  reporte: TipoReporte
  onEnviar: () => void
  /** Día 2: <MapaCalor sesion reporte />. */
  mapa?: ReactNode
  /** Día 2: <Chat sesion reporte />. */
  chat?: ReactNode
}) {
  const [verTecnico, setVerTecnico] = useState(false)

  return (
    <Pantalla
      pie={
        <>
          <Boton onClick={onEnviar}>
            {reporte.requiere_visita_tecnica ? 'Enviar este reporte a WIN' : 'Compartir con WIN'}
          </Boton>
          <Boton variante="texto" onClick={() => setVerTecnico((v) => !v)}>
            {verTecnico ? 'Ocultar detalle técnico' : 'Ver detalle técnico'}
          </Boton>
        </>
      }
    >
      <p className="text-sm font-semibold tracking-wide text-win-700 uppercase">
        {TITULO_GENERAL[reporte.calificacion_general]}
      </p>
      <h1 className="mt-2 text-3xl leading-tight font-bold text-win-900">{reporte.titular}</h1>
      <p className="mt-4 text-[17px] leading-relaxed text-gray-700">{reporte.resumen}</p>

      {mapa && <div className="mt-8">{mapa}</div>}

      <h2 className="mt-9 mb-3 text-xl font-bold text-win-900">Cuarto por cuarto</h2>
      <ul className="space-y-3">
        {reporte.cuartos.map((c) => (
          <FilaCuarto key={c.cuarto} cuarto={c} sesion={sesion} />
        ))}
      </ul>

      <h2 className="mt-9 mb-3 text-xl font-bold text-win-900">Por qué pasa esto</h2>
      <p className="rounded-2xl bg-win-100 p-4 text-[15px] leading-relaxed text-win-900">
        {reporte.causa_probable}
      </p>

      <h2 className="mt-9 mb-3 text-xl font-bold text-win-900">Qué puedes hacer</h2>
      <ul className="space-y-3">
        {reporte.recomendaciones.map((r) => (
          <li key={r.titulo} className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-win-900">{r.titulo}</p>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                  r.responsable === 'win' ? 'bg-win-100 text-win-700' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {r.responsable === 'win' ? 'Lo hace WIN' : 'Lo haces tú'}
              </span>
            </div>
            <p className="mt-2 text-[15px] leading-relaxed text-gray-700">{r.detalle}</p>
          </li>
        ))}
      </ul>

      {chat && <div className="mt-9">{chat}</div>}

      {verTecnico && (
        <div className="mt-9">
          <h2 className="mb-3 text-xl font-bold text-win-900">Detalle técnico</h2>
          <p className="mb-3 text-sm text-gray-500">
            Reporte generado por {reporte.generado_por === 'ia' ? 'IA' : 'plantilla de respaldo'} ·
            Dispositivo: {sesion.dispositivo.navegador} · Conexión: {sesion.dispositivo.conexion} ·
            Sesión {sesion.sesion_id}
          </p>
          <pre className="overflow-x-auto rounded-xl bg-win-900 p-4 text-xs text-win-100">
            {JSON.stringify(sesion.mediciones, null, 2)}
          </pre>
        </div>
      )}
    </Pantalla>
  )
}
