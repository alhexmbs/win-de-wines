/**
 * POST /api/enviar — guarda la sesión + el reporte y devuelve un ticket.
 * Dueño: C. B no toca este archivo (el suyo es api/reporte.ts).
 *
 * Variables de entorno (Vercel → Settings → Environment Variables):
 *   SUPABASE_URL               https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY  service_role (solo servidor, nunca en el cliente)
 *
 * Si faltan, el endpoint igual responde con un ticket y guardado:false,
 * para que la demo nunca se caiga por un problema de base de datos.
 */

const LIMITE_BYTES = 512 * 1024

function json(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function generarTicket(): string {
  const d = new Date()
  const fecha = [
    String(d.getUTCFullYear()).slice(2),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    String(d.getUTCDate()).padStart(2, '0'),
  ].join('')
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sin I/O/0/1
  let sufijo = ''
  for (let i = 0; i < 4; i++) {
    sufijo += alfabeto[Math.floor(Math.random() * alfabeto.length)]
  }
  return `WIN-${fecha}-${sufijo}`
}

function telefonoValido(t: unknown): t is string {
  return typeof t === 'string' && /^9\d{8}$/.test(t)
}

async function guardarEnSupabase(fila: Record<string, unknown>): Promise<boolean> {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.warn('[enviar] Supabase no configurado; se responde en modo demo.')
    return false
  }
  try {
    const res = await fetch(`${url}/rest/v1/reportes`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(fila),
    })
    if (!res.ok) {
      console.error('[enviar] Supabase respondió', res.status, await res.text())
      return false
    }
    return true
  } catch (e) {
    console.error('[enviar] Supabase falló', e)
    return false
  }
}

export async function POST(request: Request): Promise<Response> {
  const largo = Number(request.headers.get('content-length') ?? 0)
  if (largo > LIMITE_BYTES) {
    return json({ error: 'El reporte es demasiado grande.' }, 413)
  }

  let cuerpo: any
  try {
    cuerpo = await request.json()
  } catch {
    return json({ error: 'JSON inválido.' }, 400)
  }

  const { sesion, reporte, contacto } = cuerpo ?? {}

  if (!sesion || !Array.isArray(sesion.mediciones) || sesion.mediciones.length === 0) {
    return json({ error: 'Falta la sesión con al menos una medición.' }, 400)
  }
  if (!reporte || typeof reporte.resumen !== 'string') {
    return json({ error: 'Falta el reporte.' }, 400)
  }
  if (!contacto || typeof contacto.nombre !== 'string' || contacto.nombre.trim().length < 3) {
    return json({ error: 'Falta el nombre de contacto.' }, 400)
  }
  if (!telefonoValido(contacto.telefono)) {
    return json({ error: 'El celular debe tener 9 dígitos y empezar con 9.' }, 400)
  }

  const ticket = generarTicket()

  const guardado = await guardarEnSupabase({
    ticket,
    sesion_id: String(sesion.sesion_id ?? ''),
    nombre: contacto.nombre.trim().slice(0, 120),
    telefono: contacto.telefono,
    calificacion_general: reporte.calificacion_general ?? null,
    requiere_visita_tecnica: reporte.requiere_visita_tecnica === true,
    generado_por: reporte.generado_por ?? null,
    sesion,
    reporte,
  })

  return json({ ok: true, ticket, guardado })
}

/** Chequeo rápido: GET /api/enviar dice si la base está configurada. */
export function GET(): Response {
  return json({
    ok: true,
    supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
  })
}
