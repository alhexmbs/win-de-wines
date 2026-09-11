import { useState } from 'react'
import type { Contacto } from '../contrato'
import { Boton } from '../ui/Boton'
import { Pantalla } from '../ui/Pantalla'

const CLASE_CAMPO =
  'mt-2 w-full rounded-xl border-2 border-win-200 bg-white px-4 py-3 outline-none focus:border-win-500'

export function Enviar({
  cargando,
  onConfirmar,
  onCancelar,
}: {
  cargando: boolean
  onConfirmar: (contacto: Contacto) => void
  onCancelar: () => void
}) {
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [acepta, setAcepta] = useState(false)

  const telefonoLimpio = telefono.replace(/\D/g, '')
  const telefonoValido = /^9\d{8}$/.test(telefonoLimpio)
  const puedeEnviar = nombre.trim().length >= 3 && telefonoValido && acepta

  return (
    <Pantalla
      titulo="Enviar a WIN"
      bajada="Mandamos tu reporte completo al equipo de soporte. Te contactan por este número."
      pie={
        <>
          <Boton
            cargando={cargando}
            disabled={!puedeEnviar}
            onClick={() => onConfirmar({ nombre: nombre.trim(), telefono: telefonoLimpio })}
          >
            Enviar reporte
          </Boton>
          <Boton variante="texto" onClick={onCancelar} disabled={cargando}>
            Volver al reporte
          </Boton>
        </>
      }
    >
      <label className="block">
        <span className="font-semibold text-win-900">Tu nombre</span>
        <input
          className={CLASE_CAMPO}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          autoComplete="name"
          placeholder="María Rodríguez"
        />
      </label>

      <label className="mt-6 block">
        <span className="font-semibold text-win-900">Celular de contacto</span>
        <input
          className={CLASE_CAMPO}
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          inputMode="numeric"
          autoComplete="tel"
          placeholder="9XX XXX XXX"
        />
        {telefono.length > 0 && !telefonoValido && (
          <span className="mt-2 block text-sm text-malo">
            Debe tener 9 dígitos y empezar con 9.
          </span>
        )}
      </label>

      <label className="mt-7 flex cursor-pointer gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <input
          type="checkbox"
          checked={acepta}
          onChange={(e) => setAcepta(e.target.checked)}
          className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-win-700)]"
        />
        <span className="text-sm leading-relaxed text-gray-700">
          Autorizo a WIN a usar las mediciones de esta sesión y mis datos de contacto para revisar mi
          servicio. No enviamos nada más: ni tu ubicación, ni lo que navegas, ni archivos de tu
          celular.
        </span>
      </label>
    </Pantalla>
  )
}
