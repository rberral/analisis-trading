/**
 * Convierte los fragmentos de texto de una página PDF (cada uno con su posición) en líneas:
 * los fragmentos que están a la misma altura forman una línea, ordenados de izquierda a derecha.
 */
export interface FragmentoTexto {
  readonly texto: string;
  readonly x: number;
  /** Altura en la página: crece hacia arriba, como en PDF. */
  readonly y: number;
}

/** Dos fragmentos a menos de esta distancia vertical (en puntos) se consideran de la misma línea. */
const TOLERANCIA_Y = 2;

export function agruparEnLineas(fragmentos: readonly FragmentoTexto[]): string[] {
  const filas: { y: number; piezas: FragmentoTexto[] }[] = [];
  for (const fragmento of fragmentos) {
    if (fragmento.texto.trim() === '') continue;
    const fila = filas.find((candidata) => Math.abs(candidata.y - fragmento.y) <= TOLERANCIA_Y);
    if (fila) fila.piezas.push(fragmento);
    else filas.push({ y: fragmento.y, piezas: [fragmento] });
  }
  return filas
    .sort((a, b) => b.y - a.y)
    .map((fila) =>
      fila.piezas
        .sort((a, b) => a.x - b.x)
        .map((pieza) => pieza.texto.trim())
        .join(' '),
    );
}
