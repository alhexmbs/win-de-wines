# Mapa de cobertura (modo caminata)

El cliente camina por su casa, marca piso + habitación, y va tomando puntos.
Al final sale un árbol de cobertura por piso, 🟢🟡🔴, y el mismo mapa viaja
dentro del reporte que se envía a WIN.

## Lo primero que hay que saber decir si lo preguntan

**No existe ninguna API de navegador que entregue el RSSI / dBm del wifi.**
Ni en Chrome Android, ni en Safari iOS, ni detrás de un permiso. `navigator.
connection` da `effective_type`, `downlink` y `rtt`, que son estimaciones que
el navegador calcula del tráfico HTTP reciente, no lecturas del radio. Web
Bluetooth sí da RSSI, pero de dispositivos BLE emparejados, no del access point.

Por eso aquí no hay dBm. Hay un **índice de cobertura 0-100** construido con
cosas que sí se pueden medir desde el navegador: velocidad de descarga real,
latencia y estabilidad, **siempre comparadas contra la medición tomada junto al
router**. Poner un número en dBm derivado del rendimiento sería un dato
fabricado, y es lo primero que un jurado técnico va a picar.

Y el índice **no** dice "qué tan lejos estás del router". Una pared de concreto,
un espejo, una puerta metálica o el microondas del vecino tumban la señal de un
cuarto contiguo; un cuarto lejano con línea de vista puede andar bien. Eso está
escrito en la propia pantalla del mapa, no solo en este archivo.

## Cómo se calcula el índice (`src/medicion/senal.ts`)

| Componente | Peso | Cómo puntúa |
|---|---|---|
| Velocidad | 65% | 100 puntos al llegar al 70% de la velocidad de la referencia |
| Latencia | 25% | 0 puntos con 150 ms por encima de la referencia |
| Estabilidad | 10% | castiga pérdida de pings (>20% = 0) y jitter (>120 ms = 0) |

Bandas: 🟢 70-100 · 🟡 30-69 · 🔴 0-29. Un cuarto donde el test falla es 0, no
"sin dato": es el peor caso posible y es justo lo que el cliente siente.

**Caso importante:** si el router mismo está muy por debajo del plan, el mapa
sale todo verde (el wifi reparte bien lo poco que llega) y el reporte dice que
hay un problema. No es contradicción: son dos fallas distintas. El mapa muestra
un aviso explícito cuando la referencia está bajo el 40% del plan contratado.

## El semáforo en vivo

Mientras se camina, la sonda (`src/medicion/sonda.ts`) hace un ping a un archivo
de 3 bytes cada 2 s: ~0.5 KB por minuto. De ahí sale el color del ícono del
router, con los últimos 6 pings. Es más burdo que un punto medido —por eso la UI
lo marca como «en vivo» y el número firme aparece al pulsar «Tomar punto aquí»—
pero un ping que se dispara a 300 ms o que no vuelve es exactamente lo que pasa
cuando el wifi se está cayendo.

La sonda se pausa durante una medición de punto: si no, los pings competirían
con la descarga y ensuciarían las dos cosas.

## Datos que gasta

| Qué | Cuánto |
|---|---|
| Referencia junto al router | hasta 20 MB (5 MB en modo ahorro) |
| Cada punto | hasta 3 MB (1.5 MB en modo ahorro) |
| Sonda continua | ~0.5 KB por minuto |

La pantalla de caminata muestra el acumulado en MB.

## Varios puntos por habitación

Cada pulsación de «Tomar punto aquí» agrega un punto al cuarto marcado. Al
consolidar se usa la **mediana**, no el promedio: si uno de los puntos cae
porque justo arrancó el microondas, el promedio se hunde y la mediana aguanta
(`pnpm probar:senal` lo demuestra con números).

## Qué recibe B

Nada nuevo que tenga que procesar: sigue llegando **una `Medicion` por
habitación**, igual que el día 1. Los puntos sueltos viajan dentro de
`Medicion.puntos`, y `piso` / `indice` son opcionales. `reglas.ts` no cambió
una línea.

Campos nuevos del contrato, todos opcionales (el contrato solo crece):

- `Medicion`: `piso`, `puntos`, `indice`
- `Punto` y `MuestraRecorrido`: tipos nuevos
- `ResultadoMedicion` y `Sesion`: `recorrido` (los pings de la caminata)

## Archivos

| Archivo | Qué hace |
|---|---|
| `src/medicion/senal.ts` | índice, bandas, semáforo en vivo. Puro, sin DOM |
| `src/medicion/caminata.ts` | agrupa puntos por (piso, cuarto) y consolida. Puro |
| `src/medicion/sonda.ts` | el ping cada 2 s |
| `src/medicion/FlujoCaminata.tsx` | la pantalla de caminata completa |
| `src/medicion/partes/IndicadorSenal.tsx` | ícono del router + semáforo + barritas |
| `src/medicion/partes/SelectorUbicacion.tsx` | piso + habitación, con repetición |
| `src/mapa/ArbolCobertura.tsx` | el árbol por piso (lo comparten vivo y final) |
| `src/mapa/filas.ts` | adaptador Medicion → fila del árbol |
| `src/mapa/MapaCalor.tsx` | el mapa del reporte |

## Cómo se prueba

```bash
pnpm probar:senal     # calibración del índice sobre los 4 mocks, sin navegador
pnpm dev              # http://localhost:5173/lab.html → caminata + mapa + JSON
```

`mocks/sesion_caminata.json` es una sesión de 2 pisos con varios puntos por
cuarto, para probar el mapa y el reporte sin caminar.

## Respaldos para la demo

Si el modo caminata falla en el celular, en `src/App.tsx` se cambia una línea:

```tsx
import { FlujoCaminata as FlujoMedicion } from './medicion/FlujoCaminata'   // actual
import { FlujoMedicion } from './medicion/FlujoMedicion'                    // día 1, sin mapa
import { FlujoMedicionFalso as FlujoMedicion } from './dobles/FlujoMedicionFalso' // sin medir
```

El mapa funciona igual con sesiones del día 1 y con los mocks: cuando no hay
`piso` ni `indice`, los calcula y cuelga todo del piso 1.
