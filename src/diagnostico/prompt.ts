/**
 * prompt.ts — B, día 1.
 *
 * El LLM NUNCA ve los números crudos para "opinar" sobre ellos: recibe el
 * reporte de reglas.ts ya calculado (estado y % por cuarto) y solo debe
 * reescribir los textos en un JSON con la misma forma. Si devuelve un
 * número distinto al que le dimos, generarReporte.ts lo ignora y se queda
 * con el de reglas.ts.
 */
import type { Reporte } from '../contrato.ts'

export function construirPrompt(base: Reporte): string {
  return `Eres un asistente de WIN (proveedor de internet) explicándole a un cliente, en español simple y sin jerga técnica, el resultado de una medición de wifi que hizo caminando por su casa.

Aquí está el diagnóstico YA CALCULADO (no cambies estados, porcentajes ni el campo "responsable"; solo mejora la redacción de los textos):

${JSON.stringify(base, null, 2)}

Responde ÚNICAMENTE con un JSON con esta forma exacta (sin markdown, sin texto extra):
{
  "titular": string (máx 80 caracteres, resume el hallazgo principal),
  "resumen": string (2-4 frases, lenguaje de cliente, sin tecnicismos),
  "causa_probable": string (1-2 frases, explica el porqué en términos simples),
  "cuartos": [ { "cuarto": string, "explicacion": string (1-2 frases) }, ... ] (mismo orden y mismos nombres de cuarto que el diagnóstico dado),
  "recomendaciones": [ { "titulo": string, "detalle": string }, ... ] (mismo orden y mismo número que el diagnóstico dado)
}`
}
