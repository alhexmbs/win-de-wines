# Caminata sobre plano (en construcción)

Evolución del modo caminata (`docs/README-MAPA.md`): las mismas mediciones, ubicadas
en un esquema de la vivienda, para dibujar un mapa de calor y recomendar dónde
poner un repetidor. Se construye por fases y este archivo crece con cada una.

| Fase | Qué | Estado |
|---|---|---|
| F1 | Modelo de datos, estado, respaldo local | ✅ |
| F2 | Editor y visualización del esquema (SVG) | ✅ (en `lab.html?plano`) |
| F3 | Puntos sobre el plano, `FlujoPlano` en la app | ✅ |
| F4 | Resultados en el reporte | pendiente |
| F5 | Mapa de calor (IDW restringido por habitación) | pendiente |
| F6 | Análisis: zonas, repetidor, mesh, proveedor | pendiente |
| F7 | Chat | pendiente |
| F8 | Pulido | pendiente |

## Decisiones tomadas

- **Se evoluciona la caminata, no se hace un módulo aparte.** Misma medición, misma
  `Sesion`, mismo reporte y mismo envío. `FlujoCaminata` queda como respaldo.
- **Dibujar es opcional.** La app arma sola el esquema (habitaciones de 3×3 m en una
  grilla de 3 columnas) a medida que el usuario elige cuartos de la lista. Acomodarlo
  es opcional; si alguien mueve o cambia el tamaño de algo, `disposicion` pasa a
  `'usuario'`.
- **Rayitas de wifi declaradas, como dato auxiliar.** Es lo único parecido a «potencia
  de señal» que se puede tener sin inventar: lo que el usuario ve en el ícono de su
  celular. No entra en el índice ni pinta el mapa.
- **Chat:** Claude Sonnet 5 con el SDK oficial de Anthropic, solo en el servidor
  (`api/chat.ts`). El front no suma dependencias.

## Qué es medido y qué es declarado

| Dato | Origen | Dónde |
|---|---|---|
| Mbps, ms, jitter, % de pings sin respuesta | **Medido** por la app | `Punto` (sin cambios) |
| Índice 0-100 | **Calculado** a partir de lo medido | `Punto.indice`, `Medicion.indice` |
| Pisos, habitaciones, tamaños | **Declarado**, aproximado | `Plano` |
| Dónde está el router | **Declarado** | `Plano.router` |
| Posición del punto | **Declarada** si el usuario tocó el plano. Si eligió el cuarto de la lista, la app lo pone en espiral alrededor del centro solo para poder dibujarlo | `Punto.x`, `Punto.y` |
| Rayitas de wifi | **Declarado** por el usuario | `Punto.senal_declarada` |
| RSSI / dBm, SSID, banda, canal | **No disponible**: ningún navegador lo expone | — |

## Contrato: campos nuevos, todos opcionales

- Tipos nuevos: `SenalDeclarada`, `Plano`, `PisoPlano`, `Habitacion`, `UbicacionRouter`.
- `Punto`: `habitacion_id`, `x`, `y`, `senal_declarada`.
- `Medicion`: `habitacion_id`.
- `ResultadoMedicion` y `Sesion`: `plano`.
- `crearSesion()` copia `plano` solo si viene: una sesión sin plano no gana la clave.

Sigue llegando una `Medicion` por habitación con la misma etiqueta `cuarto`, así que
`reglas.ts`, `api/reporte.ts`, `api/enviar.ts` y Supabase no cambian.

Coordenadas en metros, origen arriba a la izquierda de cada piso, `y` hacia abajo
(igual que SVG).

## Estado (`src/plano/estado.ts`)

Reducer puro, `reducirPlano(estado, accion)`, pensado para `useReducer`. Acciones:
`agregar_piso`, `agregar_habitacion`, `mover_habitacion`, `redimensionar_habitacion`,
`renombrar_habitacion`, `borrar_habitacion`, `ubicar_router`, `agregar_punto`,
`mover_punto`, `borrar_punto`, `declarar_senal`.

`agregar_punto` acepta dos destinos: una habitación (el usuario tocó el plano) o
piso + nombre (lo eligió de la lista; si la habitación no existe se crea sola). Con
`junto_al_router: true` es la medición de referencia y fija el router ahí.

Reglas que hace cumplir. Si una acción las rompe, devuelve el mismo objeto de estado:

- La habitación del router es la referencia: no se borra mientras tenga puntos, y no
  se queda sin su último punto (tampoco arrastrándolo a otro cuarto).
- El router solo cambia de habitación mientras la referencia no tenga puntos.
- No hay dos habitaciones con el mismo nombre en el mismo piso.
- Las habitaciones de un piso no se pisan, y cada punto queda dentro de la suya.
- Rayitas válidas: enteros, `0 ≤ barras ≤ maximo ≤ 5`.

Ids `h1`, `p2`… salen de un contador del estado y nunca se reusan. El `id` de un
punto no viaja en el contrato.

`paradasDe()` convierte el estado en las `Parada` de `caminata.ts`, así la mediana,
el índice y las etiquetas salen de `consolidar()` sin tocarlo.

## Editor del esquema (F2)

Todavía no está en la app: se prueba en `lab.html?plano`, que arranca con
`mocks/sesion_plano.json`.

| Archivo | Qué hace |
|---|---|
| `src/plano/partes/EditorPlano.tsx` | El piso en SVG: habitaciones, router, puntos, zoom |
| `src/plano/partes/SelectorPiso.tsx` | Pestañas de piso + agregar piso |
| `src/plano/partes/AgregarHabitacion.tsx` | Elegir nombre; la habitación aparece sola en el esquema |
| `src/plano/partes/PanelHabitacion.tsx` | Nombre, tamaño, mover, router, borrar |
| `src/plano/partes/DetallePunto.tsx` | Lo medido en un punto (solo lectura) |
| `src/plano/vista.ts` | Zoom, desplazamiento, ajuste al piso, tamaño de etiquetas. Puro |
| `src/plano/usePlano.ts` | El estado para React; `despachar` devuelve `null` si se rechazó |
| `src/plano/LabPlano.tsx` | El banco de pruebas |

**Por qué SVG:** las habitaciones, textos y marcas son nodos del DOM, así que tocar,
enfocar con teclado y leer con lector de pantalla salen gratis, y los colores son
las mismas clases de Tailwind (`fill-bueno`, `stroke-win-700`) que el resto de la
app. Con Canvas habría que detectar a mano qué se tocó.

**Cómo se usa, pensado para no mover nada sin querer:**

- Arrastrar el fondo, o una habitación no seleccionada, desplaza la vista.
- Tocar una habitación la selecciona. Ya seleccionada, arrastrarla la mueve y la
  esquina inferior derecha le cambia el tamaño (ajustado a 0,5 m; no deja encimar).
- Tocar un punto lo selecciona. Tocar el fondo quita la selección.
- Botones de acercar, alejar y ver todo el piso. La vista se reajusta sola al
  cambiar de piso o cuando aparece o desaparece una habitación.
- Todo lo que se hace arrastrando también se puede hacer con botones en el panel, y
  con teclado: Tab, Enter para seleccionar, flechas para mover y Shift + flechas
  para el tamaño.

**Qué se dibuja:** cada punto es un círculo del color de su nivel con las mismas
barras de `IconoNivel` adentro, para que el nivel se lea por la forma y no solo por
el color. Las habitaciones sin puntos dicen «sin medir». Las etiquetas miden 13 px
en pantalla con cualquier zoom.

**Capas del SVG, de abajo arriba:** grilla, habitaciones, router, zonas de toque de
los puntos, marcadores de punto, nombres y asa de tamaño. El orden no es estético;
dos bugs vistos al probarlo en un navegador lo fijaron así:

- Si cada punto llevaba pegada su zona de toque (más grande que el círculo, para
  acertar con el dedo), la del punto dibujado después tapaba el círculo del vecino,
  y tocar un punto abría el de al lado. Ahora todas las zonas van debajo de todos
  los marcadores.
- En un celular, con el piso entero a la vista, los puntos tapaban los nombres. Los
  nombres van encima, con un borde del color del fondo y sin capturar toques. Además,
  los puntos automáticos se reparten con 0,8 m de separación (antes 0,45).

Fuera de F2, a propósito: agregar o mover puntos (F3), mapa de calor (F5) y
pellizco para hacer zoom (F8).

## La caminata sobre plano en la app (F3)

`src/App.tsx` usa `FlujoPlano` (`src/plano/FlujoPlano.tsx`). Tiene las mismas props que
`FlujoCaminata`, así que volver a la caminata sin plano es cambiar una línea (está
escrita en el comentario del import). `lab.html` prueba lo mismo que la app;
`lab.html?caminata` abre el respaldo y `lab.html?plano` el editor solo.

Pasos: (retomar) → conexión → referencia junto al router → caminata ⇄ midiendo ⇄
resultado. Los mismos que la caminata, con la misma medición (`useMedirPunto`) y el
mismo semáforo (`useSondaEnVivo`, que salió de `FlujoCaminata` para compartirlo).

**Dónde se guarda cada punto.** Tres formas; ninguna obliga a dibujar:

| El usuario… | Destino | Posición |
|---|---|---|
| elige un cuarto que ya existe en la lista | esa habitación | automática, en espiral (solo para dibujarlo) |
| elige o escribe un cuarto que no existe | se crea en el esquema automático | automática |
| toca el plano donde está parado | la habitación tocada | la que tocó: se dibuja una marca «estás aquí» |

**El editor tiene dos modos.** «Medir» (por defecto): tocar el plano marca dónde
estás, y el punto seleccionado se arrastra para corregir dónde quedó. Las
habitaciones no se mueven, porque caminando con el celular en la mano es fácil
rozarlas. «Acomodar habitaciones» es el editor de F2 completo.

**Con un punto ya guardado** (tocándolo): repetir la medición en el mismo lugar
(acción `reemplazar_punto`: cifras nuevas, mismo id, lugar y orden), corregir las
rayitas o borrarlo con confirmación. El único punto de la referencia no se borra.

**Rayitas de wifi.** Después de cada medición, opcional, con «No sé» elegido por
defecto. Se pregunta por el abanico de wifi, no por las barras del celular. El
máximo es 3 en iPhone y 4 en lo demás, y se puede cambiar. Nunca entra en el índice.

**Recorrido guardado.** Cada cambio se guarda en `localStorage`. Al volver a entrar
se ofrece seguir o empezar de cero; al seguir se pregunta otra vez por la conexión y
se salta la referencia, que ya está medida. Se borra al pulsar «Terminar». Lo que no
se guarda: los pings del semáforo, los MB gastados y el modo ahorro.

Corregido de paso: en «Otro…» de `SelectorUbicacion` no se podía escribir un nombre
de dos palabras, porque cada tecla recortaba el espacio del final.

## Respaldo local (`src/plano/persistencia.ts`)

`localStorage`, clave `wintest.recorrido.v1`, vigencia de 12 horas, forma validada al
cargar y todo dentro de `try/catch`. Lo usa `FlujoPlano`.

## Refactor sin cambio de comportamiento

`FlujoCaminata` delega la toma de un punto en `src/medicion/useMedirPunto.ts`
(medición, progreso, aviso de caché, contador de datos, cancelar), para que la
caminata sobre plano mida exactamente igual. `datosDeRedFrescos()` pasó a
`dispositivo.ts`.

## Cómo se prueba

```bash
pnpm probar:plano                   # reglas, recorrido de ejemplo, compatibilidad, respaldo
pnpm probar:plano --escribir-mock   # además regenera mocks/sesion_plano.json
```

`mocks/sesion_plano.json` es el recorrido del ejemplo del diseño: router en la sala,
2 pisos y un pasillo sin medir. Las cifras son datos de prueba, no una medición
real. Todavía no está en `?mock=`: entra en F4, cuando el reporte sepa dibujar el
plano.
