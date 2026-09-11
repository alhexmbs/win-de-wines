# Parte C — shell, onboarding, reporte y envío

## Correr en local

```bash
pnpm install
pnpm dev            # solo el front; /api/* NO existe con vite dev
```

Para probar el endpoint de envío hace falta el runtime de Vercel:

```bash
npx vercel dev      # sirve el front Y las funciones de api/
```

## Atajos de demo

| URL | Qué hace |
|---|---|
| `/` | Flujo completo desde el inicio |
| `/?mock=ok` | Salta al reporte, escenario "todo bien" |
| `/?mock=cobertura` | Salta al reporte, escenario "no llega al 2do piso" |
| `/?mock=general` | Salta al reporte, escenario "falla general" |

Desde cualquiera de esos se puede seguir a Enviar → Confirmación, así que el
envío se prueba sin caminar por la casa.

## Probar /api/enviar sin la app

```bash
curl -s -X POST http://localhost:3000/api/enviar \
  -H 'Content-Type: application/json' \
  -d "{\"sesion\":$(cat mocks/sesion_cobertura.json),\"reporte\":$(cat mocks/reporte_cobertura.json),\"contacto\":{\"nombre\":\"Maria Rodriguez\",\"telefono\":\"987654321\"}}"

curl -s http://localhost:3000/api/enviar   # dice si Supabase está configurado
```

Respuesta esperada: `{"ok":true,"ticket":"WIN-260911-K7QM","guardado":true}`.
`guardado:false` significa que faltan las env vars de Supabase — la app sigue
funcionando y lo avisa en la pantalla de confirmación.

## Variables de entorno (Vercel, y `.env.local` para `vercel dev`)

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...        # service_role, solo servidor
```

La tabla está en `docs/supabase.sql`.

## Los dos dobles y cómo se reemplazan (Integración 1)

| Doble | Archivo | Reemplazo |
|---|---|---|
| Flujo de medición (A) | `src/dobles/FlujoMedicionFalso.tsx` | En `src/App.tsx`, cambiar el import por `./medicion/FlujoMedicion`. Mismas props: `onTerminar(resultado: ResultadoMedicion)`. Después se borra la carpeta `src/dobles/`. |
| Reporte con IA (B) | `obtenerReporte()` en `src/api.ts` | Poner `VITE_REPORTE_REAL=1` en las env vars de Vercel (o cambiar la constante). Pasa a hacer `POST /api/reporte` con `{ sesion }` y espera un `Reporte`. |

Ninguno de los dos cambios toca el contrato.

## Día 2: dónde entran el mapa y el chat

`src/pantallas/Reporte.tsx` ya acepta dos props opcionales, `mapa` y `chat`.
En `src/App.tsx`, caso `'reporte'`, hay dos líneas comentadas listas:

```tsx
mapa={<MapaCalor sesion={s.sesion} reporte={s.reporte} />}
chat={<Chat sesion={s.sesion} reporte={s.reporte} />}
```

Son las únicas dos líneas del día 2 en el archivo de unión.

## Nota sobre la firma de las funciones

`api/enviar.ts` usa la firma Web de Vercel (`export async function POST(request: Request)`).
Si el deploy se queja, la alternativa Node es:

```ts
export default async function handler(req: any, res: any) { /* req.body, res.status().json() */ }
```

No cambia nada del cliente.
