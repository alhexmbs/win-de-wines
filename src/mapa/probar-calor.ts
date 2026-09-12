import { celdasDeCalor, colorDeIndice } from './calor.ts'

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FALLÓ: ${msg}`)
}

// Sobre el punto medido, la celda debe salir con exactamente su índice.
{
  const celdas = celdasDeCalor([{ x: 1, y: 1, indice: 80 }], { x: 0, y: 0, ancho: 2, alto: 2 }, 1, 2.5)
  const sobreElPunto = celdas.find((c) => c.x <= 1 && c.x + c.lado > 1 && c.y <= 1 && c.y + c.lado > 1)
  assert(sobreElPunto?.indice === 80, 'la celda sobre el punto debe tener su mismo índice')
}

// Más lejos que DISTANCIA_MAXIMA de cualquier punto: gris (null), no un número inventado.
{
  const celdas = celdasDeCalor([{ x: 0, y: 0, indice: 100 }], { x: 0, y: 0, ancho: 10, alto: 10 }, 1, 2)
  const lejos = celdas.find((c) => c.x >= 8)
  assert(lejos?.indice === null, 'lejos de todo punto medido debe salir null (gris)')
}

// Entre dos puntos, el valor interpolado queda entre los dos extremos.
{
  const celdas = celdasDeCalor(
    [
      { x: 0, y: 0, indice: 0 },
      { x: 4, y: 0, indice: 100 },
    ],
    { x: 0, y: 0, ancho: 4, alto: 1 },
    1,
    5,
  )
  const medio = celdas.find((c) => c.x >= 1.5 && c.x <= 2.5)
  const valorMedio = medio?.indice ?? null
  assert(valorMedio !== null && valorMedio > 0 && valorMedio < 100, 'el punto medio debe quedar entre los dos extremos')
}

// Sin puntos: no hay nada que dibujar.
assert(celdasDeCalor([], { x: 0, y: 0, ancho: 5, alto: 5 }).length === 0, 'sin puntos, sin celdas')

// Los colores en los extremos y el gris de "sin datos" no deben repetirse.
{
  const malo = colorDeIndice(0)
  const bueno = colorDeIndice(100)
  const sinDatos = colorDeIndice(null)
  assert(malo !== bueno && malo !== sinDatos && bueno !== sinDatos, 'los 3 colores deben ser distintos')
}

console.log('calor.ts: todas las pruebas pasaron')
