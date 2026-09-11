# Parte A — F1: medición

Todo vive en `src/medicion/`. Lo único fuera de ahí son tres cosas, avisadas:

| Fuera de mi carpeta | Por qué |
|---|---|
| `public/medicion/prueba-4mb.bin` y `ping.txt` | Los archivos que se descargan para medir. Nuevos, sin conflicto. |
| `lab.html` | Segunda entrada de Vite para mi banco de pruebas. Nuevo. |
| `vite.config.ts` | 8 líneas de `rollupOptions.input` para que `lab.html` entre en el build. Aditivo. |
| `src/contrato.ts` | Solo campos **opcionales** nuevos (ver abajo). Nada renombrado ni borrado. |

No creé ninguna función en `api/`: una serverless arrancaría en frío y
envenenaría la latencia. Todo sale de archivos estáticos del CDN, así que la
medición no depende de `vercel dev`, ni de Supabase, ni de la key de B.

## Probar

```bash
pnpm dev
```

| URL | Qué es |
|---|---|
| `http://localhost:5173/lab.html` | Mi banco de pruebas: el flujo solo, sin bienvenida ni onboarding |
| `http://<IP-de-la-laptop>:5173/lab.html` | Lo mismo desde el celular en la misma red |

Al terminar la caminata, `/lab` muestra el JSON y deja descargar dos archivos:

- `resultado.json` — el `ResultadoMedicion` real, lo que recibe C.
- `sesion.json` — el mismo resultado envuelto en una `Sesion` con un contexto
  de mentira, para poder diffearlo contra `mocks/sesion_*.json`.

**Wake Lock no funciona por LAN** (`http://192.168.x.x`) porque no es contexto
seguro. Para probar que la pantalla no se apague hace falta el preview de
Vercel en https. El flujo lo detecta y avisa en pantalla en vez de fallar.

### Probar el núcleo sin navegador

```bash
npx esbuild src/medicion/medir.ts --bundle --format=esm --platform=neutral --outfile=/tmp/medir.mjs
```

Luego desde Node, definiendo `globalThis.location = { href: 'http://localhost:5173/' }`
antes de importar, se puede llamar a `medirCuarto()` directamente. Sirve para
verificar el JSON de salida sin tocar un celular.

## Qué mide y qué no

Esto hay que tenerlo listo si lo preguntan en la presentación.

**No existe API de navegador para leer la señal wifi (RSSI/dBm).** Ninguna. Lo
que hacemos es un test activo y comparar cada cuarto contra la **medición de
referencia tomada junto al router**. Por eso el primer paso del flujo es ir al
router: sin esa línea base no se puede separar "tu internet viene lento desde la
calle" (problema de WIN) de "tu wifi no llega a ese cuarto" (problema de
cobertura), que son las dos respuestas posibles del reto.

Tampoco se puede hacer ping al router: `http://192.168.1.1` lo bloquea el
mixed-content desde https. La latencia es ida y vuelta al CDN.

`perdida_pct` **no es pérdida de paquetes ICMP** — no hay ICMP en el navegador.
Es el % de pings que no respondieron dentro del timeout. Es un proxy honesto,
pero B no debería llamarlo "pérdida de paquetes" en el prompt.

## Cómo se mide

- **Latencia**: 8 pings a un archivo de 3 bytes. El primero se descarta porque
  abre la conexión TLS y sale carísimo. `latencia_ms` es el promedio y
  `jitter_ms` la desviación estándar.
- **Descarga**: 3 conexiones en paralelo bajando un `.bin` de 4 MB de bytes
  aleatorios, contando bytes contra el reloj con `ReadableStream`. Con una sola
  conexión no se satura un plan rápido; con un archivo comprimible, gzip
  inflaría la velocidad.
- **Calentamiento**: se descarta el arranque, que termina a los 700 ms **o** al
  25 % del presupuesto de datos, lo que llegue primero. Sin la segunda
  condición, en un plan de 200 Mbps el tope de datos se agota antes de los
  700 ms y terminaríamos midiendo solo el arranque de TCP.
- **Cache-busting**: cada request lleva un `?cb=` único y va con
  `cache: 'no-store'`. Sin esto, el segundo cuarto lee del disco y reporta miles
  de Mbps. Además se verifica con `transferSize` y, si todo vino del caché, la
  UI avisa y pide repetir el cuarto.

## Datos que consume

| Modo | Por cuarto | Cuándo |
|---|---|---|
| Normal | hasta 20 MB | El usuario confirmó que está en wifi |
| Ahorro | hasta 5 MB | Detectamos datos móviles, o el usuario dijo "no estoy seguro" |

El tope es duro: corta la descarga aunque sobre tiempo. Sin él, 4 segundos a
200 Mbps son 100 MB por cuarto.

## Campos nuevos en el contrato (todos opcionales)

Regla respetada: el contrato solo crece. B y C compilan igual sin tocar nada.

En `Dispositivo`: `conexion_confirmada`, `effective_type`, `downlink_mbps`,
`rtt_ms`, `ahorro_datos`.

En `Medicion`: `bytes_descargados`, `duracion_ms` — para que B pueda descartar
una medición demasiado corta para ser confiable.

`conexion: 'desconocida'` es el caso **normal**, no la excepción:
`navigator.connection` no existe en Safari/iOS ni en Firefox, y `type` —el único
campo que separa wifi de celular— tampoco está garantizado en Chrome. Por eso el
flujo le pregunta al usuario y guarda la respuesta en `conexion_confirmada`.

## Integración 1

En `src/App.tsx`, cambiar una línea:

```diff
-import { FlujoMedicionFalso as FlujoMedicion } from './dobles/FlujoMedicionFalso'
+import { FlujoMedicion } from './medicion/FlujoMedicion'
```

Mismas props: `onTerminar(resultado: ResultadoMedicion)`. `FlujoMedicion` no
recibe el contexto del onboarding ni ve el reporte.
