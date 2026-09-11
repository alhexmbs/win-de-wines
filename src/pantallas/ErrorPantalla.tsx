import { Boton } from '../ui/Boton'
import { Pantalla } from '../ui/Pantalla'

export function ErrorPantalla({
  mensaje,
  onReintentar,
  onVolver,
}: {
  mensaje: string
  onReintentar: () => void
  onVolver?: () => void
}) {
  return (
    <Pantalla
      titulo="No pudimos completar el paso"
      bajada="Tus mediciones no se perdieron. Puedes intentarlo otra vez."
      pie={
        <>
          <Boton onClick={onReintentar}>Reintentar</Boton>
          {onVolver && (
            <Boton variante="texto" onClick={onVolver}>
              Volver al inicio
            </Boton>
          )}
        </>
      }
    >
      <p className="rounded-xl bg-malo-bg p-4 text-sm text-malo">{mensaje}</p>
    </Pantalla>
  )
}
