import type { Dispositivo } from '../../contrato'
import { Boton } from '../../ui/Boton'
import { Pantalla } from '../../ui/Pantalla'

/**
 * Puerta de entrada a la caminata. No existe para adornar: medir sobre datos
 * móviles da números que no tienen nada que ver con el wifi de la casa, y
 * además le quema el plan al cliente.
 *
 * En iPhone el navegador no sabe si está en wifi o en datos, así que aquí la
 * detección es solo una ayuda y la respuesta real la da el usuario.
 */
export function PasoConexion({
  dispositivo,
  detectaConexion,
  onRevisar,
  onConfirmarWifi,
  onSeguirEnAhorro,
}: {
  dispositivo: Dispositivo
  /** true = el navegador sí sabe distinguir wifi de celular. */
  detectaConexion: boolean
  onRevisar: () => void
  onConfirmarWifi: () => void
  onSeguirEnAhorro: () => void
}) {
  const enCelular = dispositivo.conexion === 'celular'

  return (
    <Pantalla
      paso={2}
      titulo={enCelular ? 'Estás usando datos móviles' : 'Antes de empezar'}
      bajada={
        enCelular
          ? 'Si medimos así, el reporte va a hablar de tu plan de celular y no del wifi de tu casa.'
          : 'Necesitamos estar seguros de que mides tu wifi, no tus datos móviles.'
      }
      pie={
        enCelular ? (
          <>
            <Boton onClick={onRevisar}>Ya me conecté al wifi, revisar</Boton>
            <Boton variante="texto" onClick={onSeguirEnAhorro}>
              Medir igual, gastando pocos datos
            </Boton>
          </>
        ) : (
          <>
            <Boton onClick={onConfirmarWifi}>Sí, estoy en el wifi de mi casa</Boton>
            <Boton variante="texto" onClick={onSeguirEnAhorro}>
              No estoy seguro
            </Boton>
          </>
        )
      }
    >
      <div
        className={`rounded-2xl border p-4 ${
          enCelular ? 'border-malo/30 bg-malo-bg' : 'border-win-200 bg-white'
        }`}
      >
        <p className="text-sm font-semibold tracking-wide text-gray-500 uppercase">
          Lo que ve tu navegador
        </p>
        <dl className="mt-3 space-y-2 text-sm">
          <Fila etiqueta="Conexión" valor={ETIQUETA_CONEXION[dispositivo.conexion]} />
          <Fila etiqueta="Navegador" valor={dispositivo.navegador} />
          {dispositivo.effective_type !== undefined && (
            <Fila etiqueta="Tipo de red" valor={dispositivo.effective_type} />
          )}
        </dl>

        {!detectaConexion && (
          <p className="mt-3 border-t border-win-200 pt-3 text-sm text-gray-600">
            Tu navegador no le dice a las páginas web si estás en wifi o en datos móviles. Por eso
            te lo preguntamos a ti.
          </p>
        )}
      </div>

      <ul className="mt-4 space-y-2 text-sm text-gray-600">
        <li>· Abre los ajustes del celular y conéctate al wifi de tu casa.</li>
        <li>· Desactiva los datos móviles mientras dure la medición.</li>
        <li>· Ten a la mano dónde está tu router: ahí empezamos.</li>
      </ul>
    </Pantalla>
  )
}

const ETIQUETA_CONEXION: Record<Dispositivo['conexion'], string> = {
  wifi: 'Wifi',
  celular: 'Datos móviles',
  desconocida: 'No la puede saber',
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500">{etiqueta}</dt>
      <dd className="text-right font-semibold text-win-900">{valor}</dd>
    </div>
  )
}
