import { Boton } from '../ui/Boton'
import { IconoCheck } from '../ui/Iconos'
import { Pantalla } from '../ui/Pantalla'

export function Confirmacion({
  ticket,
  guardado,
  onVerReporte,
  onEmpezarDeNuevo,
}: {
  ticket: string
  guardado: boolean
  onVerReporte: () => void
  onEmpezarDeNuevo: () => void
}) {
  async function copiar() {
    try {
      await navigator.clipboard.writeText(ticket)
    } catch {
      /* sin portapapeles: el ticket igual está en pantalla */
    }
  }

  return (
    <Pantalla
      pie={
        <>
          <Boton variante="secundario" onClick={onVerReporte}>
            Volver a ver mi reporte
          </Boton>
          <Boton variante="texto" onClick={onEmpezarDeNuevo}>
            Medir de nuevo
          </Boton>
        </>
      }
    >
      <div className="flex min-h-[60svh] flex-col items-center justify-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-bueno-bg text-bueno">
          <IconoCheck className="h-10 w-10" />
        </div>
        <h1 className="mt-7 text-3xl font-bold text-win-900">Reporte enviado</h1>
        <p className="mt-3 text-gray-600">
          El equipo de WIN ya tiene tus mediciones. Te contactan al número que dejaste.
        </p>

        <div className="mt-8 w-full rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold tracking-wide text-gray-500 uppercase">
            Tu código de seguimiento
          </p>
          <p className="mt-2 font-mono text-2xl font-bold tracking-wider text-win-700">{ticket}</p>
          <button
            type="button"
            onClick={copiar}
            className="mt-3 text-sm font-semibold text-win-700 underline underline-offset-4"
          >
            Copiar código
          </button>
        </div>

        <p className="mt-6 text-sm text-gray-500">
          Guarda este código: con él puedes preguntar por tu caso.
        </p>

        {!guardado && (
          <p className="mt-4 rounded-xl bg-regular-bg p-3 text-sm text-regular">
            Modo demo: el reporte no se guardó en la base de datos.
          </p>
        )}
      </div>
    </Pantalla>
  )
}
