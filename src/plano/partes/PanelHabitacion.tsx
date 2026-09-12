import { type ReactNode, useState } from 'react'
import type { Habitacion } from '../../contrato'
import { limpiar } from '../../medicion/cuartos'
import { Boton } from '../../ui/Boton'
import { Icono, IconoMas, IconoPapelera, IconoWifi } from '../../ui/Iconos'
import {
  type Accion,
  type EstadoPlano,
  habitacionDelRouter,
  puedeBorrarHabitacion,
  puedeUbicarRouterEn,
  puntosDe,
} from '../estado'
import { LADO_MAXIMO, LADO_MINIMO, PASO_GRILLA } from '../geometria'

const SIN_LUGAR = 'No hay lugar: chocaría con otra habitación. Mueve esa primero.'

const FLECHAS: [string, number, number, string][] = [
  ['la izquierda', -1, 0, 'M15 6l-6 6 6 6'],
  ['arriba', 0, -1, 'M6 15l6-6 6 6'],
  ['abajo', 0, 1, 'M6 9l6 6 6-6'],
  ['la derecha', 1, 0, 'M9 6l6 6-6 6'],
]

function metros(m: number): string {
  return `${m.toLocaleString('es', { maximumFractionDigits: 1 })} m`
}

/**
 * Editar una habitación: nombre, tamaño, posición, router y borrado.
 *
 * Todo lo que se puede hacer arrastrando en el plano también se puede hacer
 * aquí con botones: arrastrar con precisión en un celular es difícil, y con
 * lector de pantalla, imposible. Montarlo con `key={habitacion.id}`.
 */
export function PanelHabitacion({
  estado,
  habitacion: h,
  onAccion,
  onAgregarAlLado,
  onCerrar,
}: {
  estado: EstadoPlano
  habitacion: Habitacion
  /** Devuelve null si el reducer rechazó la acción. */
  onAccion: (accion: Accion) => EstadoPlano | null
  onAgregarAlLado: () => void
  onCerrar: () => void
}) {
  const [nombre, setNombre] = useState(h.nombre)
  const [aviso, setAviso] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)

  const puntos = puntosDe(estado, h.id).length
  const esDelRouter = habitacionDelRouter(estado)?.id === h.id

  function aplicar(accion: Accion, siFalla: string) {
    setAviso(onAccion(accion) === null ? siFalla : null)
  }

  function guardarNombre() {
    const limpio = limpiar(nombre)
    if (limpio === h.nombre) return
    if (limpio.length < 2) {
      setAviso('El nombre necesita al menos 2 letras.')
      setNombre(h.nombre)
      return
    }
    if (onAccion({ tipo: 'renombrar_habitacion', id: h.id, nombre: limpio }) === null) {
      setAviso(`Ya hay otra habitación llamada «${limpio}» en este piso.`)
      setNombre(h.nombre)
      return
    }
    setAviso(null)
  }

  return (
    <section
      aria-label={`Editar ${h.nombre}`}
      className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-win-200/40"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
          Habitación · Piso {h.piso}
        </p>
        <button
          type="button"
          onClick={onCerrar}
          className="text-sm font-semibold text-win-700 underline underline-offset-4"
        >
          Listo
        </button>
      </div>

      <input
        type="text"
        value={nombre}
        maxLength={40}
        aria-label="Nombre de la habitación"
        onChange={(e) => setNombre(e.target.value)}
        onBlur={guardarNombre}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        className="mt-2 w-full rounded-xl border-2 border-win-200 bg-white px-3 py-2 text-lg font-bold text-win-900 outline-none focus:border-win-500"
      />
      <p className="mt-1 text-sm text-gray-500">
        {puntos === 0
          ? 'Sin medir todavía.'
          : `${puntos} ${puntos === 1 ? 'punto medido' : 'puntos medidos'}.`}
      </p>

      {esDelRouter ? (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-win-100 px-3 py-2 text-sm font-semibold text-win-900">
          <IconoWifi className="h-5 w-5 text-win-700" />
          El router está aquí
        </p>
      ) : (
        puedeUbicarRouterEn(estado, h.id) && (
          <Boton
            variante="secundario"
            className="mt-3 py-3"
            onClick={() =>
              aplicar({ tipo: 'ubicar_router', habitacion_id: h.id }, 'No se pudo marcar el router aquí.')
            }
          >
            <IconoWifi className="h-5 w-5" />
            El router está en esta habitación
          </Boton>
        )
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Medida
          etiqueta="Ancho"
          valor={h.ancho}
          onMenos={
            h.ancho > LADO_MINIMO
              ? () =>
                  aplicar(
                    { tipo: 'redimensionar_habitacion', id: h.id, ancho: h.ancho - PASO_GRILLA, alto: h.alto },
                    SIN_LUGAR,
                  )
              : null
          }
          onMas={
            h.ancho < LADO_MAXIMO
              ? () =>
                  aplicar(
                    { tipo: 'redimensionar_habitacion', id: h.id, ancho: h.ancho + PASO_GRILLA, alto: h.alto },
                    SIN_LUGAR,
                  )
              : null
          }
        />
        <Medida
          etiqueta="Largo"
          valor={h.alto}
          onMenos={
            h.alto > LADO_MINIMO
              ? () =>
                  aplicar(
                    { tipo: 'redimensionar_habitacion', id: h.id, ancho: h.ancho, alto: h.alto - PASO_GRILLA },
                    SIN_LUGAR,
                  )
              : null
          }
          onMas={
            h.alto < LADO_MAXIMO
              ? () =>
                  aplicar(
                    { tipo: 'redimensionar_habitacion', id: h.id, ancho: h.ancho, alto: h.alto + PASO_GRILLA },
                    SIN_LUGAR,
                  )
              : null
          }
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-gray-600">Mover</p>
        <div className="flex gap-1.5">
          {FLECHAS.map(([hacia, fx, fy, trazo]) => {
            const alBorde = (fx < 0 && h.x <= 0) || (fy < 0 && h.y <= 0)
            return (
              <BotonChico
                key={hacia}
                etiqueta={`Mover hacia ${hacia}`}
                onClick={
                  alBorde
                    ? null
                    : () =>
                        aplicar(
                          {
                            tipo: 'mover_habitacion',
                            id: h.id,
                            x: h.x + fx * PASO_GRILLA,
                            y: h.y + fy * PASO_GRILLA,
                          },
                          SIN_LUGAR,
                        )
                }
              >
                <Icono className="h-5 w-5">
                  <path d={trazo} />
                </Icono>
              </BotonChico>
            )
          })}
        </div>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        También puedes arrastrarla en el plano, y cambiar su tamaño desde la esquina.
      </p>

      {aviso !== null && (
        <p role="status" className="mt-3 rounded-xl bg-regular-bg p-3 text-sm text-regular">
          {aviso}
        </p>
      )}

      <Boton variante="secundario" className="mt-4 py-3" onClick={onAgregarAlLado}>
        <IconoMas className="h-4 w-4" />
        Agregar habitación al lado
      </Boton>

      {!puedeBorrarHabitacion(estado, h.id) ? (
        <p className="mt-3 text-xs leading-relaxed text-gray-500">
          Es la habitación del router y ya tiene la medición de referencia. Toda la casa se compara
          contra ella, así que no se puede borrar.
        </p>
      ) : confirmando ? (
        <div className="mt-3 rounded-xl bg-malo-bg p-3">
          <p className="text-sm text-malo">
            {puntos > 0
              ? `¿Borrar ${h.nombre} y sus ${puntos} ${puntos === 1 ? 'punto' : 'puntos'}? Lo medido aquí se pierde.`
              : `¿Borrar ${h.nombre}?`}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => onAccion({ tipo: 'borrar_habitacion', id: h.id })}
              className="flex-1 rounded-xl bg-malo py-2 text-sm font-semibold text-white"
            >
              Sí, borrar
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="flex-1 rounded-xl bg-white py-2 text-sm font-semibold text-gray-700"
            >
              No
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="mt-3 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-malo transition hover:bg-malo-bg"
        >
          <IconoPapelera className="h-4 w-4" />
          Borrar habitación
        </button>
      )}
    </section>
  )
}

function Medida({
  etiqueta,
  valor,
  onMenos,
  onMas,
}: {
  etiqueta: string
  valor: number
  onMenos: (() => void) | null
  onMas: (() => void) | null
}) {
  return (
    <div className="rounded-xl bg-win-50 p-2">
      <p className="px-1 text-xs font-semibold tracking-wide text-gray-500 uppercase">{etiqueta}</p>
      <div className="mt-1 flex items-center justify-between gap-1">
        <BotonChico etiqueta={`Menos ${etiqueta.toLowerCase()}`} onClick={onMenos}>
          <Icono className="h-5 w-5">
            <path d="M5 12h14" />
          </Icono>
        </BotonChico>
        <span className="font-bold text-win-900 tabular-nums">{metros(valor)}</span>
        <BotonChico etiqueta={`Más ${etiqueta.toLowerCase()}`} onClick={onMas}>
          <IconoMas className="h-5 w-5" />
        </BotonChico>
      </div>
    </div>
  )
}

function BotonChico({
  etiqueta,
  onClick,
  children,
}: {
  etiqueta: string
  onClick: (() => void) | null
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      title={etiqueta}
      disabled={onClick === null}
      onClick={onClick ?? undefined}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-win-700 ring-1 ring-win-200 transition active:scale-95 disabled:opacity-40"
    >
      {children}
    </button>
  )
}
