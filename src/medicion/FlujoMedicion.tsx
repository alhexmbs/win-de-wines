import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispositivo, Medicion, ResultadoMedicion } from '../contrato'
import { Boton } from '../ui/Boton'
import { Pantalla } from '../ui/Pantalla'
import { limpiar, nombreDeReferencia, siguienteSugerido, yaExiste } from './cuartos'
import { detectarDispositivo, sabeDistinguirConexion } from './dispositivo'
import { AHORRO, NORMAL, type Opciones, type Progreso, medirCuarto } from './medir'
import { ListaCuartos } from './partes/ListaCuartos'
import { Medidor } from './partes/Medidor'
import { PasoConexion } from './partes/PasoConexion'
import { SelectorCuarto } from './partes/SelectorCuarto'
import { useWakeLock } from './useWakeLock'

type Paso = 'conexion' | 'referencia' | 'cuartos' | 'midiendo'

const MINIMO_CUARTOS = 2

/**
 * F1 — la caminata completa. Única prop: onTerminar.
 *
 * No recibe el contexto del onboarding ni ve el reporte: entrega dispositivo +
 * mediciones y C arma la Sesion con crearSesion(). Esa es toda la frontera.
 */
export function FlujoMedicion({
  onTerminar,
}: {
  onTerminar: (resultado: ResultadoMedicion) => void
}) {
  const [paso, setPaso] = useState<Paso>('conexion')
  const [dispositivo, setDispositivo] = useState<Dispositivo>(detectarDispositivo)
  const [mediciones, setMediciones] = useState<Medicion[]>([])
  const [opciones, setOpciones] = useState<Opciones>(NORMAL)
  const [cuarto, setCuarto] = useState('')
  const [progreso, setProgreso] = useState<Progreso | null>(null)
  const [midiendoCuarto, setMidiendoCuarto] = useState('')
  const [avisoCache, setAvisoCache] = useState(false)

  const cancelar = useRef<AbortController | null>(null)
  const wakeLock = useWakeLock(paso === 'midiendo')

  const nombres = mediciones.map((m) => m.cuarto)
  const referencia = mediciones.find((m) => m.es_referencia)

  useEffect(() => () => cancelar.current?.abort(), [])

  const medir = useCallback(
    async (nombre: string, esReferencia: boolean, dispositivoActual: Dispositivo) => {
      const ctrl = new AbortController()
      cancelar.current = ctrl

      setMidiendoCuarto(nombre)
      setProgreso(null)
      setPaso('midiendo')

      try {
        const { medicion, desdeCache } = await medirCuarto(
          nombre,
          esReferencia,
          opciones,
          setProgreso,
          ctrl.signal,
        )
        if (ctrl.signal.aborted) return

        setAvisoCache(desdeCache)
        // Reemplaza en el sitio si es una repetición: el orden de la caminata
        // importa, y la referencia tiene que seguir siendo la primera.
        setMediciones((prev) => {
          const i = prev.findIndex((m) => m.cuarto === nombre)
          if (i === -1) return [...prev, medicion]
          const copia = [...prev]
          copia[i] = medicion
          return copia
        })
        setDispositivo({ ...dispositivoActual, ...datosDeRedFrescos() })
        setCuarto('')
        setPaso('cuartos')
      } catch {
        if (!ctrl.signal.aborted) setPaso(esReferencia ? 'referencia' : 'cuartos')
      } finally {
        cancelar.current = null
        setProgreso(null)
      }
    },
    [opciones],
  )

  function cancelarMedicion() {
    cancelar.current?.abort()
    cancelar.current = null
    setProgreso(null)
    setPaso(referencia === undefined ? 'referencia' : 'cuartos')
  }

  /* ─────────────── 1. wifi o datos móviles ─────────────── */

  if (paso === 'conexion') {
    return (
      <PasoConexion
        dispositivo={dispositivo}
        detectaConexion={sabeDistinguirConexion()}
        onRevisar={() => setDispositivo(detectarDispositivo())}
        onConfirmarWifi={() => {
          setDispositivo((d) => ({ ...d, conexion_confirmada: true }))
          setPaso('referencia')
        }}
        onSeguirEnAhorro={() => {
          setOpciones(AHORRO)
          setPaso('referencia')
        }}
      />
    )
  }

  /* ─────────────── 2. la medición de referencia ─────────────── */

  if (paso === 'referencia') {
    const nombre = cuarto === '' ? 'Sala' : cuarto
    return (
      <Pantalla
        paso={2}
        titulo="Párate junto a tu router"
        bajada="Esta primera medición es la referencia: lo mejor que tu casa puede dar. Todo lo demás se compara contra ella."
        pie={
          <Boton onClick={() => void medir(nombreDeReferencia(nombre), true, dispositivo)}>
            Medir aquí
          </Boton>
        }
      >
        <div className="rounded-2xl border border-win-200 bg-win-100/70 p-4 text-sm leading-snug text-win-900">
          Sin esta medición no podemos separar dos problemas distintos: que tu internet venga lento
          desde la calle, o que tu wifi no llegue bien a un cuarto. Son soluciones muy diferentes.
        </div>

        <p className="mt-6 mb-3 font-semibold text-win-900">¿En qué cuarto está el router?</p>
        <SelectorCuarto valor={cuarto} usados={[]} onCambiar={setCuarto} />

        {opciones === AHORRO && (
          <p className="mt-4 text-sm text-gray-600">
            Modo ahorro activado: usaremos unos 5 MB por cuarto en vez de 20.
          </p>
        )}
      </Pantalla>
    )
  }

  /* ─────────────── 3. midiendo ─────────────── */

  if (paso === 'midiendo') {
    return (
      <Medidor
        cuarto={midiendoCuarto}
        progreso={progreso}
        pantallaEncendida={wakeLock === 'activo'}
        onCancelar={cancelarMedicion}
      />
    )
  }

  /* ─────────────── 4. el resto de la casa ─────────────── */

  // Si el usuario todavía no eligió, el selector ya muestra una sugerencia:
  // el botón tiene que referirse a esa misma, no quedarse deshabilitado.
  const seleccion = cuarto === '' ? siguienteSugerido(nombres) : cuarto
  const nombreLimpio = limpiar(seleccion)
  const puedeMedir = nombreLimpio.length >= 2 && !yaExiste(nombreLimpio, nombres)
  const listo = mediciones.length >= MINIMO_CUARTOS

  return (
    <Pantalla
      paso={2}
      titulo="Camina por tu casa"
      bajada="Ve a otro cuarto, marca cuál es y mide. Mientras más cuartos, mejor el reporte."
      pie={
        <>
          <Boton
            disabled={!puedeMedir}
            onClick={() => void medir(nombreLimpio, false, dispositivo)}
          >
            {puedeMedir ? `Medir ${nombreLimpio}` : 'Elige un cuarto'}
          </Boton>
          <Boton
            variante={listo ? 'secundario' : 'texto'}
            disabled={!listo}
            onClick={() => onTerminar({ dispositivo, mediciones })}
          >
            {listo
              ? `Terminar y ver mi reporte (${mediciones.length})`
              : `Mide al menos ${MINIMO_CUARTOS} puntos`}
          </Boton>
        </>
      }
    >
      {avisoCache && (
        <p className="mb-4 rounded-xl bg-malo-bg p-3 text-sm text-malo">
          La última medición salió del caché del navegador, así que el número no es real. Repite ese
          cuarto.
        </p>
      )}

      <ListaCuartos
        mediciones={mediciones}
        onRepetir={(nombre) => {
          const previa = mediciones.find((m) => m.cuarto === nombre)
          void medir(nombre, previa?.es_referencia ?? false, dispositivo)
        }}
        onBorrar={(nombre) => setMediciones((prev) => prev.filter((m) => m.cuarto !== nombre))}
      />

      <p className="mt-6 mb-3 font-semibold text-win-900">¿Dónde estás ahora?</p>
      <SelectorCuarto valor={seleccion} usados={nombres} onCambiar={setCuarto} />

      {referencia === undefined && (
        <p className="mt-4 text-sm text-malo">
          Borraste la medición de referencia. Sin ella el reporte pierde la comparación; vuelve al
          router y mide ahí de nuevo.
        </p>
      )}
    </Pantalla>
  )
}

/** navigator.connection cambia durante la caminata; nos quedamos con lo último. */
function datosDeRedFrescos(): Partial<Dispositivo> {
  const d = detectarDispositivo()
  const fresco: Partial<Dispositivo> = {
    effective_type: d.effective_type,
    downlink_mbps: d.downlink_mbps,
    rtt_ms: d.rtt_ms,
    ahorro_datos: d.ahorro_datos,
  }
  // Solo pisamos `conexion` si el navegador de verdad sabe distinguirla; si no,
  // la respuesta del usuario en el primer paso vale más que un 'desconocida'.
  if (sabeDistinguirConexion()) fresco.conexion = d.conexion
  return fresco
}
