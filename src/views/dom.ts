/**
 * Ayuda para crear elementos de la página.
 *
 * Nunca se usa innerHTML: todo el texto se inserta como texto, de modo que el
 * contenido de un informe importado no puede ejecutarse como código (XSS).
 */

type Atributos = Record<string, string>;
type Hijo = HTMLElement | string;

export function crearElemento(
  etiqueta: string,
  atributos: Atributos = {},
  hijos: readonly Hijo[] = [],
): HTMLElement {
  const elemento = document.createElement(etiqueta);
  for (const [nombre, valor] of Object.entries(atributos)) {
    elemento.setAttribute(nombre, valor);
  }
  for (const hijo of hijos) {
    elemento.append(hijo);
  }
  return elemento;
}
